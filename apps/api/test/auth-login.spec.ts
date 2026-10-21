import 'reflect-metadata'
import { createHmac } from 'node:crypto'
import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp, configureSession } from '../src/configure-app.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'
import { AuthService } from '../src/modules/auth/auth.service.js'
import { isSessionActive } from '../src/modules/auth/session-lifecycle.js'
import { SessionsRepository } from '../src/modules/auth/sessions.repository.js'
import type { SessionChanges, SessionRecord } from '../src/modules/auth/sessions.repository.js'

// POST /api/v1/auth/login（M1-S24），按 main.ts 的方式组装：真实 AppModule + configureApp + configureSession，
// 会话中间件和 PostgresSessionStore 都是真的；只把 AuthService 和 SessionsRepository 换成内存替身，不连数据库。
const controllerModulePath = new URL('../src/modules/auth/auth.controller.ts', import.meta.url).href
const loginPath = '/api/v1/auth/login'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const alice = { id: '00000000-0000-4000-8000-0000000000a1', username: 'fixture_alice' }
const bob = { id: '00000000-0000-4000-8000-0000000000b2', username: 'fixture_bob' }
const password = '  fixture passw0rd  '
const invalidCredentials = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Invalid username or password',
}

let app: NestExpressApplication | undefined

afterEach(async () => {
  try {
    await app?.close()
  } finally {
    app = undefined
    vi.restoreAllMocks()
  }
})

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('test/setup-env.ts must provide SESSION_SECRET')
  return secret
}

// express-session 的签名格式：s:<会话 ID>.<HMAC-SHA256，Base64 去掉末尾 =>，整体做 URL 编码。
function sign(sessionId: string): string {
  const signature = createHmac('sha256', sessionSecret())
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  return `s:${sessionId}.${signature}`
}

function sessionCookie(sessionId: string): string {
  return `ledger.sid=${encodeURIComponent(sign(sessionId))}`
}

// 取出响应里唯一一个 ledger.sid，校验签名后返回会话 ID 和 Cookie 属性。
function issuedSession(response: request.Response): { sessionId: string; attributes: string[] } {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined
  expect(header).toHaveLength(1)
  const [pair, ...attributes] = (header?.[0] ?? '').split(';').map((part) => part.trim())
  const [name, value] = (pair ?? '').split('=')
  expect(name).toBe('ledger.sid')
  const signed = decodeURIComponent(value ?? '')
  const sessionId = signed.slice(2, signed.lastIndexOf('.'))
  expect(signed).toBe(sign(sessionId))
  return { sessionId, attributes }
}

// 内存版 SessionsRepository：与真实仓储一致，同一 ID 再 create 会报错（真实库是主键冲突 23505）。
function createFakeSessions() {
  const rows = new Map<string, SessionRecord>()
  return {
    rows,
    create: vi.fn(async (id: string, record: SessionRecord) => {
      if (rows.has(id)) throw new Error('fixture duplicate session id')
      rows.set(id, structuredClone(record))
    }),
    findActive: vi.fn(async (id: string, now: Date) => {
      const record = rows.get(id)
      return record && isSessionActive(record.window, now) ? structuredClone(record) : null
    }),
    update: vi.fn(async (id: string, changes: SessionChanges) => {
      const record = rows.get(id)
      if (!record) return false
      rows.set(id, { ...record, ...structuredClone(changes) })
      return true
    }),
    delete: vi.fn(async (id: string) => {
      rows.delete(id)
    }),
  }
}

// 一行已登录的会话：一小时前登录。
function storedSession(userId: string): SessionRecord {
  const loginAt = Date.now() - HOUR
  return {
    userId,
    data: { csrfToken: 'fixture-existing-csrf-token' },
    window: {
      lastSeenAt: new Date(loginAt),
      idleExpiresAt: new Date(loginAt + 12 * HOUR),
      absoluteExpiresAt: new Date(loginAt + 7 * DAY),
    },
  }
}

async function createApp() {
  const controllerModule = await import(controllerModulePath)
  expect(controllerModule.AuthController).toBeTypeOf('function')

  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('Login HTTP tests must not initialize the database')
  })
  const logged = [
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  ]
  const verifyCredentials = vi.fn<(username: string, password: string) => Promise<unknown>>()
  const sessions = createFakeSessions()
  const ensureConnected = vi.fn().mockRejectedValue(new Error('database unavailable'))
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .overrideProvider(AuthService)
    .useValue({ verifyCredentials })
    .overrideProvider(SessionsRepository)
    .useValue(sessions)
    .compile()
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
  configureApp(app)
  configureSession(app)
  await app.init()
  const server = app.getHttpServer()
  return {
    app,
    server,
    verifyCredentials,
    sessions,
    ensureConnected,
    // express-session 在响应结束后才把保存错误交给错误处理（setImmediate），稍等再看日志。
    loggedAfterResponse: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return logged.reduce((count, spy) => count + spy.mock.calls.length, 0)
    },
  }
}

