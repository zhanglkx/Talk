import { createHash, randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/modules/auth/password-hasher.js'
import { startApi, stopApi } from './support/api-process.js'
import type { RunningApi } from './support/api-process.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

// GET /api/v1/auth/me 在 ledger_it 上的完整链路（M1-S25）：启动真正的 dist/main.js，先经真实登录拿到
// Cookie，再用它调 me；全局 AuthGuard、express-session、PostgresSessionStore、users/sessions 表都是真的。
const fixtureSecret = 'fixture-me-session-secret-00000000000'
const HOUR = 60 * 60 * 1000
const alice = { id: randomUUID(), username: 'fixture_alice', password: 'fixture-Alice-passw0rd' }
const bob = { id: randomUUID(), username: 'fixture_bob', password: 'fixture-Bob-passw0rd!' }
// 只用来验证「会话还在、用户已删除」的情况；单独一个用户，删掉它不影响其他用例。
const carol = { id: randomUUID(), username: 'fixture_carol', password: 'fixture-Carol-passw0rd' }
const authenticationRequired = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication required',
}

let client: Client | undefined
let api: RunningApi | undefined

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

function running(): RunningApi {
  if (!api) throw new Error('API is not running')
  return api
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

type Fixture = { id: string; username: string; password: string }
type LoggedIn = { cookie: string; sessionId: string }

// 真实登录，返回请求头里要带的 Cookie 和其中的会话 ID。
async function logIn(user: Fixture): Promise<LoggedIn> {
  const response = await request(running().baseUrl)
    .post('/api/v1/auth/login')
    .send({ username: user.username, password: user.password })
  expect(response.status).toBe(200)
  const header = response.headers['set-cookie'] as unknown as string[] | undefined
  expect(header).toHaveLength(1)
  const cookie = (header?.[0] ?? '').split(';')[0] ?? ''
  const signed = decodeURIComponent(cookie.slice('ledger.sid='.length))
  return { cookie, sessionId: signed.slice(2, signed.lastIndexOf('.')) }
}

function me(cookie?: string, path = '/api/v1/auth/me') {
  const test = request(running().baseUrl).get(path)
  return cookie ? test.set('Cookie', cookie) : test
}

type SessionRow = {
  user_id: string
  data: { csrfToken?: string }
  last_seen_at: Date
  idle_expires_at: Date
  absolute_expires_at: Date
}

async function rowFor(sessionId: string): Promise<SessionRow | undefined> {
  const result = await database().query<SessionRow>(
    'SELECT * FROM sessions WHERE session_key_hash = $1',
    [sha256(sessionId)],
  )
  return result.rows[0]
}

// 续期由 express-session 在响应结束后调用 touch，稍等再读库。
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200))
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
  for (const user of [alice, bob, carol]) {
    await client.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
      user.id,
      user.username,
      await hashPassword(user.password),
    ])
  }
  api = await startApi({ DATABASE_URL: target.databaseUrl, SESSION_SECRET: fixtureSecret })
})

afterAll(async () => {
  await stopApi(api)
  await client?.end()
})

