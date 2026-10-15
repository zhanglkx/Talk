import 'reflect-metadata'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import type { Client } from 'pg'
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { validateEnvironment } from '../../src/config/validate-environment.js'
import { DatabaseModule } from '../../src/database/database.module.js'
import { startSessionWindow, touchSessionWindow } from '../../src/modules/auth/session-lifecycle.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

const authModulePath = new URL('../../src/modules/auth/auth.module.ts', import.meta.url).href
const sessionsRepositoryPath = new URL(
  '../../src/modules/auth/sessions.repository.ts',
  import.meta.url,
).href

type SessionWindow = { lastSeenAt: Date; idleExpiresAt: Date; absoluteExpiresAt: Date }
type SessionData = { csrfToken: string }
type SessionRecord = { userId: string; data: SessionData; window: SessionWindow }
type SessionsRepositoryLike = {
  create(sessionId: string, record: SessionRecord): Promise<void>
  findActive(sessionId: string, now: Date): Promise<SessionRecord | null>
  update(sessionId: string, changes: { data: SessionData; window: SessionWindow }): Promise<boolean>
  delete(sessionId: string): Promise<void>
}

const HOUR = 60 * 60 * 1000
const loginAt = new Date('2026-10-15T08:00:00.000Z')
const at = (offsetMs: number) => new Date(loginAt.getTime() + offsetMs)
const alice = { id: randomUUID(), username: 'fixture_alice' }
const bob = { id: randomUUID(), username: 'fixture_bob' }

let client: Client | undefined
let moduleRef: TestingModule | undefined
let repository: SessionsRepositoryLike | undefined

function sessions(): SessionsRepositoryLike {
  if (!repository) throw new Error('SessionsRepository is not available')
  return repository
}

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

// 和以后真实的会话 ID 一样：随机 32 字节，base64url 编码。
function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}

// 测试自己算一遍 SHA-256，不依赖被测代码的 hashSessionId。
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function freshRecord(userId: string): SessionRecord {
  return { userId, data: { csrfToken: randomUUID() }, window: startSessionWindow(loginAt) }
}

async function storedRow(sessionId: string) {
  const result = await database().query<{ user_id: string; data: SessionData }>(
    'SELECT user_id, data FROM sessions WHERE session_key_hash = $1',
    [sha256(sessionId)],
  )
  return result.rows[0]
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
  for (const user of [alice, bob]) {
    await client.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
      user.id,
      user.username,
      '$argon2id$fixture-not-a-real-hash',
    ])
  }

  const { AuthModule } = await import(authModulePath)
  const { SessionsRepository } = await import(sessionsRepositoryPath)
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      AuthModule,
    ],
  }).compile()
  await moduleRef.init()
  repository = moduleRef.get<SessionsRepositoryLike>(SessionsRepository)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  // 关闭容器释放连接池，下一个测试文件才能重建 ledger_it。
  await moduleRef?.close()
  await client?.end()
})

