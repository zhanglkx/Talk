import { describe, expect, it, vi } from 'vitest'
import { verifyPassword } from '../src/modules/auth/password-hasher.js'

// seed 的纯逻辑部分：读取并检查密码、逐个创建账号。不连数据库。
const demoUsersModulePath = new URL('../src/scripts/demo-users.ts', import.meta.url).href

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
    ['missing', 'SEED_DEMO_A_PASSWORD', undefined],
    ['empty', 'SEED_DEMO_A_PASSWORD', ''],
    ['11 characters long', 'SEED_DEMO_B_PASSWORD', 'p'.repeat(11)],
    ['129 characters long', 'SEED_DEMO_B_PASSWORD', 'p'.repeat(129)],
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
