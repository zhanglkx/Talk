import 'reflect-metadata'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import session from 'express-session'
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateEnvironment } from '../../src/config/validate-environment.js'
import { DatabaseModule } from '../../src/database/database.module.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

// 真实 SessionsRepository + express-session 自带的 load/save/destroy，确认两边能接上。
const authModulePath = new URL('../../src/modules/auth/auth.module.ts', import.meta.url).href
const sessionsRepositoryPath = new URL(
  '../../src/modules/auth/sessions.repository.ts',
  import.meta.url,
).href
const storeModulePath = new URL('../../src/modules/auth/session-store.ts', import.meta.url).href

type StoredSession = Record<string, unknown>
type Callback = (err?: unknown, value?: unknown) => void
type StoreLike = {
  set(sid: string, sess: StoredSession, callback?: Callback): void
  touch(sid: string, sess: StoredSession, callback?: Callback): void
  destroy(sid: string, callback?: Callback): void
  load(sid: string, callback: Callback): void
}

const HOUR = 60 * 60 * 1000
const loginAt = new Date('2026-10-15T08:00:00.000Z')
const at = (offsetMs: number) => new Date(loginAt.getTime() + offsetMs)
const cookieOptions = { path: '/', httpOnly: true, secure: false, sameSite: 'lax' as const }
const alice = { id: randomUUID(), username: 'fixture_alice' }

let client: Client | undefined
let moduleRef: TestingModule | undefined
let store: StoreLike | undefined
let currentTime = loginAt

function sessionStore(): StoreLike {
  if (!store) throw new Error('Session store is not available')
  return store
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function promised<T = unknown>(run: (callback: Callback) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    run((err, value) => (err ? reject(err) : resolve(value as T)))
  })
}

async function rowCount(sessionId: string): Promise<number> {
  if (!client) throw new Error('Test database client is not connected')
  const result = await client.query<{ count: string }>(
    'SELECT count(*) AS count FROM sessions WHERE session_key_hash = $1',
    [sha256(sessionId)],
  )
  return Number(result.rows[0]?.count)
}

async function loadSession(sessionId: string) {
  return promised<(session.Session & StoredSession) | undefined>((callback) =>
    sessionStore().load(sessionId, callback),
  )
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
  await client.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
    alice.id,
    alice.username,
    '$argon2id$fixture-not-a-real-hash',
  ])

  const { AuthModule } = await import(authModulePath)
  const { SessionsRepository } = await import(sessionsRepositoryPath)
  const { PostgresSessionStore } = await import(storeModulePath)
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      AuthModule,
    ],
  }).compile()
  await moduleRef.init()
  store = new PostgresSessionStore(
    moduleRef.get(SessionsRepository),
    cookieOptions,
    () => currentTime,
  )
})

afterAll(async () => {
  // 关闭容器释放连接池，下一个测试文件才能重建 ledger_it。
  await moduleRef?.close()
  await client?.end()
})

describe('PostgresSessionStore on a real PostgreSQL database', () => {
  it('saves, loads, touches and destroys a session through express-session', async () => {
    const sessionId = randomBytes(32).toString('base64url')
    currentTime = loginAt
    await promised((callback) =>
      sessionStore().set(
        sessionId,
        { cookie: { ...cookieOptions }, userId: alice.id, csrfToken: 'fixture-csrf-token' },
        callback,
      ),
    )
    expect(await rowCount(sessionId)).toBe(1)

    currentTime = at(6 * HOUR)
    const loaded = await loadSession(sessionId)
    expect(loaded).toBeInstanceOf(session.Session)
    expect(loaded?.userId).toBe(alice.id)
    expect(loaded?.csrfToken).toBe('fixture-csrf-token')
    await promised((callback) => sessionStore().touch(sessionId, loaded ?? {}, callback))

    // 原来的闲置截止（12 小时）已过，续期后仍能读到。
    currentTime = at(12 * HOUR + 1)
    expect((await loadSession(sessionId))?.userId).toBe(alice.id)

    await promised((callback) => sessionStore().destroy(sessionId, callback))
    expect(await loadSession(sessionId)).toBeUndefined()
    expect(await rowCount(sessionId)).toBe(0)
  })

  it('does not recreate a session that was destroyed after this request loaded it', async () => {
    const sessionId = randomBytes(32).toString('base64url')
    currentTime = loginAt
    await promised((callback) =>
      sessionStore().set(
        sessionId,
        { cookie: { ...cookieOptions }, userId: alice.id, csrfToken: 'fixture-csrf-token' },
        callback,
      ),
    )
    const loaded = await loadSession(sessionId)
    if (!loaded) throw new Error('Expected the session to load')

    // 另一个请求退出登录；随后本请求修改会话并保存（express-session 会调用 set）。
    await promised((callback) => sessionStore().destroy(sessionId, callback))
    loaded.csrfToken = 'fixture-rotated-token'
    await promised((callback) => loaded.save(callback))

    expect(await rowCount(sessionId)).toBe(0)
    expect(await loadSession(sessionId)).toBeUndefined()
  })
})
