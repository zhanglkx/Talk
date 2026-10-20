import 'reflect-metadata'
import { createHmac } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

// 用真实的 AppModule、configureApp 和 configureSession 组装（与 main.ts 相同），数据库一律不可用。
const configureAppPath = new URL('../src/configure-app.ts', import.meta.url).href
type ConfigureSession = (app: INestApplication) => void

let app: NestExpressApplication | undefined

afterEach(async () => {
  try {
    await app?.close()
  } finally {
    app = undefined
    vi.restoreAllMocks()
  }
})

async function loadConfigureSession(): Promise<ConfigureSession> {
  const setup = await import(configureAppPath)
  expect(setup.configureSession).toBeTypeOf('function')
  return setup.configureSession
}

function unitTestSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('test/setup-env.ts must provide SESSION_SECRET')
  return secret
}

// 按 express-session 的格式签名：s:<会话 ID>.<HMAC-SHA256，Base64 去掉末尾 =>，再做 URL 编码。
function sessionCookie(sessionId: string, secret = unitTestSecret()): string {
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  return `ledger.sid=${encodeURIComponent(`s:${sessionId}.${signature}`)}`
}

async function createOfflineApp() {
  const initialize = vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('Session mount tests must not initialize the database')
  })
  vi.spyOn(PostgresQueryRunner.prototype, 'query').mockImplementation(() => {
    throw new Error('Session mount tests must not send SQL')
  })
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  const ensureConnected = vi.fn().mockRejectedValue(new Error('database unavailable'))
  const configureSession = await loadConfigureSession()

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .compile()
  app = moduleRef.createNestApplication<NestExpressApplication>()
  configureApp(app)
  configureSession(app)
  await app.init()
  return { server: app.getHttpServer(), ensureConnected, initialize }
}

describe('session middleware mounted like main.ts, with the database down', () => {
  it('is installed without connecting to the database', async () => {
    const { ensureConnected, initialize } = await createOfflineApp()

    expect(ensureConnected).not.toHaveBeenCalled()
    expect(initialize).not.toHaveBeenCalled()
  })

  it('keeps GET /api/v1/health at 200 even when a valid session cookie is sent', async () => {
    const { server, ensureConnected } = await createOfflineApp()

    const response = await request(server)
      .get('/api/v1/health')
      .set('Cookie', sessionCookie('fixture-session-id'))

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(ensureConnected).not.toHaveBeenCalled()
  })

  it('leaves GET /internal/ready to the readiness check alone', async () => {
    const { server, ensureConnected } = await createOfflineApp()

    const response = await request(server)
      .get('/internal/ready')
      .set('Cookie', sessionCookie('fixture-session-id'))

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'not_ready' })
    // 只有就绪检查本身连库一次，会话中间件没有参与。
    expect(ensureConnected).toHaveBeenCalledOnce()
  })

  it('neither stores nor issues a session for an anonymous request on a session path', async () => {
    const { server, ensureConnected } = await createOfflineApp()

    const response = await request(server).get('/api/v1/auth/fixture-probe')

    expect(response.status).toBe(404)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(ensureConnected).not.toHaveBeenCalled()
  })

  it('ignores a cookie signed with a different secret', async () => {
    const { server, ensureConnected } = await createOfflineApp()

    const response = await request(server)
      .get('/api/v1/auth/fixture-probe')
      .set('Cookie', sessionCookie('fixture-session-id', 'fixture-some-other-secret-0000000000'))

    expect(response.status).toBe(404)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(ensureConnected).not.toHaveBeenCalled()
  })

  it('looks up a validly signed session on a session path and fails without leaking details', async () => {
    const { server, ensureConnected } = await createOfflineApp()

    const response = await request(server)
      .get('/api/v1/auth/fixture-probe')
      .set('Cookie', sessionCookie('fixture-session-id'))

    // 会话中间件确实去查了会话；数据库不可用映射成 503 留到错误映射那一步，这里只要求是服务端错误。
    expect(ensureConnected).toHaveBeenCalledOnce()
    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(response.text).not.toContain('database unavailable')
    expect(response.headers['set-cookie']).toBeUndefined()
  })
})

describe('configureSession without a usable SESSION_SECRET', () => {
  it.each([
    ['missing', undefined],
    ['too short', 'fixture-too-short-secret'],
  ])('refuses to install the middleware when the secret is %s', async (_case, secret) => {
    const configureSession = await loadConfigureSession()
    const saved = process.env.SESSION_SECRET
    // 删除 setup-env.ts 写入的值，让 ConfigService 只能看到下面给出的配置。
    delete process.env.SESSION_SECRET
    try {
      const config = new ConfigService(secret === undefined ? {} : { SESSION_SECRET: secret })
      const use = vi.fn()
      const fakeApp = {
        get: (token: unknown) => (token === ConfigService ? config : {}),
        use,
      } as unknown as INestApplication

      const error = (() => {
        try {
          configureSession(fakeApp)
        } catch (thrown) {
          return thrown
        }
        return undefined
      })()

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toMatch(/SESSION_SECRET/)
      if (secret) expect((error as Error).message).not.toContain(secret)
      expect(use).not.toHaveBeenCalled()
    } finally {
      process.env.SESSION_SECRET = saved
    }
  })
})
