import { randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectTestDatabase,
  prepareMigratedDatabase,
  withRolledBackTransaction,
} from './support/test-database.js'

// PostgreSQL 错误码：唯一冲突、非空冲突、字符串超长、格式不合法（例如不是 UUID）。
const UNIQUE_VIOLATION = '23505'
const NOT_NULL_VIOLATION = '23502'
const STRING_TOO_LONG = '22001'
const INVALID_TEXT_REPRESENTATION = '22P02'

let client: Client | undefined

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

function inRolledBackTransaction<T>(work: (db: Client) => Promise<T>): Promise<T> {
  return withRolledBackTransaction(database(), work)
}

function insertUser(db: Client, values: { id?: unknown; username?: unknown; hash?: unknown }) {
  return db.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
    'id' in values ? values.id : randomUUID(),
    'username' in values ? values.username : 'fixture_user',
    'hash' in values ? values.hash : 'fixture-not-a-real-hash',
  ])
}

beforeAll(async () => {
  // 先检查目标库再做任何连接；不是专用测试库、没有确认变量时这里就失败。
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
})

afterAll(async () => {
  await client?.end()
})

describe('users table on a real PostgreSQL database', () => {
  it('creates the columns with the planned types, lengths, nullability and defaults', async () => {
    const columns = await database().query(
      `SELECT column_name, data_type, character_maximum_length::int AS max_length,
              is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position`,
    )

    expect(columns.rows).toEqual([
      {
        column_name: 'id',
        data_type: 'uuid',
        max_length: null,
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'username',
        data_type: 'character varying',
        max_length: 32,
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'password_hash',
        data_type: 'text',
        max_length: null,
        is_nullable: 'NO',
        column_default: null,
      },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        max_length: null,
        is_nullable: 'NO',
        column_default: 'now()',
      },
    ])
  })

  it('declares the primary key on id and a unique constraint on username', async () => {
    const constraints = await database().query<{ contype: string; definition: string }>(
      `SELECT contype, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass AND contype IN ('p', 'u')
        ORDER BY contype`,
    )

    expect(constraints.rows).toEqual([
      { contype: 'p', definition: 'PRIMARY KEY (id)' },
      { contype: 'u', definition: 'UNIQUE (username)' },
    ])
  })

  it('fills created_at from the database clock when the insert omits it', async () => {
    await inRolledBackTransaction(async (db) => {
      await insertUser(db, { username: 'fixture_alice' })
      // now() 在同一事务里固定为事务开始时刻，相等说明默认值确实来自数据库的 now()。
      const row = await db.query<{ from_default: boolean }>(
        "SELECT created_at = now() AS from_default FROM users WHERE username = 'fixture_alice'",
      )
      expect(row.rows).toEqual([{ from_default: true }])
    })
  })

  it('rejects a duplicate username', async () => {
    await inRolledBackTransaction(async (db) => {
      await insertUser(db, { username: 'fixture_bob' })
      await expect(insertUser(db, { username: 'fixture_bob' })).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
      })
    })
  })

  it('accepts a 32-character username and rejects 33 characters', async () => {
    await inRolledBackTransaction(async (db) => {
      await expect(insertUser(db, { username: 'u'.repeat(32) })).resolves.toMatchObject({
        rowCount: 1,
      })
    })
    await inRolledBackTransaction(async (db) => {
      await expect(insertUser(db, { username: 'u'.repeat(33) })).rejects.toMatchObject({
        code: STRING_TOO_LONG,
      })
    })
  })

  it.each([
    ['id', { id: null }],
    ['username', { username: null }],
    ['password_hash', { hash: null }],
  ])('rejects a NULL %s', async (_column, values) => {
    await inRolledBackTransaction(async (db) => {
      await expect(insertUser(db, values)).rejects.toMatchObject({ code: NOT_NULL_VIOLATION })
    })
  })

  it('rejects an explicit NULL created_at even though the column has a default', async () => {
    await inRolledBackTransaction(async (db) => {
      await expect(
        db.query(
          'INSERT INTO users (id, username, password_hash, created_at) VALUES ($1, $2, $3, NULL)',
          [randomUUID(), 'fixture_carol', 'fixture-not-a-real-hash'],
        ),
      ).rejects.toMatchObject({ code: NOT_NULL_VIOLATION })
    })
  })

  it('does not generate ids and rejects values that are not UUIDs', async () => {
    await inRolledBackTransaction(async (db) => {
      await expect(
        db.query("INSERT INTO users (username, password_hash) VALUES ('fixture_dave', 'x')"),
      ).rejects.toMatchObject({ code: NOT_NULL_VIOLATION })
    })
    await inRolledBackTransaction(async (db) => {
      await expect(insertUser(db, { id: 'not-a-uuid' })).rejects.toMatchObject({
        code: INVALID_TEXT_REPRESENTATION,
      })
    })
  })

  it('leaves no fixture rows behind', async () => {
    const remaining = await database().query<{ count: string }>(
      'SELECT count(*) AS count FROM users',
    )
    expect(remaining.rows[0]?.count).toBe('0')
  })
})
