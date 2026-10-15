import { createHash, randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectTestDatabase,
  prepareMigratedDatabase,
  withRolledBackTransaction,
} from './support/test-database.js'

// PostgreSQL 错误码：外键冲突、CHECK 冲突、唯一冲突、非空冲突、字符串超长。
const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'
const UNIQUE_VIOLATION = '23505'
const NOT_NULL_VIOLATION = '23502'
const STRING_TOO_LONG = '22001'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

type SessionRow = {
  session_key_hash: unknown
  user_id: unknown
  data: unknown
  last_seen_at: unknown
  idle_expires_at: unknown
  absolute_expires_at: unknown
}

let client: Client | undefined

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

function inRolledBackTransaction<T>(work: (db: Client) => Promise<T>): Promise<T> {
  return withRolledBackTransaction(database(), work)
}

// 和以后 Store 写入的格式一致：随机值的 SHA-256 摘要，64 个 16 进制字符。
function fixtureSessionKeyHash(): string {
  return createHash('sha256').update(randomUUID()).digest('hex')
}

async function insertFixtureUser(db: Client): Promise<string> {
  const id = randomUUID()
  await db.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
    id,
    `fixture_${id.slice(0, 8)}`,
    'fixture-not-a-real-hash',
  ])
  return id
}

// 一行合法的会话：闲置 30 分钟后到期，绝对期限 7 天；overrides 用来逐项改成非法值。
function fixtureSession(userId: unknown, overrides: Partial<SessionRow> = {}): SessionRow {
  const now = Date.now()
  return {
    session_key_hash: fixtureSessionKeyHash(),
    user_id: userId,
    data: { csrfToken: 'fixture-csrf-token' },
    last_seen_at: new Date(now),
    idle_expires_at: new Date(now + 30 * MINUTE),
    absolute_expires_at: new Date(now + 7 * DAY),
    ...overrides,
  }
}

