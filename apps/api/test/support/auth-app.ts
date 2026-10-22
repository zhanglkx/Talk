import 'reflect-metadata'
import { createHmac } from 'node:crypto'
import { Logger } from '@nestjs/common'
import type { Type } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { vi } from 'vitest'
import { AppModule } from '../../src/app.module.js'
import { configureApp, configureSession } from '../../src/configure-app.js'
import { ConnectionLifecycleService } from '../../src/database/connection-lifecycle.service.js'
import { AuthService } from '../../src/modules/auth/auth.service.js'
import { isSessionActive } from '../../src/modules/auth/session-lifecycle.js'
import { SessionsRepository } from '../../src/modules/auth/sessions.repository.js'
import type { SessionChanges, SessionRecord } from '../../src/modules/auth/sessions.repository.js'

// me 与 AuthGuard 的离线 HTTP 测试共用（M1-S25）。按 main.ts 的方式组装：真实 AppModule + configureApp +
// configureSession，会话中间件、PostgresSessionStore 和全局 Guard 都是真的；只把 AuthService 和
// SessionsRepository 换成内存替身，数据库一律不可用。

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR

export type PublicUser = { id: string; username: string }

export const alice: PublicUser = {
  id: '00000000-0000-4000-8000-0000000000a1',
  username: 'fixture_alice',
}
export const bob: PublicUser = {
  id: '00000000-0000-4000-8000-0000000000b2',
  username: 'fixture_bob',
}

// 与 AuthGuard、me 约定的 401 文案；未登录、过期、用户不存在都用这一句。
export const authenticationRequired = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication required',
}

function unitTestSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('test/setup-env.ts must provide SESSION_SECRET')
  return secret
}

// express-session 的签名格式：s:<会话 ID>.<HMAC-SHA256，Base64 去掉末尾 =>，整体做 URL 编码。
export function sign(sessionId: string, secret = unitTestSecret()): string {
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  return `s:${sessionId}.${signature}`
}

export function sessionCookie(sessionId: string, secret?: string): string {
  return `ledger.sid=${encodeURIComponent(sign(sessionId, secret))}`
}

// 取出响应里唯一一个 ledger.sid 的会话 ID；没有或多于一个时返回 undefined。
export function issuedSessionId(response: request.Response): string | undefined {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined
  if (header?.length !== 1) return undefined
  const pair = header[0]?.split(';')[0] ?? ''
  if (!pair.startsWith('ledger.sid=')) return undefined
  const signed = decodeURIComponent(pair.slice('ledger.sid='.length))
  const sessionId = signed.slice(2, signed.lastIndexOf('.'))
  return signed === sign(sessionId) ? sessionId : undefined
}

// 内存版 SessionsRepository：与真实仓储一致，同一 ID 再 create 会报错（真实库是主键冲突 23505）。
export function createFakeSessions() {
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

export type FakeSessions = ReturnType<typeof createFakeSessions>

// 一行已登录的会话。默认一小时前登录、仍然有效；时间可以改成已过期。
export function storedSession(
  userId: string,
  {
    csrfToken = `fixture-csrf-token-for-${userId}`,
    lastSeenAt = new Date(Date.now() - HOUR),
    idleExpiresAt = new Date(lastSeenAt.getTime() + 12 * HOUR),
    absoluteExpiresAt = new Date(lastSeenAt.getTime() + 7 * DAY),
  } = {},
): SessionRecord {
  return {
    userId,
    data: { csrfToken },
    window: { lastSeenAt, idleExpiresAt, absoluteExpiresAt },
  }
}

const openApps: NestExpressApplication[] = []

// 每个用例都是新容器；在 afterEach 里调用 closeAuthApps。
export async function createAuthApp({ controllers = [] as Type[] } = {}) {
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('Auth HTTP tests must not initialize the database')
  })
  const logged = [
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  ]
  const knownUsers = new Map([alice, bob].map((user) => [user.id, user]))
  const verifyCredentials =
    vi.fn<(username: string, password: string) => Promise<PublicUser | null>>()
  // 默认像真实仓储一样只认 alice 和 bob，每次返回新的普通对象。
  const findSessionUser = vi.fn(async (userId: string): Promise<PublicUser | null> => {
    const user = knownUsers.get(userId)
    return user ? { ...user } : null
  })
  const sessions = createFakeSessions()
  const ensureConnected = vi.fn().mockRejectedValue(new Error('database unavailable'))
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .overrideProvider(AuthService)
    .useValue({ verifyCredentials, findSessionUser })
    .overrideProvider(SessionsRepository)
    .useValue(sessions)
    .compile()
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
  openApps.push(app)
  configureApp(app)
  configureSession(app)
  await app.init()
  return {
    app,
    server: app.getHttpServer() as Parameters<typeof request>[0],
    verifyCredentials,
    findSessionUser,
    sessions,
    ensureConnected,
    // express-session 在响应结束后才把续期/保存的错误交给错误处理（setImmediate），稍等再看日志。
    loggedAfterResponse: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return logged.reduce((count, spy) => count + spy.mock.calls.length, 0)
    },
  }
}

export async function closeAuthApps(): Promise<void> {
  try {
    while (openApps.length > 0) await openApps.pop()?.close()
  } finally {
    vi.restoreAllMocks()
  }
}
