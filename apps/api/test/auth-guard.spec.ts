import 'reflect-metadata'
import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext, HttpException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import request from 'supertest'
import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  alice,
  authenticationRequired,
  closeAuthApps,
  createAuthApp,
  HOUR,
  sessionCookie,
  storedSession,
} from './support/auth-app.js'

// 全局 AuthGuard（M1-S25）：默认每个接口都要登录，只有标了 @Public() 的放行。
// 身份只看会话里的 userId；拒绝时是 401，不是 Nest 在 canActivate 返回 false 时给的 403。
const guardModulePath = new URL('../src/common/guards/auth.guard.ts', import.meta.url).href
const controllerModulePath = new URL('../src/modules/auth/auth.controller.ts', import.meta.url).href

type AuthGuardLike = { canActivate(context: ExecutionContext): boolean | Promise<boolean> }
type GuardModule = {
  AuthGuard: new (reflector: Reflector) => AuthGuardLike
  Public: () => ClassDecorator & MethodDecorator
}

async function loadGuards(): Promise<GuardModule> {
  const guards = await import(guardModulePath)
  expect(guards.AuthGuard).toBeTypeOf('function')
  expect(guards.Public).toBeTypeOf('function')
  return guards
}

afterEach(closeAuthApps)

// 只实现 Guard 会用到的几个方法；getRequest 记下是否被读取。
function httpContext(
  request: unknown,
  { handler = function handler() {}, cls = class Target {} as Function } = {},
) {
  const getRequest = vi.fn(() => request)
  const context = {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => cls,
    getArgs: () => [request, {}, () => undefined],
    getArgByIndex: (index: number) => [request, {}, () => undefined][index],
    switchToHttp: () => ({ getRequest, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext
  return { context, getRequest }
}

async function rejection(guard: AuthGuardLike, context: ExecutionContext): Promise<unknown> {
  try {
    const allowed = await guard.canActivate(context)
    return new Error(`Expected a rejection, got ${String(allowed)}`)
  } catch (error) {
    return error
  }
}

describe('AuthGuard.canActivate', () => {
  it('allows a request whose session carries a string userId', async () => {
    const { AuthGuard } = await loadGuards()
    const guard = new AuthGuard(new Reflector())

    const { context } = httpContext({ session: { userId: alice.id, csrfToken: 'fixture-token' } })

    await expect(Promise.resolve(guard.canActivate(context))).resolves.toBe(true)
  })

  it.each([
    ['there is no session at all', {}],
    ['the session is null', { session: null }],
    ['the session has no userId', { session: { csrfToken: 'fixture-token' } }],
    ['the userId is a number', { session: { userId: 42 } }],
    ['the userId is an object', { session: { userId: { id: alice.id } } }],
  ])('throws a 401 UnauthorizedException when %s', async (_case, request) => {
    const { AuthGuard } = await loadGuards()
    const guard = new AuthGuard(new Reflector())

    const error = await rejection(guard, httpContext(request).context)

    // 返回 false 的话 Nest 回的是 403 Forbidden resource；PRD 要求未登录是 401。
    expect(error).toBeInstanceOf(UnauthorizedException)
    expect((error as HttpException).getResponse()).toStrictEqual(authenticationRequired)
  })

  it('does not take the identity from the query, headers or body', async () => {
    const { AuthGuard } = await loadGuards()
    const guard = new AuthGuard(new Reflector())
    const forged = {
      session: {},
      query: { userId: alice.id },
      headers: { 'x-user-id': alice.id },
      body: { userId: alice.id },
      user: { id: alice.id },
      userId: alice.id,
    }

    expect(await rejection(guard, httpContext(forged).context)).toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('lets a handler marked @Public() through without reading the request', async () => {
    const { AuthGuard, Public } = await loadGuards()
    class Target {
      @Public()
      open() {}
      closed() {}
    }
    const guard = new AuthGuard(new Reflector())

    const open = httpContext({}, { handler: Target.prototype.open, cls: Target })
    const closed = httpContext({}, { handler: Target.prototype.closed, cls: Target })

    await expect(Promise.resolve(guard.canActivate(open.context))).resolves.toBe(true)
    expect(open.getRequest).not.toHaveBeenCalled()
    // 标记只对那一个方法生效，同一个类里的其他方法照样要登录。
    expect(await rejection(guard, closed.context)).toBeInstanceOf(UnauthorizedException)
  })

  it('lets every handler of a class marked @Public() through', async () => {
    const { AuthGuard, Public } = await loadGuards()
    @Public()
    class Target {
      anything() {}
    }
    const guard = new AuthGuard(new Reflector())

    const { context } = httpContext({}, { handler: Target.prototype.anything, cls: Target })

    await expect(Promise.resolve(guard.canActivate(context))).resolves.toBe(true)
  })

  it('leaves login open and protects me in AuthController itself', async () => {
    const { AuthGuard } = await loadGuards()
    const { AuthController } = await import(controllerModulePath)
    expect(AuthController.prototype.login).toBeTypeOf('function')
    expect(AuthController.prototype.me).toBeTypeOf('function')
    const guard = new AuthGuard(new Reflector())

    const login = httpContext({}, { handler: AuthController.prototype.login, cls: AuthController })
    const me = httpContext({}, { handler: AuthController.prototype.me, cls: AuthController })

    await expect(Promise.resolve(guard.canActivate(login.context))).resolves.toBe(true)
    // 只给 login 方法标 @Public()，不给整个 AuthController 标：否则 me 和以后的退出都会对匿名请求开放。
    expect(await rejection(guard, me.context)).toBeInstanceOf(UnauthorizedException)
  })
})

// 用真实应用验证 Guard 是全局注册的：下面两个 Controller 只在测试里存在，AuthModule 不知道它们。
async function createProbeApp() {
  const { Public } = await loadGuards()
  const reached: string[] = []

  @Controller()
  class ProtectedProbeController {
    // 在会话路径下：有会话中间件。
    @Get('auth/guard-probe')
    protectedInSessionPath(@Req() request: Express.Request): { userId: unknown } {
      reached.push('auth/guard-probe')
      return { userId: request.session.userId }
    }

    // 不在会话路径下：没有会话中间件，也就永远没有身份。
    @Get('guard-probe')
    protectedOutsideSessionPath(): { ok: true } {
      reached.push('guard-probe')
      return { ok: true }
    }

    @Post('auth/guard-probe')
    @HttpCode(200)
    protectedWithBody(@Body({ schema: z.object({ name: z.string().min(3) }) }) body: unknown) {
      reached.push('POST auth/guard-probe')
      return { body }
    }
  }

  @Public()
  @Controller('public-probe')
  class PublicProbeController {
    @Get()
    open(): { ok: true } {
      reached.push('public-probe')
      return { ok: true }
    }
  }

  const created = await createAuthApp({
    controllers: [ProtectedProbeController, PublicProbeController],
  })
  return { ...created, reached }
}

describe('AuthGuard registered globally', () => {
  it('rejects an anonymous request to a controller outside AuthModule with 401, not 403', async () => {
    const { server, reached, sessions } = await createProbeApp()

    const response = await request(server).get('/api/v1/auth/guard-probe')

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(reached).toEqual([])
    expect(sessions.create).not.toHaveBeenCalled()
  })

  it('lets a request with a valid session through, with the userId from the session', async () => {
    const { server, reached, sessions } = await createProbeApp()
    sessions.rows.set('fixture-alice-session', storedSession(alice.id))

    const response = await request(server)
      .get('/api/v1/auth/guard-probe')
      .set('Cookie', sessionCookie('fixture-alice-session'))

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ userId: alice.id })
    expect(reached).toEqual(['auth/guard-probe'])
  })

  it.each([
    ['an unknown session', undefined],
    [
      'an idle-expired session',
      storedSession(alice.id, {
        lastSeenAt: new Date(Date.now() - 13 * HOUR),
        idleExpiresAt: new Date(Date.now() - HOUR),
      }),
    ],
    [
      'an absolutely expired session',
      storedSession(alice.id, {
        lastSeenAt: new Date(Date.now() - HOUR),
        idleExpiresAt: new Date(Date.now() + 11 * HOUR),
        absoluteExpiresAt: new Date(Date.now() - 1000),
      }),
    ],
  ])('rejects %s with 401 and issues no cookie', async (_case, row) => {
    const { server, reached, sessions } = await createProbeApp()
    if (row) sessions.rows.set('fixture-alice-session', row)

    const response = await request(server)
      .get('/api/v1/auth/guard-probe')
      .set('Cookie', sessionCookie('fixture-alice-session'))

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(reached).toEqual([])
  })

  it('rejects a cookie signed with another secret without looking up the session', async () => {
    const { server, reached, sessions } = await createProbeApp()
    sessions.rows.set('fixture-alice-session', storedSession(alice.id))

    const response = await request(server)
      .get('/api/v1/auth/guard-probe')
      .set('Cookie', sessionCookie('fixture-alice-session', 'fixture-some-other-secret-0000000000'))

    expect(response.status).toBe(401)
    expect(sessions.findActive).not.toHaveBeenCalled()
    expect(reached).toEqual([])
  })

  it('rejects a route outside the session paths even with a valid cookie, without a lookup', async () => {
    const { server, reached, sessions } = await createProbeApp()
    sessions.rows.set('fixture-alice-session', storedSession(alice.id, { lastSeenAt: new Date() }))

    const response = await request(server)
      .get('/api/v1/guard-probe')
      .set('Cookie', sessionCookie('fixture-alice-session'))

    // 没有会话中间件就没有 req.session：忘了把新的业务路径加进 SESSION_PATHS，会立刻得到 401。
    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(sessions.findActive).not.toHaveBeenCalled()
    expect(reached).toEqual([])
  })

  it('answers an anonymous request with an invalid body with 401 before validating it', async () => {
    const { server, reached } = await createProbeApp()

    const response = await request(server).post('/api/v1/auth/guard-probe').send({ name: 'x' })

    // Guard 先于 Pipe：没登录的人看不到这个接口要求什么样的请求体。
    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(reached).toEqual([])
  })

  it('lets anonymous requests reach a controller marked @Public()', async () => {
    const { server, reached } = await createProbeApp()

    const response = await request(server).get('/api/v1/public-probe')

    expect(response.status).toBe(200)
    expect(reached).toEqual(['public-probe'])
  })

  it('keeps health, ready and login open to anonymous requests', async () => {
    const { server, verifyCredentials } = await createProbeApp()
    verifyCredentials.mockResolvedValue(alice)

    const health = await request(server).get('/api/v1/health')
    const ready = await request(server).get('/internal/ready')
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: alice.username, password: 'fixture-passw0rd' })

    expect(health.status).toBe(200)
    expect(health.body).toEqual({ status: 'ok' })
    // 数据库不可用：ready 照常回答 503，而不是因为没登录被 401 挡住。
    expect(ready.status).toBe(503)
    expect(ready.body).toEqual({ status: 'not_ready' })
    expect(login.status).toBe(200)
    expect(login.body).toStrictEqual({ user: alice })
  })

  it('still answers 404 for an unknown route instead of 401', async () => {
    const { server } = await createProbeApp()

    const response = await request(server).get('/api/v1/no-such-route')

    expect(response.status).toBe(404)
  })
})
