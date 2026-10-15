import { execFile } from 'node:child_process'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { promisify, stripVTControlCharacters } from 'node:util'
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyPassword } from '../../src/modules/auth/password-hasher.js'
import {
  connectTestDatabase,
  prepareMigratedDatabase,
  recreateTestDatabase,
} from './support/test-database.js'
import type { TestDatabaseTarget } from './support/test-database.js'

const runCommand = promisify(execFile)
const apiRoot = fileURLToPath(new URL('../../', import.meta.url))

// 两轮运行使用不同的虚构密码：第二轮如果改了库里的数据，第一轮的密码就会校验失败。
const firstRun = { a: 'fixture-demo-a-first-run', b: 'fixture-demo-b-first-run' }
const secondRun = { a: 'fixture-demo-a-second-run', b: 'fixture-demo-b-second-run' }

let target: TestDatabaseTarget | undefined
let client: Client | undefined

type SeedRun = { code: number; output: string }

// 运行真实的 `pnpm run seed:demo`；只给这个子进程注入数据库地址和密码。
async function runSeed(environment: Record<string, string | undefined>): Promise<SeedRun> {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.SEED_DEMO_A_PASSWORD
  delete env.SEED_DEMO_B_PASSWORD
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }

  try {
    const { stdout, stderr } = await runCommand('pnpm', ['run', 'seed:demo'], {
      cwd: apiRoot,
      env,
      // 超时说明命令没有自己退出（例如连接没有关闭）。
      timeout: 60_000,
    })
    return { code: 0, output: stripVTControlCharacters(`${stdout}\n${stderr}`) }
  } catch (error) {
    const failed = error as { code?: unknown; stdout?: string; stderr?: string; killed?: boolean }
    if (failed.killed) throw new Error('seed:demo did not exit before the timeout')
    return {
      code: typeof failed.code === 'number' ? failed.code : -1,
      output: stripVTControlCharacters(`${failed.stdout ?? ''}\n${failed.stderr ?? ''}`),
    }
  }
}

function seedEnvironment(passwords: { a: string; b: string }) {
  return {
    DATABASE_URL: target?.databaseUrl,
    SEED_DEMO_A_PASSWORD: passwords.a,
    SEED_DEMO_B_PASSWORD: passwords.b,
  }
}

function expectNoSecrets(output: string, passwords: { a: string; b: string }) {
  expect(output).not.toContain(passwords.a)
  expect(output).not.toContain(passwords.b)
  expect(output).not.toContain('$argon2id$')
  expect(output).not.toContain('postgresql://')
}

async function demoRows() {
  if (!client) throw new Error('Test database client is not connected')
  const result = await client.query<{ username: string; id: string; password_hash: string }>(
    "SELECT username, id, password_hash FROM users WHERE username LIKE 'demo_%' ORDER BY username",
  )
  return result.rows
}

async function expectConnectionRefused(port: number): Promise<void> {
  const attempt = new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(1_000)
    socket.once('connect', () => {
      socket.destroy()
      resolve()
    })
    socket.once('error', (error) => {
      socket.destroy()
      reject(error)
    })
    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error('Expected an immediate connection refusal'))
    })
  })
  await expect(attempt).rejects.toMatchObject({ code: 'ECONNREFUSED' })
}

beforeAll(async () => {
  ;({ target } = await prepareMigratedDatabase())
  client = await connectTestDatabase(target)
})

afterAll(async () => {
  await client?.end()
})

describe('seed:demo on a real PostgreSQL database', () => {
  it('creates demo_a and demo_b on the first run with verifiable password hashes', async () => {
    const run = await runSeed(seedEnvironment(firstRun))

    expect(run.code).toBe(0)
    expect(run.output).toContain('demo_a: created')
    expect(run.output).toContain('demo_b: created')
    expectNoSecrets(run.output, firstRun)

    const rows = await demoRows()
    expect(rows.map((row) => row.username)).toEqual(['demo_a', 'demo_b'])
    await expect(verifyPassword(rows[0]?.password_hash ?? '', firstRun.a)).resolves.toBe(true)
    await expect(verifyPassword(rows[1]?.password_hash ?? '', firstRun.b)).resolves.toBe(true)
  })

  it('reports exists on a second run and keeps the original passwords', async () => {
    const before = await demoRows()

    const run = await runSeed(seedEnvironment(secondRun))

    expect(run.code).toBe(0)
    expect(run.output).toContain('demo_a: exists')
    expect(run.output).toContain('demo_b: exists')
    expectNoSecrets(run.output, secondRun)
    const after = await demoRows()
    expect(after).toEqual(before)
    await expect(verifyPassword(after[0]?.password_hash ?? '', firstRun.a)).resolves.toBe(true)
    await expect(verifyPassword(after[0]?.password_hash ?? '', secondRun.a)).resolves.toBe(false)
  })

  it('rejects a missing password before trying to reach the database', async () => {
    // 127.0.0.1:1 没有服务；如果脚本先去连库，输出里会出现连接被拒绝的错误。
    await expectConnectionRefused(1)

    const run = await runSeed({
      DATABASE_URL: 'postgresql://127.0.0.1:1/ledger_seed_offline',
      SEED_DEMO_A_PASSWORD: firstRun.a,
      SEED_DEMO_B_PASSWORD: undefined,
    })

    expect(run.code).not.toBe(0)
    expect(run.output).toContain('SEED_DEMO_B_PASSWORD')
    expect(run.output).not.toContain('ECONNREFUSED')
    expectNoSecrets(run.output, firstRun)
  })

  // 放在最后：它把 ledger_it 重建成没有任何表的空库。
  it('fails on a database without migrations and does not create any table', async () => {
    if (!target) throw new Error('Test database target is missing')
    await client?.end()
    client = undefined
    await recreateTestDatabase(target)

    const run = await runSeed(seedEnvironment(firstRun))

    expect(run.code).not.toBe(0)
    expect(run.output).toMatch(/relation "users" does not exist/)
    expectNoSecrets(run.output, firstRun)
    client = await connectTestDatabase(target)
    const tables = await client.query<{ count: string }>(
      "SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = 'public'",
    )
    expect(tables.rows[0]?.count).toBe('0')
  })
})
