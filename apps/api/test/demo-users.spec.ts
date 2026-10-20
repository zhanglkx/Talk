import { describe, expect, it, vi } from 'vitest'
import { verifyPassword } from '../src/modules/auth/password-hasher.js'

// seed 的纯逻辑部分：读取并检查密码、逐个创建账号。不连数据库。
const demoUsersModulePath = new URL('../src/scripts/demo-users.ts', import.meta.url).href
// 登录请求体的密码 Schema；seed 用同一条规则检查密码（M1-S23）。
const schemasModulePath = new URL('../src/modules/auth/schemas.ts', import.meta.url).href

type DemoAccount = { username: string; password: string }
type SeedResult = { username: string; result: 'created' | 'exists' }
type DemoUsersModule = {
  readDemoAccounts(environment: Record<string, string | undefined>): DemoAccount[]
  seedDemoUsers(
    accounts: DemoAccount[],
    repository: {
      createIfAbsent(input: { username: string; passwordHash: string }): Promise<string>
    },
  ): Promise<SeedResult[]>
}

const passwordA = 'fixture-demo-a-password'
const passwordB = 'fixture-demo-b-password'
const validEnvironment = { SEED_DEMO_A_PASSWORD: passwordA, SEED_DEMO_B_PASSWORD: passwordB }

async function loadDemoUsers(): Promise<DemoUsersModule> {
  const demoUsersModule = await import(demoUsersModulePath)
  expect(demoUsersModule.readDemoAccounts).toBeTypeOf('function')
  expect(demoUsersModule.seedDemoUsers).toBeTypeOf('function')
  return demoUsersModule
}

function captureError(work: () => unknown): Error {
  try {
    work()
  } catch (error) {
    if (error instanceof Error) return error
    throw new Error('Expected an Error instance')
  }
  throw new Error('Expected the call to throw')
}

describe('readDemoAccounts', () => {
  it('returns demo_a and demo_b with their passwords exactly as given', async () => {
    const { readDemoAccounts } = await loadDemoUsers()

    expect(readDemoAccounts(validEnvironment)).toEqual([
      { username: 'demo_a', password: passwordA },
      { username: 'demo_b', password: passwordB },
    ])
  })

  it('keeps surrounding spaces because passwords are used verbatim', async () => {
    const { readDemoAccounts } = await loadDemoUsers()
    const spaced = '  fixture-spaced-password  '

    const [first] = readDemoAccounts({ ...validEnvironment, SEED_DEMO_A_PASSWORD: spaced })

    expect(first?.password).toBe(spaced)
  })

  it.each([12, 128])('accepts a password of %i characters', async (length) => {
    const { readDemoAccounts } = await loadDemoUsers()
    const password = 'p'.repeat(length)

    expect(readDemoAccounts({ ...validEnvironment, SEED_DEMO_B_PASSWORD: password })[1]).toEqual({
      username: 'demo_b',
      password,
    })
  })

  it.each([
    ['12 emoji (24 UTF-16 units)', '😀'.repeat(12)],
    ['65 emoji (130 UTF-16 units)', '😀'.repeat(65)],
    ['128 emoji (256 UTF-16 units)', '😀'.repeat(128)],
  ])(
    'counts each Unicode code point as one character, so it accepts %s',
    async (_case, password) => {
      const { readDemoAccounts } = await loadDemoUsers()

      expect(readDemoAccounts({ ...validEnvironment, SEED_DEMO_B_PASSWORD: password })[1]).toEqual({
        username: 'demo_b',
        password,
      })
    },
  )

  // seed 接受的密码，登录接口必须也接受，否则建出来的账号永远登不上；反过来也一样。
  it('accepts exactly the passwords that the login body schema accepts', async () => {
    const { readDemoAccounts } = await loadDemoUsers()
    const { PasswordSchema } = await import(schemasModulePath)
    expect(PasswordSchema?.['~standard']?.vendor).toBe('zod')

    for (const password of [
      '',
      'p'.repeat(11),
      'p'.repeat(12),
      'p'.repeat(128),
      'p'.repeat(129),
      '密'.repeat(12),
      '😀'.repeat(6),
      '😀'.repeat(11),
      '😀'.repeat(12),
      '😀'.repeat(65),
      '😀'.repeat(128),
      '😀'.repeat(129),
      '  fixture-spaced-password  ',
    ]) {
      let seedAccepts = true
      try {
        readDemoAccounts({ ...validEnvironment, SEED_DEMO_B_PASSWORD: password })
      } catch {
        seedAccepts = false
      }
      const codePoints = [...password].length
      expect(seedAccepts, `password of ${codePoints} code points`).toBe(
        PasswordSchema.safeParse(password).success,
      )
    }
  })

  it.each([
    ['missing', 'SEED_DEMO_A_PASSWORD', undefined],
    ['empty', 'SEED_DEMO_A_PASSWORD', ''],
    ['11 characters long', 'SEED_DEMO_B_PASSWORD', 'p'.repeat(11)],
    ['129 characters long', 'SEED_DEMO_B_PASSWORD', 'p'.repeat(129)],
    ['6 emoji long (12 UTF-16 units)', 'SEED_DEMO_B_PASSWORD', '😀'.repeat(6)],
    ['129 emoji long', 'SEED_DEMO_B_PASSWORD', '😀'.repeat(129)],
  ])(
    'rejects a password that is %s and names the variable without echoing it',
    async (_case, variable, value) => {
      const { readDemoAccounts } = await loadDemoUsers()
      const environment: Record<string, string | undefined> = { ...validEnvironment }
      environment[variable] = value

      const error = captureError(() => readDemoAccounts(environment))

      expect(error.message).toContain(variable)
      if (value) expect(error.message).not.toContain(value)
    },
  )
})

describe('seedDemoUsers', () => {
  it('stores a verifiable Argon2id hash for each account, in order, and reports the results', async () => {
    const { seedDemoUsers } = await loadDemoUsers()
    const createIfAbsent = vi
      .fn<(input: { username: string; passwordHash: string }) => Promise<string>>()
      .mockResolvedValueOnce('created')
      .mockResolvedValueOnce('exists')

    const results = await seedDemoUsers(
      [
        { username: 'demo_a', password: passwordA },
        { username: 'demo_b', password: passwordB },
      ],
      { createIfAbsent },
    )

    expect(results).toEqual([
      { username: 'demo_a', result: 'created' },
      { username: 'demo_b', result: 'exists' },
    ])
    expect(createIfAbsent.mock.calls.map(([input]) => input.username)).toEqual(['demo_a', 'demo_b'])
    const [first, second] = createIfAbsent.mock.calls.map(([input]) => input.passwordHash)
    expect(first).toMatch(/^\$argon2id\$/)
    await expect(verifyPassword(first ?? '', passwordA)).resolves.toBe(true)
    await expect(verifyPassword(second ?? '', passwordB)).resolves.toBe(true)
  })

  it('stops at the first failure and rethrows it unchanged', async () => {
    const { seedDemoUsers } = await loadDemoUsers()
    const failure = new Error('database unavailable')
    const createIfAbsent = vi.fn().mockRejectedValue(failure)

    await expect(
      seedDemoUsers(
        [
          { username: 'demo_a', password: passwordA },
          { username: 'demo_b', password: passwordB },
        ],
        { createIfAbsent },
      ),
    ).rejects.toBe(failure)

    expect(createIfAbsent).toHaveBeenCalledOnce()
  })
})
