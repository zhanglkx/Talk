import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'

// 登录请求体的 Zod Schema（M1-S23）。不经过 HTTP，只检查规则本身：
// 用户名与 normalizeUsername 共用同一个正则、结果一致；密码长度按 Unicode 码点计数（NIST SP 800-63B-4），原样保留。
const schemasModulePath = new URL('../src/modules/auth/schemas.ts', import.meta.url).href
const usernameModulePath = new URL('../src/modules/users/username.ts', import.meta.url).href

type AuthSchemas = { LoginBodySchema: ZodType; PasswordSchema: ZodType }
type UsernameModule = { USERNAME_PATTERN: unknown; normalizeUsername(input: string): string | null }

const validPassword = 'fixture-passw0rd'

async function loadSchemas(): Promise<AuthSchemas> {
  const schemas = await import(schemasModulePath)
  // Standard Schema 的标记：Nest 的 Pipe 和 Swagger 都靠 `~standard` 识别 Schema。
  expect(schemas.LoginBodySchema?.['~standard']?.vendor).toBe('zod')
  expect(schemas.PasswordSchema?.['~standard']?.vendor).toBe('zod')
  return schemas
}

async function loadUsernameModule(): Promise<UsernameModule> {
  const usernameModule = await import(usernameModulePath)
  expect(usernameModule.normalizeUsername).toBeTypeOf('function')
  return usernameModule
}

describe('USERNAME_PATTERN', () => {
  it('is exported from username.ts as the single username rule, without stateful flags', async () => {
    const { USERNAME_PATTERN } = await loadUsernameModule()

    expect(USERNAME_PATTERN).toBeInstanceOf(RegExp)
    const pattern = USERNAME_PATTERN as RegExp
    expect(pattern.source).toBe('^[A-Za-z0-9_]{3,32}$')
    // 带 g 或 y 的正则会记住上次匹配的位置（lastIndex），同一个输入连续 test 两次结果会不同。
    expect(pattern.flags).toBe('')
  })
})

describe('LoginBodySchema', () => {
  // 每一行：输入、是否合法。Schema 和 normalizeUsername 必须给出同一个答案。
  it.each([
    ['demo_a', true],
    ['Demo_A', true],
    ['  Demo_A ', true],
    ['\tdemo_a\n', true],
    ['\u00a0demo_a\u00a0', true],
    ['\u3000demo_a', true],
    ['\ufeffdemo_a', true],
    ['\u2028demo_a', true],
    ['abc', true],
    ['123', true],
    ['a'.repeat(32), true],
    [` ${'B'.repeat(32)} `, true],
    ['', false],
    ['   ', false],
    ['ab', false],
    ['  ab  ', false],
    ['a'.repeat(33), false],
    [` ${'a'.repeat(33)} `, false],
    ['ali ce', false],
    ['alice-1', false],
    ['alice.b', false],
    ['alice@example', false],
    ['张三丰', false],
    ['alice😀', false],
    ['ａｌｉｃｅ', false],
    ['\u200balice', false],
    ['demo_a\u200b', false],
    ['\u212Aate', false],
  ])('treats username %j as valid=%s, the same as normalizeUsername', async (username, valid) => {
    const { LoginBodySchema } = await loadSchemas()
    const { normalizeUsername } = await loadUsernameModule()

    const result = LoginBodySchema.safeParse({ username, password: validPassword })

    expect(result.success).toBe(valid)
    expect(normalizeUsername(username) !== null).toBe(valid)
    if (result.success) {
      // 只去掉首尾空白，不转小写：规范化仍由 verifyCredentials 负责。
      expect(result.data).toStrictEqual({ username: username.trim(), password: validPassword })
    }
  })

  it.each([
    ['username is missing', { password: validPassword }],
    ['password is missing', { username: 'demo_a' }],
    ['username is a number', { username: 42, password: validPassword }],
    ['username is null', { username: null, password: validPassword }],
    ['password is a number', { username: 'demo_a', password: 123456789012 }],
    ['password is null', { username: 'demo_a', password: null }],
    ['password is an array', { username: 'demo_a', password: [validPassword] }],
  ])('rejects a body where %s', async (_case, body) => {
    const { LoginBodySchema } = await loadSchemas()

    expect(LoginBodySchema.safeParse(body).success).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'demo_a'],
    ['an array', [{ username: 'demo_a', password: validPassword }]],
  ])('rejects %s instead of an object', async (_case, body) => {
    const { LoginBodySchema } = await loadSchemas()

    expect(LoginBodySchema.safeParse(body).success).toBe(false)
  })

  it('drops extra fields such as userId, so a client cannot pick an identity through the body', async () => {
    const { LoginBodySchema } = await loadSchemas()

    const result = LoginBodySchema.safeParse({
      username: 'demo_a',
      password: validPassword,
      userId: '00000000-0000-4000-8000-000000000000',
      isAdmin: true,
    })

    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual({ username: 'demo_a', password: validPassword })
  })

  it.each([
    ['11 characters', 'p'.repeat(11)],
    ['12 characters', 'p'.repeat(12)],
    ['128 characters', 'p'.repeat(128)],
    ['129 characters', 'p'.repeat(129)],
    ['6 emoji', '😀'.repeat(6)],
    ['12 emoji', '😀'.repeat(12)],
    ['128 emoji', '😀'.repeat(128)],
  ])(
    'applies the same password rule as PasswordSchema to a password of %s',
    async (_case, password) => {
      const { LoginBodySchema, PasswordSchema } = await loadSchemas()

      expect(LoginBodySchema.safeParse({ username: 'demo_a', password }).success).toBe(
        PasswordSchema.safeParse(password).success,
      )
    },
  )

  it('keeps the password exactly as given, including surrounding spaces', async () => {
    const { LoginBodySchema } = await loadSchemas()
    const spaced = '  fixture passw0rd  '

    const result = LoginBodySchema.safeParse({ username: 'demo_a', password: spaced })

    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual({ username: 'demo_a', password: spaced })
  })
})

describe('PasswordSchema', () => {
  // 长度按 Unicode 码点计数：一个 emoji 是 1 个字符（UTF-16 里占 2 个单元）。
  it.each([
    ['12 ASCII characters', 'p'.repeat(12)],
    ['128 ASCII characters', 'p'.repeat(128)],
    ['12 Chinese characters', '密'.repeat(12)],
    ['12 spaces', ' '.repeat(12)],
    ['12 emoji (24 UTF-16 units)', '😀'.repeat(12)],
    ['65 emoji (130 UTF-16 units)', '😀'.repeat(65)],
    ['128 emoji (256 UTF-16 units)', '😀'.repeat(128)],
  ])('accepts %s and returns it unchanged', async (_case, password) => {
    const { PasswordSchema } = await loadSchemas()

    const result = PasswordSchema.safeParse(password)

    expect(result.success).toBe(true)
    expect(result.data).toBe(password)
  })

  it.each([
    ['an empty string', ''],
    ['11 ASCII characters', 'p'.repeat(11)],
    ['129 ASCII characters', 'p'.repeat(129)],
    ['6 emoji (12 UTF-16 units)', '😀'.repeat(6)],
    ['11 emoji (22 UTF-16 units)', '😀'.repeat(11)],
    ['129 emoji', '😀'.repeat(129)],
  ])('rejects %s', async (_case, password) => {
    const { PasswordSchema } = await loadSchemas()

    expect(PasswordSchema.safeParse(password).success).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 123456789012],
  ])('rejects %s', async (_case, password) => {
    const { PasswordSchema } = await loadSchemas()

    expect(PasswordSchema.safeParse(password).success).toBe(false)
  })
})
