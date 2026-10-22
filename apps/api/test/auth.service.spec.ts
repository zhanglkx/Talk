import 'reflect-metadata'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateEnvironment } from '../src/config/validate-environment.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'
import { DatabaseModule } from '../src/database/database.module.js'
import { hashPassword, verifyPassword } from '../src/modules/auth/password-hasher.js'
import { UsersRepository } from '../src/modules/users/users.repository.js'

// 登录凭据校验：规范化用户名 → 查凭据 → 校验密码。三种失败都返回 null，且每次恰好校验一次哈希，
// 「用户不存在」不会因为少算一次 Argon2id 而明显更快（M1 技术方案 §6）。不涉及 HTTP。

// 保留真实的 Argon2id 实现，只记录调用，用来数「校验了几次哈希」「生成了几次假哈希」。
vi.mock('../src/modules/auth/password-hasher.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/modules/auth/password-hasher.js')>()
  return {
    ...actual,
    hashPassword: vi.fn(actual.hashPassword),
    verifyPassword: vi.fn(actual.verifyPassword),
  }
})

const authServicePath = new URL('../src/modules/auth/auth.service.ts', import.meta.url).href
const authModulePath = new URL('../src/modules/auth/auth.module.ts', import.meta.url).href

type PublicUser = { id: string; username: string }
type AuthServiceLike = {
  verifyCredentials(username: string, password: string): Promise<PublicUser | null>
  findSessionUser(userId: string): Promise<PublicUser | null>
}

const fixtureUser: PublicUser = { id: '00000000-0000-4000-8000-000000000001', username: 'demo_a' }
const fixturePassword = 'fixture-Passw0rd-for-auth'
// 与 password-hasher.ts 相同的算法和参数；假哈希也必须是这个形式，校验耗时才和真实哈希相当。
const PHC_PATTERN = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

let fixtureHash = ''
let moduleRef: TestingModule | undefined

beforeAll(async () => {
  // 用未被记录的真实实现准备库里的哈希，不计入下面的调用次数。
  const actual = await vi.importActual<typeof import('../src/modules/auth/password-hasher.js')>(
    '../src/modules/auth/password-hasher.js',
  )
  fixtureHash = await actual.hashPassword(fixturePassword)
})

beforeEach(() => {
  // 只清调用记录，保留真实实现。
  vi.clearAllMocks()
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('AuthService offline tests must not connect to the database')
  })
  vi.spyOn(PostgresQueryRunner.prototype, 'query').mockImplementation(() => {
    throw new Error('AuthService offline tests must not send SQL')
  })
})

afterEach(async () => {
  await moduleRef?.close()
  moduleRef = undefined
  vi.restoreAllMocks()
})

// 内存版的 UsersRepository：只有 demo_a 一个用户，像真实仓储一样每次返回新的普通对象。
function fakeUsers() {
  return {
    findCredentialsByUsername: vi.fn(async (username: string) =>
      username === fixtureUser.username ? { ...fixtureUser, passwordHash: fixtureHash } : null,
    ),
    findPublicById: vi.fn(async (_id: string): Promise<PublicUser | null> => {
      throw new Error('verifyCredentials should not need findPublicById')
    }),
    createIfAbsent: vi.fn(async () => {
      throw new Error('verifyCredentials must not write users')
    }),
  }
}

// 由 Nest 容器创建 AuthService：它必须按类型注入 UsersRepository。每个用例都是新容器、新实例。
async function createService(users = fakeUsers()) {
  const { AuthService } = await import(authServicePath)
  expect(AuthService).toBeTypeOf('function')

  moduleRef = await Test.createTestingModule({
    providers: [AuthService, { provide: UsersRepository, useValue: users }],
  }).compile()
  return { service: moduleRef.get<AuthServiceLike>(AuthService), users }
}

function dummyHashesUsed(): string[] {
  return vi
    .mocked(verifyPassword)
    .mock.calls.map(([storedHash]) => storedHash)
    .filter((storedHash) => storedHash !== fixtureHash)
}

