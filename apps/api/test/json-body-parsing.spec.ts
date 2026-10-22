import 'reflect-metadata'
import { createHmac } from 'node:crypto'
import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp, configureSession } from '../src/configure-app.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

// 格式错误的 JSON 请求体（M1-S23）：body-parser 的报错信息是 JSON.parse 的原文，会带出请求体的片段。
// configureApp 之后，这类请求一律返回固定的 400，响应和日志里都不能出现请求体的任何内容。
const probePath = '/api/v1/json-probe'
const guardModulePath = new URL('../src/common/guards/auth.guard.ts', import.meta.url).href
const secret = 'fixture-secret-value'
const malformedJsonResponse = {
  statusCode: 400,
  error: 'Bad Request',
  message: 'Request body must be valid JSON',
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

// 按 express-session 的格式签名：s:<会话 ID>.<HMAC-SHA256，Base64 去掉末尾 =>，再做 URL 编码。
function sessionCookie(sessionId: string): string {
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) throw new Error('test/setup-env.ts must provide SESSION_SECRET')
  const signature = createHmac('sha256', sessionSecret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  return `ledger.sid=${encodeURIComponent(`s:${sessionId}.${signature}`)}`
}

async function createApp({ withSession = false } = {}) {
  // 全局 AuthGuard 默认要求登录（M1-S25）；本测试只关心 JSON 解析，所以把测试用的 Controller 标为公开。
  const { Public } = await import(guardModulePath)
  // Controller 收到的每个请求体都记在这里；被拒绝的请求不应该出现。
  const received: unknown[] = []

  @Public()
  @Controller()
  class JsonProbeController {
    @Post('json-probe')
    @HttpCode(200)
    probe(@Body() body: unknown): { received: unknown } {
      received.push(body)
      return { received: body }
    }

    // 挂在会话路径下，用来确认 JSON 检查发生在查会话之前。
    @Post('auth/json-probe')
    @HttpCode(200)
    authProbe(@Body() body: unknown): { received: unknown } {
      received.push(body)
      return { received: body }
    }
  }

  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('JSON body tests must not initialize the database')
  })
  const logged = [
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
  ]
  const ensureConnected = vi.fn().mockRejectedValue(new Error('database unavailable'))
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [JsonProbeController],
  })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .compile()
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
  configureApp(app)
  if (withSession) configureSession(app)
  await app.init()

  const loggedText = () => JSON.stringify(logged.flatMap((spy) => spy.mock.calls))
  return { app, server: app.getHttpServer(), received, ensureConnected, loggedText }
}

function postJson(server: unknown, raw: string, path = probePath) {
  return request(server as Parameters<typeof request>[0])
    .post(path)
    .set('Content-Type', 'application/json')
    .send(raw)
}

describe('malformed JSON request bodies after configureApp', () => {
  it.each([
    ['form encoding sent as JSON', `password=${secret}`],
    ['a bare word', secret],
    ['an unquoted value', `{"username":"demo_a","password":${secret}}`],
    ['a trailing comma', `{"username":"demo_a","password":"${secret}",}`],
    ['single quotes', `{'username':'demo_a','password':'${secret}'}`],
    ['a truncated object', `{"username":"demo_a","password":"${secret}"`],
    ['a broken token after a long prefix', `{"note":"${'x'.repeat(200)}","password":"${secret}"x}`],
  ])('returns the fixed 400 for %s without echoing or logging the body', async (_case, raw) => {
    const { server, received, ensureConnected, loggedText } = await createApp()

    const response = await postJson(server, raw)

    expect(response.status).toBe(400)
    expect(response.body).toStrictEqual(malformedJsonResponse)
    expect(received).toEqual([])
    expect(ensureConnected).not.toHaveBeenCalled()
    // 请求体里的任何一段都不能出现在响应或日志里，哪怕只是开头几个字符。
    for (const fragment of ['fixture', 'secret', 'password', 'demo_a', 'xxxx']) {
      expect(response.text).not.toContain(fragment)
      expect(loggedText()).not.toContain(fragment)
    }
  })

  it('still parses valid JSON and hands it to the controller', async () => {
    const { server, received } = await createApp()

    const response = await postJson(server, '{"username":"demo_a","nested":{"n":1}}')

    expect(response.status).toBe(200)
    expect(received).toStrictEqual([{ username: 'demo_a', nested: { n: 1 } }])
  })

  it('keeps treating an empty JSON body as {}, as body-parser does by default', async () => {
    const { server, received } = await createApp()

    const response = await postJson(server, '')

    expect(response.status).toBe(200)
    expect(received).toStrictEqual([{}])
  })

  it('keeps other body-parser errors as they were: 413 for a body over the 100kb default', async () => {
    const { server, received } = await createApp()

    const response = await postJson(server, `{"note":"${'x'.repeat(110 * 1024)}"}`)

    expect(response.status).toBe(413)
    expect(response.body).toStrictEqual({ statusCode: 413, message: 'request entity too large' })
    expect(received).toEqual([])
  })

  it('keeps other body-parser errors as they were: 415 for an unsupported charset', async () => {
    const { server, received } = await createApp()

    const response = await request(server)
      .post(probePath)
      .set('Content-Type', 'application/json; charset=fixture-charset')
      .send('{"a":1}')

    expect(response.status).toBe(415)
    expect(response.body.statusCode).toBe(415)
    expect(received).toEqual([])
  })

  it('registers exactly one JSON parser, replacing the Nest default instead of adding another', async () => {
    const { app } = await createApp()

    const stack: ReadonlyArray<{ handle: { name: string } }> = app.getHttpAdapter().getInstance()
      .router.stack
    expect(stack.filter((layer) => layer.handle.name === 'jsonParser')).toHaveLength(1)
  })

  it('rejects malformed JSON on a session path before looking up the session, like main.ts', async () => {
    const { server, received, ensureConnected } = await createApp({ withSession: true })

    const response = await postJson(server, `password=${secret}`, '/api/v1/auth/json-probe').set(
      'Cookie',
      sessionCookie('fixture-session-id'),
    )

    expect(response.status).toBe(400)
    expect(response.body).toStrictEqual(malformedJsonResponse)
    expect(received).toEqual([])
    expect(ensureConnected).not.toHaveBeenCalled()
  })
})
