import 'reflect-metadata'
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

// 登录请求体 Schema 经 HTTP 的实际效果（M1-S23）：应用只经 configureApp 配置（与 main.ts 相同），
// 再挂一个只在本测试里存在的 Controller，用 @Body({ schema: LoginBodySchema }) 接收。
// 不合格的请求必须在调用 Controller 之前返回 400；生成的 OpenAPI 里能看到这些规则。
const schemasModulePath = new URL('../src/modules/auth/schemas.ts', import.meta.url).href
const usernameModulePath = new URL('../src/modules/users/username.ts', import.meta.url).href
const probePath = '/api/v1/schema-probe/login'

const validPassword = 'fixture-passw0rd'

let app: NestExpressApplication | undefined

afterEach(async () => {
  try {
    await app?.close()
  } finally {
    app = undefined
    vi.restoreAllMocks()
  }
})

async function createApp() {
  const schemas = await import(schemasModulePath)
  expect(schemas.LoginBodySchema?.['~standard']?.vendor).toBe('zod')
  const { LoginBodySchema } = schemas

  // Controller 收到的每个请求体都记在这里；400 的请求不应该出现。
  const received: unknown[] = []

  @Controller('schema-probe')
  class LoginBodyProbeController {
    @Post('login')
    @HttpCode(200)
    login(@Body({ schema: LoginBodySchema }) body: unknown): { ok: true } {
      received.push(body)
      return { ok: true }
    }
  }

  const initialize = vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('Schema validation tests must not initialize the database')
  })
  const ensureConnected = vi.fn().mockRejectedValue(new Error('database unavailable'))
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [LoginBodyProbeController],
  })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .compile()
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
  configureApp(app)
  await app.init()
  return { app, server: app.getHttpServer(), received, ensureConnected, initialize }
}

describe('login body validation through configureApp', () => {
  it('passes a valid body to the controller with extra fields dropped and the password unchanged', async () => {
    const { server, received, ensureConnected, initialize } = await createApp()
    const spacedPassword = '  fixture passw0rd  '

    const response = await request(server).post(probePath).send({
      username: '  Demo_A ',
      password: spacedPassword,
      userId: '00000000-0000-4000-8000-000000000000',
    })

    expect(response.status).toBe(200)
    expect(received).toStrictEqual([{ username: 'Demo_A', password: spacedPassword }])
    expect(ensureConnected).not.toHaveBeenCalled()
    expect(initialize).not.toHaveBeenCalled()
  })

  it.each([
    ['12 ASCII characters', 'p'.repeat(12)],
    ['128 ASCII characters', 'p'.repeat(128)],
    ['12 emoji', '😀'.repeat(12)],
    ['128 emoji', '😀'.repeat(128)],
    ['Chinese characters', '中文密码中文密码中文密码'],
  ])('accepts a password of %s', async (_case, password) => {
    const { server, received } = await createApp()

    const response = await request(server).post(probePath).send({ username: 'demo_a', password })

    expect(response.status).toBe(200)
    expect(received).toStrictEqual([{ username: 'demo_a', password }])
  })

  // 每一行：情况、请求体、报错里应提到的字段、不应原样出现在响应里的值。
  it.each([
    ['the username is too short', { username: 'de', password: validPassword }, 'username', null],
    [
      'the username has a hyphen',
      { username: 'fixture-user', password: validPassword },
      'username',
      'fixture-user',
    ],
    [
      'the username is the Kelvin sign spelling',
      { username: '\u212Aate', password: validPassword },
      'username',
      null,
    ],
    ['the username is a number', { username: 1234, password: validPassword }, 'username', null],
    ['the username is missing', { password: validPassword }, 'username', null],
    [
      'the password has 11 characters',
      { username: 'demo_a', password: 'fixture-p11' },
      'password',
      'fixture-p11',
    ],
    [
      'the password has 129 characters',
      { username: 'demo_a', password: `fixture-${'p'.repeat(121)}` },
      'password',
      `fixture-${'p'.repeat(121)}`,
    ],
    [
      'the password is 6 emoji (12 UTF-16 units)',
      { username: 'demo_a', password: '😀'.repeat(6) },
      'password',
      '😀'.repeat(6),
    ],
    ['the password is missing', { username: 'demo_a' }, 'password', null],
    ['the password is null', { username: 'demo_a', password: null }, 'password', null],
  ])('returns 400 without calling the controller when %s', async (_case, body, field, secret) => {
    const { server, received, ensureConnected } = await createApp()

    const response = await request(server).post(probePath).send(body)

    expect(response.status).toBe(400)
    expect(received).toEqual([])
    expect(ensureConnected).not.toHaveBeenCalled()
    const text = JSON.stringify(response.body)
    expect(text).toContain(field)
    if (secret) expect(text).not.toContain(secret)
  })

  it.each([
    ['no body at all', (test: request.Test) => test],
    ['a text/plain body', (test: request.Test) => test.set('Content-Type', 'text/plain').send('x')],
    ['a JSON array', (test: request.Test) => test.send([{ username: 'demo_a' }])],
    [
      'a JSON string',
      (test: request.Test) => test.set('Content-Type', 'application/json').send('"demo_a"'),
    ],
  ])('returns 400 without calling the controller for %s', async (_case, build) => {
    const { server, received } = await createApp()

    const response = await build(request(server).post(probePath))

    expect(response.status).toBe(400)
    expect(received).toEqual([])
  })

  it('leaves GET /api/v1/health at 200 with the global pipe installed', async () => {
    const { server, ensureConnected } = await createApp()

    const response = await request(server).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(ensureConnected).not.toHaveBeenCalled()
  })
})

describe('login body schema in the generated OpenAPI document', () => {
  it('describes both fields, the shared username pattern and the password length limits', async () => {
    const { app } = await createApp()
    const { USERNAME_PATTERN } = await import(usernameModulePath)
    expect(USERNAME_PATTERN).toBeInstanceOf(RegExp)

    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build())

    expect(document.paths[probePath]?.post?.requestBody).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              username: { type: 'string', pattern: USERNAME_PATTERN.source },
              password: { type: 'string', minLength: 12, maxLength: 128 },
            },
            required: ['username', 'password'],
          },
        },
      },
    })
  })
})
