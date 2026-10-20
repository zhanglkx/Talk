import { hashPassword } from '@/modules/auth/password-hasher.js'
import type { CreateUserResult, UsersRepository } from '@/modules/users/users.repository.js'
import { PasswordSchema } from '@/modules/auth/schemas.js'

export type DemoAccount = { username: string; password: string }
export type DemoSeedResult = { username: string; result: CreateUserResult }

const DEMO_ACCOUNTS = [
  { username: 'demo_a', variable: 'SEED_DEMO_A_PASSWORD' },
  { username: 'demo_b', variable: 'SEED_DEMO_B_PASSWORD' },
] as const

const readDemoAccounts = (environment: Record<string, string | undefined>): DemoAccount[] => {
  return DEMO_ACCOUNTS.map(({ username, variable }) => {
    // 与登录请求体用同一条密码规则（按 Unicode 码点计 12～128），seed 建出来的账号才一定能登录。
    const result = PasswordSchema.safeParse(environment[variable])
    // safeParse 不抛错，要自己检查 success；报错只带变量名，不带密码。
    if (!result.success) {
      throw new Error(`${variable} must be set to a password of 12 to 128 characters`)
    }
    // 用 result.data 而不是原变量：检查通过后它的类型才是 string，并且原样保留首尾空格。
    return { username, password: result.data }
  })
}

export async function seedDemoUsers(
  accounts: DemoAccount[],
  repository: Pick<UsersRepository, 'createIfAbsent'>,
): Promise<DemoSeedResult[]> {
  const results: DemoSeedResult[] = []
  for (const { username, password } of accounts) {
    const passwordHash = await hashPassword(password)
    results.push({ username, result: await repository.createIfAbsent({ username, passwordHash }) })
  }
  return results
}

export { readDemoAccounts }
