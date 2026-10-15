import { hash as hashWithLibrary } from '@node-rs/argon2'
import { describe, expect, it } from 'vitest'

// 密码哈希：seed 写入和登录校验共用。算法 Argon2id，参数取 OWASP 建议的最低档。
// 测试只用虚构的固定密码，不打印密码或哈希。
const hasherModulePath = new URL('../src/modules/auth/password-hasher.ts', import.meta.url).href

type PasswordHasher = {
  hashPassword(password: string): Promise<string>
  verifyPassword(storedHash: string, password: string): Promise<boolean>
}

const fixturePassword = 'fixture-Passw0rd-for-tests'

// PHC 格式：$argon2id$v=19$m=内存KiB,t=迭代次数,p=并行度$16字节盐$32字节哈希（均为无填充 Base64）。
const PHC_PATTERN = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

async function loadHasher(): Promise<PasswordHasher> {
  const hasherModule = await import(hasherModulePath)
  expect(hasherModule.hashPassword).toBeTypeOf('function')
  expect(hasherModule.verifyPassword).toBeTypeOf('function')
  return hasherModule
}

// 记录哪个先完成：异步实现会让出事件循环，setImmediate 先执行；同步实现会一直占着线程。
async function completesAfterEventLoopTurn(work: () => Promise<unknown>): Promise<boolean> {
  const order: string[] = []
  const turned = new Promise<void>((resolve) =>
    setImmediate(() => {
      order.push('event-loop')
      resolve()
    }),
  )
  await work().then(() => order.push('work'))
  await turned
  return order[0] === 'event-loop'
}

describe('password hasher', () => {
  it('produces an Argon2id PHC string with the chosen parameters', async () => {
    const { hashPassword } = await loadHasher()
    await expect(hashPassword(fixturePassword)).resolves.toMatch(PHC_PATTERN)
  })

  it('uses a fresh random salt for every hash of the same password', async () => {
    const { hashPassword, verifyPassword } = await loadHasher()
    const first = await hashPassword(fixturePassword)
    const second = await hashPassword(fixturePassword)

    expect(first).not.toBe(second)
    await expect(verifyPassword(first, fixturePassword)).resolves.toBe(true)
    await expect(verifyPassword(second, fixturePassword)).resolves.toBe(true)
  })

  it('never contains the plain password', async () => {
    const { hashPassword } = await loadHasher()
    expect(await hashPassword(fixturePassword)).not.toContain(fixturePassword)
  })

  it.each([
    ['a different password', 'fixture-Passw0rd-for-test'],
    ['a trailing space', `${fixturePassword} `],
    ['a leading space', ` ${fixturePassword}`],
    ['different letter case', fixturePassword.toUpperCase()],
    ['an empty string', ''],
  ])('rejects %s because passwords are compared verbatim', async (_case, attempt) => {
    const { hashPassword, verifyPassword } = await loadHasher()
    const stored = await hashPassword(fixturePassword)
    await expect(verifyPassword(stored, attempt)).resolves.toBe(false)
  })

  it('handles non-ASCII passwords', async () => {
    const { hashPassword, verifyPassword } = await loadHasher()
    const password = '虚构密码-测试用-🔐-2026'
    const stored = await hashPassword(password)

    await expect(verifyPassword(stored, password)).resolves.toBe(true)
    await expect(verifyPassword(stored, '虚构密码-测试用-2026')).resolves.toBe(false)
  })

  it('still verifies hashes created with older parameters', async () => {
    const { verifyPassword } = await loadHasher()
    // 参数写在哈希字符串里；以后调高参数，已存的旧哈希仍要能校验。
    const older = await hashWithLibrary(fixturePassword, { memoryCost: 8192, timeCost: 1 })

    await expect(verifyPassword(older, fixturePassword)).resolves.toBe(true)
  })

  it.each([
    ['an empty string', ''],
    ['plain text', 'not-a-hash'],
    ['a truncated PHC string', '$argon2id$v=19$m=19456,t=2,p=1$broken'],
  ])('returns false instead of throwing for a corrupted stored hash: %s', async (_case, stored) => {
    const { verifyPassword } = await loadHasher()
    await expect(verifyPassword(stored, fixturePassword)).resolves.toBe(false)
  })

  it('does not block the event loop while hashing or verifying', async () => {
    const { hashPassword, verifyPassword } = await loadHasher()
    const stored = await hashPassword(fixturePassword)

    expect(await completesAfterEventLoopTurn(() => hashPassword(fixturePassword))).toBe(true)
    expect(await completesAfterEventLoopTurn(() => verifyPassword(stored, fixturePassword))).toBe(
      true,
    )
  })
})