describe('SessionsRepository on a real PostgreSQL database', () => {
  it('stores only the SHA-256 digest of the session id', async () => {
    const sessionId = newSessionId()
    await sessions().create(sessionId, freshRecord(alice.id))

    const byDigest = await database().query<{ count: string }>(
      'SELECT count(*) AS count FROM sessions WHERE session_key_hash = $1',
      [sha256(sessionId)],
    )
    const leaked = await database().query<{ count: string }>(
      `SELECT count(*) AS count FROM sessions
        WHERE session_key_hash = $1::text OR position($1::text IN data::text) > 0`,
      [sessionId],
    )
    expect(byDigest.rows[0]?.count).toBe('1')
    expect(leaked.rows[0]?.count).toBe('0')
  })

  it('reads an active session back as a plain record', async () => {
    const sessionId = newSessionId()
    const record = freshRecord(alice.id)
    await sessions().create(sessionId, record)

    await expect(sessions().findActive(sessionId, at(HOUR))).resolves.toStrictEqual(record)
  })

  it('returns null at the deadline, after it, and for an unknown id', async () => {
    const sessionId = newSessionId()
    await sessions().create(sessionId, freshRecord(alice.id))

    await expect(sessions().findActive(sessionId, at(12 * HOUR - 1))).resolves.not.toBeNull()
    await expect(sessions().findActive(sessionId, at(12 * HOUR))).resolves.toBeNull()
    await expect(sessions().findActive(sessionId, at(13 * HOUR))).resolves.toBeNull()
    await expect(sessions().findActive(newSessionId(), at(HOUR))).resolves.toBeNull()
  })

  it('updates the data and the window of an existing session', async () => {
    const sessionId = newSessionId()
    const record = freshRecord(alice.id)
    await sessions().create(sessionId, record)
    const changes = {
      data: { csrfToken: randomUUID() },
      window: touchSessionWindow(record.window, at(6 * HOUR)),
    }

    await expect(sessions().update(sessionId, changes)).resolves.toBe(true)

    // 原来的闲置截止（12 小时）已过，续期后的会话仍然有效。
    await expect(sessions().findActive(sessionId, at(12 * HOUR + 1))).resolves.toStrictEqual({
      userId: alice.id,
      ...changes,
    })
  })

  it('never changes which user a session belongs to', async () => {
    const sessionId = newSessionId()
    const record = freshRecord(alice.id)
    await sessions().create(sessionId, record)
    // 模拟调用方误把 userId 混进更新内容；实现只能写 data 和三个时间。
    const changes = { data: record.data, window: record.window, userId: bob.id }

    await sessions().update(sessionId, changes as never)

    expect((await storedRow(sessionId))?.user_id).toBe(alice.id)
  })

  it('reports false and creates nothing when updating an unknown session', async () => {
    const sessionId = newSessionId()
    const record = freshRecord(alice.id)

    await expect(sessions().update(sessionId, record)).resolves.toBe(false)

    expect(await storedRow(sessionId)).toBeUndefined()
  })

  it('deletes one session, leaves the others and tolerates a repeated delete', async () => {
    const aliceSession = newSessionId()
    const bobSession = newSessionId()
    await sessions().create(aliceSession, freshRecord(alice.id))
    await sessions().create(bobSession, freshRecord(bob.id))

    await sessions().delete(aliceSession)
    await expect(sessions().delete(aliceSession)).resolves.toBeUndefined()

    await expect(sessions().findActive(aliceSession, at(HOUR))).resolves.toBeNull()
    await expect(sessions().findActive(bobSession, at(HOUR))).resolves.toMatchObject({
      userId: bob.id,
    })
  })

  it('refuses a session for a user that does not exist', async () => {
    const sessionId = newSessionId()

    await expect(sessions().create(sessionId, freshRecord(randomUUID()))).rejects.toMatchObject({
      code: '23503',
    })
    expect(await storedRow(sessionId)).toBeUndefined()
  })

  it('refuses to create a second session with the same id', async () => {
    const sessionId = newSessionId()
    await sessions().create(sessionId, freshRecord(alice.id))

    await expect(sessions().create(sessionId, freshRecord(bob.id))).rejects.toMatchObject({
      code: '23505',
    })
    expect((await storedRow(sessionId))?.user_id).toBe(alice.id)
  })

  it('never sends the plain session id to the database', async () => {
    const query = vi.spyOn(PostgresQueryRunner.prototype, 'query')
    const sessionId = newSessionId()
    const record = freshRecord(alice.id)

    await sessions().create(sessionId, record)
    await sessions().findActive(sessionId, at(HOUR))
    await sessions().update(sessionId, record)
    await sessions().delete(sessionId)

    expect(query.mock.calls.length).toBeGreaterThan(0)
    const sent = JSON.stringify(query.mock.calls.map((call) => [call[0], call[1]]))
    expect(sent).not.toContain(sessionId)
    expect(sent).toContain(sha256(sessionId))
  })
})