describe('AuthService.verifyCredentials', () => {
  it('returns only { id, username } as a plain object for the right credentials', async () => {
    const { service, users } = await createService()

    const result = await service.verifyCredentials('demo_a', fixturePassword)

    // toStrictEqual 也会拒绝多出来的 passwordHash 和类实例。
    expect(result).toStrictEqual(fixtureUser)
    expect(users.findCredentialsByUsername).toHaveBeenCalledExactlyOnceWith('demo_a')
    expect(verifyPassword).toHaveBeenCalledExactlyOnceWith(fixtureHash, fixturePassword)
    // 用户存在时只校验真实哈希，不生成假哈希。
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it('normalizes the username before looking it up', async () => {
    const { service, users } = await createService()

    await expect(service.verifyCredentials('  Demo_A ', fixturePassword)).resolves.toStrictEqual(
      fixtureUser,
    )
    expect(users.findCredentialsByUsername).toHaveBeenCalledExactlyOnceWith('demo_a')
  })

  it.each([
    ['a wrong password', 'fixture-Wrong-passw0rd'],
    ['the right password with surrounding spaces', ` ${fixturePassword} `],
    ['the right password in another case', fixturePassword.toUpperCase()],
    ['an empty password', ''],
  ])('returns null for %s and passes it to verifyPassword unchanged', async (_case, password) => {
    const { service } = await createService()

    await expect(service.verifyCredentials('demo_a', password)).resolves.toBeNull()

    // 密码原样参与校验，不 trim、不改大小写（M1 PRD §5）。
    expect(verifyPassword).toHaveBeenCalledExactlyOnceWith(fixtureHash, password)
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it('returns null for an unknown user after verifying exactly one Argon2id dummy hash', async () => {
    const { service, users } = await createService()

    await expect(service.verifyCredentials('demo_nobody', fixturePassword)).resolves.toBeNull()

    expect(users.findCredentialsByUsername).toHaveBeenCalledExactlyOnceWith('demo_nobody')
    expect(verifyPassword).toHaveBeenCalledOnce()
    const [dummyHash] = dummyHashesUsed()
    expect(dummyHash).toMatch(PHC_PATTERN)
  })

  it.each([
    ['too short', 'ab'],
    ['a hyphen', 'demo-a'],
    ['an inner space', 'demo a'],
    ['empty', ''],
  ])(
    'returns null for a username that is %s without querying, still verifying one dummy hash',
    async (_case, username) => {
      const { service, users } = await createService()

      await expect(service.verifyCredentials(username, fixturePassword)).resolves.toBeNull()

      // 不合法的用户名查不到任何人，不必为它连库；但仍要花一次校验的时间。
      expect(users.findCredentialsByUsername).not.toHaveBeenCalled()
      expect(verifyPassword).toHaveBeenCalledOnce()
      expect(dummyHashesUsed()[0]).toMatch(PHC_PATTERN)
    },
  )

  it.each([
    ['an unknown user', 'demo_nobody'],
    ['an invalid username', 'demo-a'],
  ])('waits for the dummy verification to finish before answering for %s', async (_c, username) => {
    const { service } = await createService()
    // 让假哈希的校验停在半路：如果实现不等它完成就返回 null，时间差仍然存在。
    let finishVerification: ((matches: boolean) => void) | undefined
    vi.mocked(verifyPassword).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishVerification = resolve
        }),
    )
    let settled = false
    const answer = service.verifyCredentials(username, fixturePassword).finally(() => {
      settled = true
    })

    await vi.waitFor(() => expect(verifyPassword).toHaveBeenCalledOnce())
    await new Promise((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)

    finishVerification?.(false)
    await expect(answer).resolves.toBeNull()
  })

  it('creates the dummy hash lazily and only once, even for concurrent first calls', async () => {
    const { service } = await createService()
    // 创建服务时不计算：启动不该为登录多花时间。
    expect(hashPassword).not.toHaveBeenCalled()

    const results = await Promise.all([
      service.verifyCredentials('demo_nobody', fixturePassword),
      service.verifyCredentials('demo_ghost', fixturePassword),
      service.verifyCredentials('demo-a', fixturePassword),
      service.verifyCredentials('', fixturePassword),
      service.verifyCredentials('demo_phantom', fixturePassword),
    ])
    await service.verifyCredentials('demo_latecomer', fixturePassword)

    expect(results).toEqual([null, null, null, null, null])
    // 缓存的是生成中的 Promise：并发的首次调用共用同一次计算，之后直接复用。
    expect(hashPassword).toHaveBeenCalledOnce()
    const dummyHashes = dummyHashesUsed()
    expect(dummyHashes).toHaveLength(6)
    expect(new Set(dummyHashes).size).toBe(1)
  })

  it('rethrows a repository failure instead of reporting wrong credentials', async () => {
    const users = fakeUsers()
    const unavailable = new Error('database unavailable')
    users.findCredentialsByUsername.mockRejectedValueOnce(unavailable)
    const { service } = await createService(users)

    // 当成 null 返回的话，数据库一断，用户看到的就是「用户名或密码错误」。
    await expect(service.verifyCredentials('demo_a', fixturePassword)).rejects.toBe(unavailable)
  })
})

// me 用：按会话里的 userId 取公开身份（M1-S25）。只读 users，不碰密码哈希。
describe('AuthService.findSessionUser', () => {
  function usersWithPublicLookup() {
    const users = fakeUsers()
    users.findPublicById.mockImplementation(async (id: string) =>
      id === fixtureUser.id ? { ...fixtureUser } : null,
    )
    return users
  }

  it('returns the public identity for the session user as a plain object', async () => {
    const { service, users } = await createService(usersWithPublicLookup())

    await expect(service.findSessionUser(fixtureUser.id)).resolves.toStrictEqual(fixtureUser)

    expect(users.findPublicById).toHaveBeenCalledExactlyOnceWith(fixtureUser.id)
    expect(users.findCredentialsByUsername).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it('returns null when the user no longer exists', async () => {
    const { service, users } = await createService(usersWithPublicLookup())
    const missing = '00000000-0000-4000-8000-0000000000ff'

    await expect(service.findSessionUser(missing)).resolves.toBeNull()
    expect(users.findPublicById).toHaveBeenCalledExactlyOnceWith(missing)
  })

  it('rethrows a repository failure instead of reporting a missing user', async () => {
    const users = usersWithPublicLookup()
    const unavailable = new Error('database unavailable')
    users.findPublicById.mockRejectedValueOnce(unavailable)
    const { service } = await createService(users)

    // 当成 null 的话，数据库一断，已登录的人就被当成「没登录」。
    await expect(service.findSessionUser(fixtureUser.id)).rejects.toBe(unavailable)
  })
})

describe('AuthModule', () => {
  it('provides AuthService backed by the real UsersRepository and surfaces database failures', async () => {
    const unavailable = new Error('database unavailable')
    const ensureConnected = vi.fn().mockRejectedValue(unavailable)
    const { AuthModule } = await import(authModulePath)
    const { AuthService } = await import(authServicePath)
    expect(AuthService).toBeTypeOf('function')

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnvironment,
        }),
        DatabaseModule,
        AuthModule,
      ],
    })
      .overrideProvider(ConnectionLifecycleService)
      .useValue({ ensureConnected })
      .compile()
    await moduleRef.init()
    const service = moduleRef.get<AuthServiceLike>(AuthService)

    await expect(service.verifyCredentials('demo_a', fixturePassword)).rejects.toBe(unavailable)
    expect(ensureConnected).toHaveBeenCalledOnce()
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
    expect(PostgresQueryRunner.prototype.query).not.toHaveBeenCalled()
  })
})
