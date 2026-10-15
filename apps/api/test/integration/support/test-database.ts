import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify, stripVTControlCharacters } from 'node:util'
import { Client, escapeIdentifier } from 'pg'

const runCommand = promisify(execFile)
const apiRoot = fileURLToPath(new URL('../../../', import.meta.url))

// 唯一允许被删除重建的库。写死在这里，而不是读环境变量，防止一条命令就把开发库当成测试库。
export const DEDICATED_TEST_DATABASE = 'ledger_it'
// 只接受本机回环地址，远程库即使同名也不碰。
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
// 重建测试库时先连这个维护库；不能连着要删除的库去删它自己。
const MAINTENANCE_DATABASE = 'postgres'

export interface TestDatabaseTarget {
  databaseUrl: string
  maintenanceUrl: string
  databaseName: string
}

// 在任何连接发生之前检查目标库。报错信息只写库名和主机，不写完整连接串，避免带出密码。
export function resolveResettableTestDatabase(environment: NodeJS.ProcessEnv): TestDatabaseTarget {
  const databaseUrl = environment.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('test:db needs DATABASE_URL pointing at the dedicated test database')
  }

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('test:db needs DATABASE_URL to be a valid URL')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('test:db needs DATABASE_URL to use postgres:// or postgresql://')
  }
  // 连接串的查询参数（如 ?host=）可以改写真正连接的主机，测试库地址一律不带。
  if (parsed.search !== '') {
    throw new Error('test:db refuses DATABASE_URL with query parameters')
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`test:db only resets a local database; got host "${parsed.hostname}"`)
  }

  const databaseName = decodeURIComponent(parsed.pathname.slice(1))
  if (databaseName !== DEDICATED_TEST_DATABASE) {
    throw new Error(
      `test:db only resets "${DEDICATED_TEST_DATABASE}"; got database "${databaseName}"`,
    )
  }
  // 第二道确认：运行命令时必须再写一次库名，表示知道这个库会被清空。
  if (environment.ALLOW_DATABASE_RESET !== databaseName) {
    throw new Error(
      `test:db drops and recreates "${databaseName}"; set ALLOW_DATABASE_RESET=${databaseName} to confirm`,
    )
  }

  const maintenance = new URL(databaseUrl)
  maintenance.pathname = `/${MAINTENANCE_DATABASE}`
  return { databaseUrl, maintenanceUrl: maintenance.toString(), databaseName }
}

// 删除并重建测试库，让每次运行都从空库开始；只碰已经过校验的那一个库。
// 不加 WITH (FORCE)：库还被别的连接（比如开着的 psql）占用时直接失败，不强行断开别人。
export async function recreateTestDatabase(target: TestDatabaseTarget): Promise<void> {
  const client = new Client({ connectionString: target.maintenanceUrl })
  await client.connect()
  try {
    const name = escapeIdentifier(target.databaseName)
    await client.query(`DROP DATABASE IF EXISTS ${name}`)
    await client.query(`CREATE DATABASE ${name}`)
  } finally {
    await client.end()
  }
}

// 构建 API：迁移命令加载的是编译后的 dist，源码改了必须先构建。
export async function buildApi(): Promise<void> {
  await runCommand('pnpm', ['run', 'build'], { cwd: apiRoot, timeout: 90_000 })
}

// 用和手动迁移完全相同的命令执行 TypeORM CLI；连接串只注入这一个子进程。
// 返回去掉终端颜色码的输出，便于断言 TypeORM 打印的迁移日志。
export async function runMigrations(target: TestDatabaseTarget): Promise<string> {
  const { stdout, stderr } = await runCommand(
    'pnpm',
    ['exec', 'typeorm', 'migration:run', '-d', 'dist/database/cli-data-source.js'],
    {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: target.databaseUrl },
      timeout: 30_000,
    },
  )
  return stripVTControlCharacters(`${stdout}\n${stderr}`)
}

// 每个真实库测试文件的准备：先检查目标库，再重建为空库、构建 API，然后执行 runs 次迁移。
// 返回每次迁移命令的输出；每个文件都从空库开始，文件之间互不依赖。
export async function prepareMigratedDatabase(
  runs = 1,
): Promise<{ target: TestDatabaseTarget; outputs: string[] }> {
  const target = resolveResettableTestDatabase(process.env)
  await recreateTestDatabase(target)
  await buildApi()
  const outputs: string[] = []
  for (let run = 0; run < runs; run += 1) {
    outputs.push(await runMigrations(target))
  }
  return { target, outputs }
}

// 测试用的直连客户端，只用来查结构和写虚构数据；调用方在 afterAll 里关闭。
export async function connectTestDatabase(target: TestDatabaseTarget): Promise<Client> {
  const client = new Client({ connectionString: target.databaseUrl })
  await client.connect()
  return client
}

// 写入类检查都在事务里做，结束时一律回滚，库里不留下虚构数据。
// 事务里某条语句报错后，PostgreSQL 会拒绝后续语句，所以每个事务只验证一种失败。
export async function withRolledBackTransaction<T>(
  db: Client,
  work: (db: Client) => Promise<T>,
): Promise<T> {
  await db.query('BEGIN')
  try {
    return await work(db)
  } finally {
    await db.query('ROLLBACK')
  }
}
