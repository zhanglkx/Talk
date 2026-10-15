import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import type { Client } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'
import type { TestDatabaseTarget } from './support/test-database.js'

// 启动真正的 dist/main.js（和 pnpm start 相同），用 HTTP 请求检查会话中间件的挂载位置。
// 还没有登录接口，所以测试直接往 sessions 表写一行，再带着对应的签名 Cookie 发请求。
const apiRoot = fileURLToPath(new URL('../../', import.meta.url))
const fixtureSecret = 'fixture-main-session-secret-0000000000'
const HOUR = 60 * 60 * 1000

let target: TestDatabaseTarget | undefined
let client: Client | undefined
let server: RunningServer | undefined

type RunningServer = { process: ChildProcess; baseUrl: string; output: () => string }

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

function running(): RunningServer {
  if (!server) throw new Error('Server is not running')
  return server
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function sessionCookie(sessionId: string, secret = fixtureSecret): string {
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  return `ledger.sid=${encodeURIComponent(`s:${sessionId}.${signature}`)}`
}

async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port')
  return address.port
}

function startMain(environment: Record<string, string>) {
  const child = spawn('node', ['dist/main.js'], {
    cwd: apiRoot,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout?.on('data', (chunk) => (output += String(chunk)))
  child.stderr?.on('data', (chunk) => (output += String(chunk)))
  const exited = new Promise<number | null>((resolve) =>
    child.once('exit', (code) => resolve(code)),
  )
  return { child, exited, output: () => stripVTControlCharacters(output) }
}

async function startServer(): Promise<RunningServer> {
  if (!target) throw new Error('Test database target is missing')
  const port = await freePort()
  const started = startMain({
    DATABASE_URL: target.databaseUrl,
    SESSION_SECRET: fixtureSecret,
    PORT: String(port),
  })
  const baseUrl = `http://127.0.0.1:${port}`
  let exitCode: number | null | undefined
  void started.exited.then((code) => (exitCode = code))

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (exitCode !== undefined) {
      throw new Error(`dist/main.js exited early with code ${exitCode}:\n${started.output()}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/health`)
      if (response.ok) return { process: started.child, baseUrl, output: started.output }
    } catch {
      // 还没开始监听，稍后重试。
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  started.child.kill('SIGKILL')
  throw new Error(`dist/main.js did not start listening:\n${started.output()}`)
}

async function stopServer(): Promise<void> {
  const current = server
  server = undefined
  if (!current || current.process.exitCode !== null) return
  const exited = new Promise((resolve) => current.process.once('exit', resolve))
  current.process.kill('SIGTERM')
  const timer = setTimeout(() => current.process.kill('SIGKILL'), 10_000)
  await exited
  clearTimeout(timer)
}

// 一行有效会话：一小时前登录，闲置截止还剩 11 小时。
async function insertSession(userId: string) {
  const sessionId = randomBytes(32).toString('base64url')
  const loginAt = Date.now() - HOUR
  await database().query(
    `INSERT INTO sessions
       (session_key_hash, user_id, data, last_seen_at, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sha256(sessionId),
      userId,
      { csrfToken: 'fixture-csrf-token' },
      new Date(loginAt),
      new Date(loginAt + 12 * HOUR),
      new Date(loginAt + 7 * 24 * HOUR),
    ],
  )
  return sessionId
}

async function sessionRow(sessionId: string) {
  const result = await database().query<{
    last_seen_at: Date
    idle_expires_at: Date
    absolute_expires_at: Date
  }>(
    'SELECT last_seen_at, idle_expires_at, absolute_expires_at FROM sessions WHERE session_key_hash = $1',
    [sha256(sessionId)],
  )
  return result.rows[0]
}

async function sessionCount(): Promise<number> {
  const result = await database().query<{ count: string }>('SELECT count(*) AS count FROM sessions')
  return Number(result.rows[0]?.count)
}

const userId = randomUUID()

beforeAll(async () => {
  ;({ target } = await prepareMigratedDatabase())
  client = await connectTestDatabase(target)
  await client.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
    userId,
    'fixture_alice',
    '$argon2id$fixture-not-a-real-hash',
  ])
})

afterAll(async () => {
  await stopServer()
  await client?.end()
})

describe('dist/main.js session wiring on a real PostgreSQL database', () => {
  it('refuses to start without SESSION_SECRET', async () => {
    if (!target) throw new Error('Test database target is missing')
    // 显式给空串：进程变量优先于 .env，仓库根 .env 里即使有密钥也不会被用上。
    const started = startMain({
      DATABASE_URL: target.databaseUrl,
      SESSION_SECRET: '',
      PORT: String(await freePort()),
    })
    const timer = setTimeout(() => started.child.kill('SIGKILL'), 20_000)
    const code = await started.exited
    clearTimeout(timer)

    expect(code).not.toBe(0)
    expect(code).not.toBeNull()
    expect(started.output()).toContain('SESSION_SECRET is required')
    expect(started.output()).not.toContain('postgresql://')
  })

  it('starts with SESSION_SECRET and keeps health free of session handling', async () => {
    server = await startServer()
    const sessionId = await insertSession(userId)
    const before = await sessionRow(sessionId)

    const response = await request(running().baseUrl)
      .get('/api/v1/health')
      .set('Cookie', sessionCookie(sessionId))

    expect(response.status).toBe(200)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(await sessionRow(sessionId)).toEqual(before)
  })

  it('loads and touches a stored session on /api/v1/auth without issuing a new cookie', async () => {
    const sessionId = await insertSession(userId)
    const before = await sessionRow(sessionId)
    if (!before) throw new Error('Expected the fixture session row')

    // 还没有 auth 接口，响应是 404；会话中间件仍会读出会话，并在响应结束前续期。
    const response = await request(running().baseUrl)
      .get('/api/v1/auth/fixture-probe')
      .set('Cookie', sessionCookie(sessionId))

    expect(response.status).toBe(404)
    expect(response.headers['set-cookie']).toBeUndefined()
    const after = await sessionRow(sessionId)
    expect(after?.last_seen_at.getTime()).toBeGreaterThan(before.last_seen_at.getTime())
    expect(after?.idle_expires_at.getTime()).toBeGreaterThan(before.idle_expires_at.getTime())
    expect(after?.absolute_expires_at).toEqual(before.absolute_expires_at)
  })

  it('stores nothing for anonymous requests or forged cookies on /api/v1/auth', async () => {
    const sessionId = await insertSession(userId)
    const before = await sessionRow(sessionId)
    const count = await sessionCount()

    const anonymous = await request(running().baseUrl).get('/api/v1/auth/fixture-probe')
    const forged = await request(running().baseUrl)
      .get('/api/v1/auth/fixture-probe')
      .set('Cookie', sessionCookie(sessionId, 'fixture-some-other-secret-0000000000'))

    expect(anonymous.status).toBe(404)
    expect(anonymous.headers['set-cookie']).toBeUndefined()
    expect(forged.status).toBe(404)
    expect(forged.headers['set-cookie']).toBeUndefined()
    expect(await sessionCount()).toBe(count)
    expect(await sessionRow(sessionId)).toEqual(before)
  })

  it('never prints the secret or the connection string, and releases its connections on SIGTERM', async () => {
    const output = running().output()
    await stopServer()

    expect(output).not.toContain(fixtureSecret)
    expect(output).not.toContain('postgresql://')
    const others = await database().query<{ count: string }>(
      `SELECT count(*) AS count FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    )
    expect(others.rows[0]?.count).toBe('0')
  })
})