describe('GET /api/v1/auth/me on a real PostgreSQL database', () => {
  it('returns the logged-in user and the CSRF token stored in the session row', async () => {
    const { cookie, sessionId } = await logIn(alice)

    const response = await me(cookie)

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['set-cookie']).toBeUndefined()
    const row = await rowFor(sessionId)
    expect(row?.data.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(response.body).toStrictEqual({
      user: { id: alice.id, username: alice.username },
      csrfToken: row?.data.csrfToken,
    })
  })

  it('extends the idle deadline in the database but leaves the absolute deadline alone', async () => {
    const { cookie, sessionId } = await logIn(alice)
    // 把这一行退回到一小时前登录的状态，续期前后的差别才看得出来。
    await database().query(
      `UPDATE sessions
          SET last_seen_at = last_seen_at - interval '1 hour',
              idle_expires_at = idle_expires_at - interval '1 hour'
        WHERE session_key_hash = $1`,
      [sha256(sessionId)],
    )
    const before = await rowFor(sessionId)
    const requestedAt = Date.now()

    const response = await me(cookie)
    await settle()

    expect(response.status).toBe(200)
    const after = await rowFor(sessionId)
    expect(after?.last_seen_at.getTime()).toBeGreaterThanOrEqual(requestedAt - 1000)
    expect(after?.idle_expires_at.getTime()).toBe((after?.last_seen_at.getTime() ?? 0) + 12 * HOUR)
    expect(after?.idle_expires_at.getTime()).toBeGreaterThan(before?.idle_expires_at.getTime() ?? 0)
    expect(after?.absolute_expires_at).toEqual(before?.absolute_expires_at)
    expect(after?.data).toStrictEqual(before?.data)
  })

  it('gives alice and bob their own identity, whatever userId the request carries', async () => {
    const asAlice = await logIn(alice)
    const asBob = await logIn(bob)

    const aliceMe = await me(asAlice.cookie, `/api/v1/auth/me?userId=${bob.id}`).set(
      'X-User-Id',
      bob.id,
    )
    const bobMe = await me(asBob.cookie, `/api/v1/auth/me?userId=${alice.id}`).set(
      'X-User-Id',
      alice.id,
    )

    expect(aliceMe.body.user).toStrictEqual({ id: alice.id, username: alice.username })
    expect(bobMe.body.user).toStrictEqual({ id: bob.id, username: bob.username })
    expect(aliceMe.body.csrfToken).toBe((await rowFor(asAlice.sessionId))?.data.csrfToken)
    expect(bobMe.body.csrfToken).toBe((await rowFor(asBob.sessionId))?.data.csrfToken)
    expect(aliceMe.body.csrfToken).not.toBe(bobMe.body.csrfToken)
  })

  it('answers 401 without a cookie', async () => {
    const response = await me()

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it.each([
    [
      'the idle deadline has passed',
      `UPDATE sessions
          SET last_seen_at = now() - interval '13 hours',
              idle_expires_at = now() - interval '1 second'
        WHERE session_key_hash = $1`,
    ],
    [
      'the absolute deadline has passed',
      `UPDATE sessions
          SET created_at = now() - interval '8 days',
              last_seen_at = now() - interval '2 days',
              idle_expires_at = now() - interval '1 second',
              absolute_expires_at = now() - interval '1 second'
        WHERE session_key_hash = $1`,
    ],
    ['the session row was deleted', 'DELETE FROM sessions WHERE session_key_hash = $1'],
  ])('answers 401 when %s, and does not bring the session back', async (_case, sql) => {
    const { cookie, sessionId } = await logIn(alice)
    await database().query(sql, [sha256(sessionId)])
    const before = await rowFor(sessionId)

    const response = await me(cookie)
    await settle()

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['set-cookie']).toBeUndefined()
    // 过期的不续期，删掉的不重新建出来。
    expect(await rowFor(sessionId)).toEqual(before)
  })

  it('answers 401 when the session is still there but its user is gone', async () => {
    const { cookie, sessionId } = await logIn(carol)
    // sessions 的外键带 ON DELETE CASCADE，删用户会连带删会话；先拿掉外键，模拟两者之间的那一瞬间。
    await database().query('ALTER TABLE sessions DROP CONSTRAINT fk_sessions_user_id')
    try {
      await database().query('DELETE FROM users WHERE id = $1', [carol.id])
      expect((await rowFor(sessionId))?.user_id).toBe(carol.id)

      const response = await me(cookie)

      expect(response.status).toBe(401)
      expect(response.body).toStrictEqual(authenticationRequired)
      expect(response.headers['set-cookie']).toBeUndefined()
    } finally {
      await database().query('DELETE FROM sessions WHERE user_id = $1', [carol.id])
      await database().query(
        `ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user_id
           FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE`,
      )
    }
  })

  it('keeps health open and logs no errors, passwords, tokens, secret or connection string', async () => {
    const { cookie, sessionId } = await logIn(bob)
    const token = (await rowFor(sessionId))?.data.csrfToken ?? 'missing-token'
    await me(cookie)

    const health = await request(running().baseUrl).get('/api/v1/health')
    await settle()
    const output = running().output()
    await stopApi(api)
    api = undefined

    expect(health.status).toBe(200)
    expect(output).not.toContain('ExceptionsHandler')
    for (const secret of [
      alice.password,
      bob.password,
      carol.password,
      token,
      sessionId,
      fixtureSecret,
      'postgresql://',
    ]) {
      expect(output).not.toContain(secret)
    }
    const others = await database().query<{ count: string }>(
      `SELECT count(*) AS count FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    )
    expect(others.rows[0]?.count).toBe('0')
  })
})
