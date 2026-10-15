import { hashPassword } from '@/modules/auth/password-hasher.js'
import type { CreateUserResult, UsersRepository } from '@/modules/users/users.repository.js'

export type DemoAccount = { username: string; password: string }
export type DemoSeedResult = { username: string; result: CreateUserResult }

const DEMO_ACCOUNTS = [
  { username: 'demo_a', variable: 'SEED_DEMO_A_PASSWORD' },
  { username: 'demo_b', variable: 'SEED_DEMO_B_PASSWORD' },
] as const

export function readDemoAccounts(environment: Record<string, string | undefined>): DemoAccount[] {
  return DEMO_ACCOUNTS.map(({ username, variable }) => {
    const password = environment[variable]
    if (password === undefined || password.length < 12 || password.length > 128) {
      throw new Error(`${variable} must be set to a password of 12 to 128 characters`)
    }
    return { username, password }
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