function login(server: unknown, body: unknown, cookie?: string) {
  const test = request(server as Parameters<typeof request>[0])
    .post(loginPath)
    .send(body as object)
  return cookie ? test.set('Cookie', cookie) : test
}

describe('POST /api/v1/auth/login with the right credentials', () => {
  it('returns only { user } with no-store and issues one signed HttpOnly session cookie', async () => {
    const { server, verifyCredentials } = await createApp()
    verifyCredentials.mockResolvedValue(alice)

    const response = await login(server, { username: 'fixture_alice', password })

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ user: alice })
    expect(response.headers['cache-control']).toBe('no-store')
    const { attributes } = issuedSession(response)
    // 本地 http：没有 Secure；不设 Expires/Max-Age（浏览器关闭即清除），不设 Domain。
    expect([...attributes].sort()).toEqual(['HttpOnly', 'Path=/', 'SameSite=Lax'])
  })

  it('checks the credentials from the validated body, with the password unchanged', async () => {
    const { server, verifyCredentials } = await createApp()
    verifyCredentials.mockResolvedValue(alice)

    await login(server, { username: '  Fixture_Alice ', password, userId: bob.id })

    expect(verifyCredentials).toHaveBeenCalledExactlyOnceWith('Fixture_Alice', password)
  })

  it('stores exactly one session under the issued ID, for the verified user, without logging errors', async () => {
    const { server, verifyCredentials, sessions, loggedAfterResponse } = await createApp()
    verifyCredentials.mockResolvedValue(alice)
    const before = Date.now()

    // 请求体里的 userId 不能影响会话归属，归属只来自 verifyCredentials 的结果。
    const response = await login(server, { username: 'fixture_alice', password, userId: bob.id })

    const after = Date.now()
    const { sessionId } = issuedSession(response)
    expect(sessions.create).toHaveBeenCalledOnce()
    expect(sessions.create.mock.calls[0]?.[0]).toBe(sessionId)
    expect([...sessions.rows.keys()]).toEqual([sessionId])
    const stored = sessions.rows.get(sessionId)
    expect(stored?.userId).toBe(alice.id)
    expect(Object.keys(stored?.data ?? {})).toEqual(['csrfToken'])
    // 32 个随机字节的 base64url 编码：43 个字符。
    expect(stored?.data.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(response.text).not.toContain(stored?.data.csrfToken ?? 'missing')
    const window = stored?.window
    expect(window?.absoluteExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY)
    expect(window?.absoluteExpiresAt.getTime()).toBeLessThanOrEqual(after + 7 * DAY)
    expect(window?.idleExpiresAt.getTime()).toBe((window?.lastSeenAt.getTime() ?? 0) + 12 * HOUR)
    // 响应结束时 express-session 会再保存一次；那一次不能撞上主键冲突，也不能留下错误日志。
    expect(await loggedAfterResponse()).toBe(0)
  })

  it('gives every login a new session ID and a new CSRF token', async () => {
    const { server, verifyCredentials, sessions } = await createApp()
    verifyCredentials.mockResolvedValue(alice)

    const first = issuedSession(await login(server, { username: 'fixture_alice', password }))
    const second = issuedSession(await login(server, { username: 'fixture_alice', password }))

    expect(second.sessionId).not.toBe(first.sessionId)
    expect(sessions.rows.get(second.sessionId)?.data.csrfToken).not.toBe(
      sessions.rows.get(first.sessionId)?.data.csrfToken,
    )
  })

  it('rotates the session ID: logging in as bob over alice deletes her session and stores only his', async () => {
    const { server, verifyCredentials, sessions, loggedAfterResponse } = await createApp()
    sessions.rows.set('fixture-alice-session', storedSession(alice.id))
    verifyCredentials.mockResolvedValue(bob)

    const response = await login(
      server,
      { username: 'fixture_bob', password },
      sessionCookie('fixture-alice-session'),
    )

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ user: bob })
    const { sessionId } = issuedSession(response)
    expect(sessionId).not.toBe('fixture-alice-session')
    expect(sessions.delete).toHaveBeenCalledWith('fixture-alice-session')
    expect([...sessions.rows.keys()]).toEqual([sessionId])
    expect(sessions.rows.get(sessionId)?.userId).toBe(bob.id)
    expect(await loggedAfterResponse()).toBe(0)
  })
})