function insertSession(db: Client, row: SessionRow) {
  return db.query(
    `INSERT INTO sessions
       (session_key_hash, user_id, data, last_seen_at, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      row.session_key_hash,
      row.user_id,
      row.data,
      row.last_seen_at,
      row.idle_expires_at,
      row.absolute_expires_at,
    ],
  )
}

beforeAll(async () => {
  // 先检查目标库再做任何连接；不是专用测试库、没有确认变量时这里就失败。
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
})

afterAll(async () => {
  await client?.end()
})

describe('sessions table on a real PostgreSQL database', () => {
  it('creates the columns with the planned types, lengths, nullability and defaults', async () => {
    const columns = await database().query(
      `SELECT column_name, data_type, character_maximum_length::int AS max_length,
              is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sessions'
        ORDER BY ordinal_position`,
    )
    const timestamp = { data_type: 'timestamp with time zone', max_length: null, is_nullable: 'NO' }

    expect(columns.rows).toEqual([
      {
        column_name: 'session_key_hash',
        data_type: 'character',
        max_length: 64,
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'user_id',
        data_type: 'uuid',
        max_length: null,
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'data',
        data_type: 'jsonb',
        max_length: null,
        is_nullable: 'NO',
        column_default: null,
      },
      { column_name: 'created_at', ...timestamp, column_default: 'now()' },
      { column_name: 'last_seen_at', ...timestamp, column_default: null },
      { column_name: 'idle_expires_at', ...timestamp, column_default: null },
      { column_name: 'absolute_expires_at', ...timestamp, column_default: null },
    ])
  })

  it('declares the primary key, the cascading foreign key to users and the expiry check', async () => {
    const constraints = await database().query<{
      contype: string
      name: string
      definition: string
    }>(
      `SELECT contype, conname AS name, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conrelid = 'public.sessions'::regclass AND contype IN ('p', 'f', 'c')
        ORDER BY contype`,
    )

    expect(constraints.rows).toEqual([
      {
        contype: 'c',
        name: 'chk_sessions_idle_within_absolute',
        definition: 'CHECK ((idle_expires_at <= absolute_expires_at))',
      },
      {
        contype: 'f',
        name: 'fk_sessions_user_id',
        definition: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
      // 主键名由 TypeORM 生成，这里只核对它约束的列。
      { contype: 'p', name: expect.any(String), definition: 'PRIMARY KEY (session_key_hash)' },
    ])
  })

  it('creates a plain index on idle_expires_at', async () => {
    const indexes = await database().query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'sessions'
          AND indexname = 'idx_sessions_idle_expires_at'`,
    )

    expect(indexes.rows).toEqual([
      {
        indexdef:
          'CREATE INDEX idx_sessions_idle_expires_at ON public.sessions USING btree (idle_expires_at)',
      },
    ])
  })

  it('stores a session for an existing user and fills created_at from the database clock', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      const session = fixtureSession(userId)
      await expect(insertSession(db, session)).resolves.toMatchObject({ rowCount: 1 })

      const row = await db.query(
        `SELECT created_at = now() AS from_default, data->>'csrfToken' AS csrf_token,
                length(session_key_hash) AS key_length
           FROM sessions WHERE session_key_hash = $1`,
        [session.session_key_hash],
      )
      expect(row.rows).toEqual([
        { from_default: true, csrf_token: 'fixture-csrf-token', key_length: 64 },
      ])
    })
  })

  it('rejects a session whose user does not exist', async () => {
    await inRolledBackTransaction(async (db) => {
      await expect(insertSession(db, fixtureSession(randomUUID()))).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
      })
    })
  })

  it('deletes the sessions of a user when the user is deleted', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      await insertSession(db, fixtureSession(userId))
      await insertSession(db, fixtureSession(userId))

      await db.query('DELETE FROM users WHERE id = $1', [userId])

      const remaining = await db.query<{ count: string }>(
        'SELECT count(*) AS count FROM sessions WHERE user_id = $1',
        [userId],
      )
      expect(remaining.rows[0]?.count).toBe('0')
    })
  })

  it('rejects an idle expiry later than the absolute expiry', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      const absolute = new Date(Date.now() + DAY)
      const session = fixtureSession(userId, {
        absolute_expires_at: absolute,
        idle_expires_at: new Date(absolute.getTime() + 1_000),
      })
      await expect(insertSession(db, session)).rejects.toMatchObject({ code: CHECK_VIOLATION })
    })
  })

  it('allows the idle expiry to equal the absolute expiry', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      const deadline = new Date(Date.now() + DAY)
      const session = fixtureSession(userId, {
        idle_expires_at: deadline,
        absolute_expires_at: deadline,
      })
      await expect(insertSession(db, session)).resolves.toMatchObject({ rowCount: 1 })
    })
  })

  it('rejects a duplicate session key hash', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      const first = fixtureSession(userId)
      await insertSession(db, first)
      await expect(
        insertSession(db, fixtureSession(userId, { session_key_hash: first.session_key_hash })),
      ).rejects.toMatchObject({ code: UNIQUE_VIOLATION })
    })
  })

  it('rejects a session key hash longer than 64 characters', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      await expect(
        insertSession(db, fixtureSession(userId, { session_key_hash: 'a'.repeat(65) })),
      ).rejects.toMatchObject({ code: STRING_TOO_LONG })
    })
  })

  it.each([
    'session_key_hash',
    'user_id',
    'data',
    'last_seen_at',
    'idle_expires_at',
    'absolute_expires_at',
  ] as const)('rejects a NULL %s', async (column) => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      await expect(
        insertSession(db, fixtureSession(userId, { [column]: null })),
      ).rejects.toMatchObject({ code: NOT_NULL_VIOLATION })
    })
  })

  it('rejects an explicit NULL created_at even though the column has a default', async () => {
    await inRolledBackTransaction(async (db) => {
      const userId = await insertFixtureUser(db)
      const session = fixtureSession(userId)
      await expect(
        db.query(
          `INSERT INTO sessions
             (session_key_hash, user_id, data, created_at, last_seen_at,
              idle_expires_at, absolute_expires_at)
           VALUES ($1, $2, $3, NULL, $4, $5, $6)`,
          [
            session.session_key_hash,
            session.user_id,
            session.data,
            session.last_seen_at,
            session.idle_expires_at,
            session.absolute_expires_at,
          ],
        ),
      ).rejects.toMatchObject({ code: NOT_NULL_VIOLATION })
    })
  })

  it('leaves no fixture rows behind', async () => {
    const remaining = await database().query<{ sessions: string; users: string }>(
      'SELECT (SELECT count(*) FROM sessions) AS sessions, (SELECT count(*) FROM users) AS users',
    )
    expect(remaining.rows).toEqual([{ sessions: '0', users: '0' }])
  })
})
