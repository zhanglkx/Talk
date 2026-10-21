import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/modules/auth/password-hasher.js'
import { startApi, stopApi } from './support/api-process.js'
import type { RunningApi } from './support/api-process.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

// POST /api/v1/auth/login 在 ledger_it 上的完整链路（M1-S24）：启动真正的 dist/main.js，
// 用真实的 Argon2id 哈希、express-session、PostgresSessionStore 和 sessions 表。
const fixtureSecret = 'fixture-login-session-secret-000000000'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const alice = { id: randomUUID(), username: 'fixture_alice', password: 'fixture-Alice-passw0rd' }
const bob = { id: randomUUID(), username: 'fixture_bob', password: 'fixture-Bob-passw0rd!' }

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

// 取出响应里唯一一个 ledger.sid，校验签名后返回会话 ID 和请求头里要带的 Cookie。
function issuedSession(response: request.Response): { sessionId: string; cookie: string } {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined
  expect(header).toHaveLength(1)
  const pair = (header?.[0] ?? '').split(';')[0] ?? ''
  const signed = decodeURIComponent(pair.slice('ledger.sid='.length))
  const sessionId = signed.slice(2, signed.lastIndexOf('.'))
  const signature = createHmac('sha256', fixtureSecret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  expect(signed).toBe(`s:${sessionId}.${signature}`)
  return { sessionId, cookie: pair }
}

type SessionRow = {
  session_key_hash: string
  user_id: string
  data: Record<string, unknown>
  created_at: Date
  last_seen_at: Date
  idle_expires_at: Date
  absolute_expires_at: Date
}

async function sessionRows(): Promise<SessionRow[]> {
  const result = await database().query<SessionRow>('SELECT * FROM sessions')
  return result.rows
}

async function rowFor(sessionId: string): Promise<SessionRow | undefined> {
  return (await sessionRows()).find((row) => row.session_key_hash === sha256(sessionId))
}

function login(body: object, cookie?: string) {
  const test = request(running().baseUrl).post('/api/v1/auth/login').send(body)
  return cookie ? test.set('Cookie', cookie) : test
}

// express-session 在响应发出后才处理第二次保存的错误，稍等再读进程输出。
async function outputAfterResponses(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return running().output()
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
  for (const user of [alice, bob]) {
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

describe('POST /api/v1/auth/login on a real PostgreSQL database', () => {
  let aliceSession: { sessionId: string; cookie: string } | undefined

  it('logs alice in and stores exactly one session row under the digest of the issued ID', async () => {
    const before = Date.now()
    const response = await login({ username: '  Fixture_Alice ', password: alice.password })
    const after = Date.now()

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ user: { id: alice.id, username: alice.username } })
    expect(response.headers['cache-control']).toBe('no-store')
    aliceSession = issuedSession(response)
    const rows = await sessionRows()
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row?.session_key_hash).toBe(sha256(aliceSession.sessionId))
    expect(row?.user_id).toBe(alice.id)
    expect(Object.keys(row?.data ?? {})).toEqual(['csrfToken'])
    expect(row?.data.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // 明文会话 ID 只在 Cookie 里，库里只有摘要。
    expect(JSON.stringify(rows)).not.toContain(aliceSession.sessionId)
    expect(row?.absolute_expires_at.getTime()).toBeGreaterThanOrEqual(before - 1000 + 7 * DAY)
    expect(row?.absolute_expires_at.getTime()).toBeLessThanOrEqual(after + 1000 + 7 * DAY)
    expect(row?.idle_expires_at.getTime()).toBe((row?.last_seen_at.getTime() ?? 0) + 12 * HOUR)
    // 响应结束时 express-session 会再保存一次；不能因主键冲突在服务端留下错误。
    const output = await outputAfterResponses()
    expect(output).not.toContain('ExceptionsHandler')
    expect(output).not.toContain('duplicate key')
  })

  it('rotates the session: logging in as bob with alice’s cookie deletes her row and stores only his', async () => {
    if (!aliceSession) throw new Error('The previous test must log alice in first')

    const response = await login(
      { username: bob.username, password: bob.password },
      aliceSession.cookie,
    )

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ user: { id: bob.id, username: bob.username } })
    const bobSession = issuedSession(response)
    expect(bobSession.sessionId).not.toBe(aliceSession.sessionId)
    expect(await rowFor(aliceSession.sessionId)).toBeUndefined()
    expect((await rowFor(bobSession.sessionId))?.user_id).toBe(bob.id)
    expect(await sessionRows()).toHaveLength(1)
  })

  it('answers a wrong password and an unknown user with the same 401 and stores nothing', async () => {
    const before = await sessionRows()

    const wrongPassword = await login({ username: alice.username, password: bob.password })
    const unknownUser = await login({ username: 'fixture_nobody', password: alice.password })

    for (const response of [wrongPassword, unknownUser]) {
      expect(response.status).toBe(401)
      expect(response.headers['set-cookie']).toBeUndefined()
      expect(response.headers['cache-control']).toBe('no-store')
    }
    expect(wrongPassword.body).toStrictEqual(unknownUser.body)
    expect(await sessionRows()).toEqual(before)
  })

  it('rejects an invalid body with 400 and stores nothing', async () => {
    const before = await sessionRows()

    const response = await login({ username: alice.username, password: 'too-short' })

    expect(response.status).toBe(400)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(await sessionRows()).toEqual(before)
  })

  it('logs no errors, passwords, secret or connection string, and releases its connections on SIGTERM', async () => {
    const output = await outputAfterResponses()
    await stopApi(api)
    api = undefined

    expect(output).not.toContain('ExceptionsHandler')
    expect(output).not.toContain('duplicate key')
    for (const secret of [alice.password, bob.password, fixtureSecret, 'postgresql://']) {
      expect(output).not.toContain(secret)
    }
    const others = await database().query<{ count: string }>(
      `SELECT count(*) AS count FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    )
    expect(others.rows[0]?.count).toBe('0')
  })
})