describe('POST /api/v1/auth/login with wrong credentials or input', () => {
  it('answers an unknown user and a wrong password with the same 401, no cookie and no session', async () => {
    const { server, verifyCredentials, sessions } = await createApp()
    verifyCredentials.mockResolvedValue(null)

    const unknownUser = await login(server, { username: 'fixture_nobody', password })
    const wrongPassword = await login(server, {
      username: 'fixture_alice',
      password: 'x'.repeat(12),
    })

    for (const response of [unknownUser, wrongPassword]) {
      expect(response.status).toBe(401)
      expect(response.body).toStrictEqual(invalidCredentials)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['set-cookie']).toBeUndefined()
    }
    expect(unknownUser.text).toBe(wrongPassword.text)
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing password', { username: 'fixture_alice' }],
    ['a short password', { username: 'fixture_alice', password: 'x'.repeat(11) }],
    ['an invalid username', { username: 'fixture-alice', password }],
  ])('returns 400 for %s without checking credentials or issuing a cookie', async (_case, body) => {
    const { server, verifyCredentials, sessions } = await createApp()

    const response = await login(server, body)

    expect(response.status).toBe(400)
    expect(verifyCredentials).not.toHaveBeenCalled()
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(sessions.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/auth/login when a dependency fails', () => {
  it('fails without a cookie when the new session cannot be stored', async () => {
    const { server, verifyCredentials, sessions } = await createApp()
    verifyCredentials.mockResolvedValue(alice)
    sessions.create.mockRejectedValue(new Error('fixture storage failure'))

    const response = await login(server, { username: 'fixture_alice', password })

    expect(response.status).toBeGreaterThanOrEqual(500)
    // 库里没有这个会话，下发 Cookie 就是一个看似登录、实际无效的状态。
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.text).not.toContain('fixture storage failure')
    expect(sessions.rows.size).toBe(0)
  })

  it('fails without a cookie when the old session cannot be deleted during rotation', async () => {
    const { server, verifyCredentials, sessions } = await createApp()
    sessions.rows.set('fixture-alice-session', storedSession(alice.id))
    sessions.delete.mockRejectedValue(new Error('fixture delete failure'))
    verifyCredentials.mockResolvedValue(bob)

    const response = await login(
      server,
      { username: 'fixture_bob', password },
      sessionCookie('fixture-alice-session'),
    )

    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.text).not.toContain('fixture delete failure')
    expect(sessions.create).not.toHaveBeenCalled()
    expect([...sessions.rows.keys()]).toEqual(['fixture-alice-session'])
  })

  it('fails without a cookie and without touching sessions when checking credentials fails', async () => {
    const { server, verifyCredentials, sessions } = await createApp()
    verifyCredentials.mockRejectedValue(new Error('fixture database down'))

    const response = await login(server, { username: 'fixture_alice', password })

    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.text).not.toContain('fixture database down')
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.delete).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/auth/login in the generated OpenAPI document', () => {
  it('describes the request body, the 200 response schema and the 400 and 401 responses', async () => {
    const { app } = await createApp()

    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build())
    const operation = document.paths[loginPath]?.post

    expect(operation?.operationId).toBe('AuthController_login')
    expect(operation?.requestBody).toMatchObject({
      required: true,
      content: { 'application/json': { schema: { required: ['username', 'password'] } } },
    })
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '401'])
    const ok = operation?.responses['200'] as {
      content?: Record<string, { schema?: Record<string, unknown> }>
    }
    const schema = ok.content?.['application/json']?.schema
    expect(schema).toMatchObject({
      type: 'object',
      required: ['user'],
      additionalProperties: false,
      properties: {
        user: {
          type: 'object',
          required: ['id', 'username'],
          additionalProperties: false,
          properties: { id: { type: 'string', format: 'uuid' }, username: { type: 'string' } },
        },
      },
    })
    // 只描述公开字段：响应里没有 csrfToken、passwordHash 之类的属性。
    const properties = schema?.properties as Record<string, { properties: object }>
    expect(Object.keys(properties)).toEqual(['user'])
    expect(Object.keys(properties.user?.properties ?? {})).toEqual(['id', 'username'])
  })
})
