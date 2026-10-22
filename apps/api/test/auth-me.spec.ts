import 'reflect-metadata'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import {
  alice,
  authenticationRequired,
  bob,
  closeAuthApps,
  createAuthApp,
  HOUR,
  issuedSessionId,
  sessionCookie,
  storedSession,
} from './support/auth-app.js'

// GET /api/v1/auth/me（M1-S25）：身份只来自会话里的 userId，经 AuthService 查出公开身份，
// 连同会话里的 CSRF token 一起返回。未登录、会话过期、用户不存在都是同一个 401。
const mePath = '/api/v1/auth/me'
const aliceSessionId = 'fixture-alice-session'
const bobSessionId = 'fixture-bob-session'

afterEach(closeAuthApps)

function me(server: Parameters<typeof request>[0], cookie?: string) {
  const test = request(server).get(mePath)
  return cookie ? test.set('Cookie', cookie) : test
}

describe('GET /api/v1/auth/me with a valid session', () => {
  it('returns exactly { user, csrfToken } with no-store and does not reissue the cookie', async () => {
    const { server, sessions, findSessionUser } = await createAuthApp()
    sessions.rows.set(aliceSessionId, storedSession(alice.id, { csrfToken: 'fixture-alice-csrf' }))

    const response = await me(server, sessionCookie(aliceSessionId))

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({ user: alice, csrfToken: 'fixture-alice-csrf' })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(findSessionUser).toHaveBeenCalledExactlyOnceWith(alice.id)
  })

  it('counts as activity: extends the idle deadline but not the absolute one, keeping the token', async () => {
    const { server, sessions, loggedAfterResponse } = await createAuthApp()
    const original = storedSession(alice.id, { csrfToken: 'fixture-alice-csrf' })
    sessions.rows.set(aliceSessionId, original)
    const before = Date.now()

    const response = await me(server, sessionCookie(aliceSessionId))

    const after = Date.now()
    expect(response.status).toBe(200)
    const row = sessions.rows.get(aliceSessionId)
    expect(row?.window.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(row?.window.lastSeenAt.getTime()).toBeLessThanOrEqual(after)
    expect(row?.window.idleExpiresAt.getTime()).toBe(
      (row?.window.lastSeenAt.getTime() ?? 0) + 12 * HOUR,
    )
    expect(row?.window.absoluteExpiresAt).toEqual(original.window.absoluteExpiresAt)
    // me 只读不改：不换 token、不新建会话、不改归属。
    expect(row?.data).toStrictEqual({ csrfToken: 'fixture-alice-csrf' })
    expect(row?.userId).toBe(alice.id)
    expect(sessions.create).not.toHaveBeenCalled()
    expect(await loggedAfterResponse()).toBe(0)
  })

  it('ignores a userId in the query string, a header or a JSON body', async () => {
    const { server, sessions, findSessionUser } = await createAuthApp()
    sessions.rows.set(aliceSessionId, storedSession(alice.id))

    const response = await request(server)
      .get(`${mePath}?userId=${bob.id}`)
      .set('Cookie', sessionCookie(aliceSessionId))
      .set('X-User-Id', bob.id)
      .send({ userId: bob.id })

    expect(response.status).toBe(200)
    expect(response.body.user).toStrictEqual(alice)
    expect(findSessionUser).toHaveBeenCalledExactlyOnceWith(alice.id)
  })

  it('gives alice and bob their own identity and token', async () => {
    const { server, sessions } = await createAuthApp()
    sessions.rows.set(aliceSessionId, storedSession(alice.id, { csrfToken: 'fixture-alice-csrf' }))
    sessions.rows.set(bobSessionId, storedSession(bob.id, { csrfToken: 'fixture-bob-csrf' }))

    const asAlice = await me(server, sessionCookie(aliceSessionId))
    const asBob = await me(server, sessionCookie(bobSessionId))

    expect(asAlice.body).toStrictEqual({ user: alice, csrfToken: 'fixture-alice-csrf' })
    expect(asBob.body).toStrictEqual({ user: bob, csrfToken: 'fixture-bob-csrf' })
  })

  it('works with the cookie issued by login and returns the CSRF token stored at login', async () => {
    const { server, sessions, verifyCredentials } = await createAuthApp()
    verifyCredentials.mockResolvedValue(alice)

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: alice.username, password: 'fixture-passw0rd' })
    const sessionId = issuedSessionId(login)
    if (!sessionId) throw new Error('login did not issue a session cookie')
    const first = await me(server, sessionCookie(sessionId))
    const second = await me(server, sessionCookie(sessionId))

    const stored = sessions.rows.get(sessionId)?.data.csrfToken
    expect(stored).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.body).toStrictEqual({ user: alice, csrfToken: stored })
    // 每次 me 返回同一个 token：token 在登录时生成，me 不重新生成。
    expect(second.body).toStrictEqual(first.body)
  })
})

describe('GET /api/v1/auth/me without a valid session', () => {
  it('answers a request without a cookie with 401 and no cookie', async () => {
    const { server, findSessionUser, sessions } = await createAuthApp()

    const response = await me(server)

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(findSessionUser).not.toHaveBeenCalled()
    expect(sessions.create).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown session', undefined, undefined],
    [
      'an idle-expired session',
      storedSession(alice.id, {
        lastSeenAt: new Date(Date.now() - 13 * HOUR),
        idleExpiresAt: new Date(Date.now() - 1000),
      }),
      undefined,
    ],
    [
      'an absolutely expired session',
      storedSession(alice.id, {
        idleExpiresAt: new Date(Date.now() + 11 * HOUR),
        absoluteExpiresAt: new Date(Date.now() - 1000),
      }),
      undefined,
    ],
    [
      'a cookie signed with another secret',
      storedSession(alice.id),
      'fixture-some-other-secret-0000000000',
    ],
  ])('answers %s with the same 401, no cookie and no change', async (_case, row, secret) => {
    const { server, findSessionUser, sessions } = await createAuthApp()
    if (row) sessions.rows.set(aliceSessionId, row)

    const response = await me(server, sessionCookie(aliceSessionId, secret))

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(findSessionUser).not.toHaveBeenCalled()
    // 过期的会话不会被续期或重新建出来。
    expect(sessions.update).not.toHaveBeenCalled()
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.rows.get(aliceSessionId)).toEqual(row)
  })

  it('treats a session whose user no longer exists as invalid: the same 401', async () => {
    const { server, findSessionUser, sessions } = await createAuthApp()
    sessions.rows.set(aliceSessionId, storedSession(alice.id))
    findSessionUser.mockResolvedValue(null)

    const response = await me(server, sessionCookie(aliceSessionId))

    expect(response.status).toBe(401)
    expect(response.body).toStrictEqual(authenticationRequired)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(findSessionUser).toHaveBeenCalledExactlyOnceWith(alice.id)
  })
})

describe('GET /api/v1/auth/me when a dependency fails', () => {
  it('fails with a server error, not 401, when the session cannot be looked up', async () => {
    const { server, findSessionUser, sessions } = await createAuthApp()
    sessions.findActive.mockRejectedValue(new Error('fixture session lookup failure'))

    const response = await me(server, sessionCookie(aliceSessionId))

    // 数据库出错不能说成「没登录」；映射成 503 留到 M1-T08。
    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(response.text).not.toContain('fixture session lookup failure')
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(findSessionUser).not.toHaveBeenCalled()
  })

  it('fails with a server error, not 401, when the user cannot be looked up', async () => {
    const { server, findSessionUser, sessions } = await createAuthApp()
    sessions.rows.set(aliceSessionId, storedSession(alice.id))
    findSessionUser.mockRejectedValue(new Error('fixture user lookup failure'))

    const response = await me(server, sessionCookie(aliceSessionId))

    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(response.text).not.toContain('fixture user lookup failure')
    expect(response.headers['set-cookie']).toBeUndefined()
  })
})

describe('GET /api/v1/auth/me in the generated OpenAPI document', () => {
  it('describes the 200 response schema and the 401 response, without a request body', async () => {
    const { app } = await createAuthApp()

    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build())
    const operation = document.paths[mePath]?.get

    expect(operation?.operationId).toBe('AuthController_me')
    expect(operation?.requestBody).toBeUndefined()
    expect(operation?.parameters ?? []).toEqual([])
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '401'])
    const ok = operation?.responses['200'] as {
      content?: Record<string, { schema?: Record<string, unknown> }>
    }
    const schema = ok.content?.['application/json']?.schema
    expect(schema).toMatchObject({
      type: 'object',
      required: ['user', 'csrfToken'],
      additionalProperties: false,
      properties: {
        user: {
          type: 'object',
          required: ['id', 'username'],
          additionalProperties: false,
          properties: { id: { type: 'string', format: 'uuid' }, username: { type: 'string' } },
        },
        csrfToken: { type: 'string' },
      },
    })
    const properties = schema?.properties as Record<string, { properties?: object }>
    expect(Object.keys(properties)).toEqual(['user', 'csrfToken'])
    expect(Object.keys(properties.user?.properties ?? {})).toEqual(['id', 'username'])
  })
})
