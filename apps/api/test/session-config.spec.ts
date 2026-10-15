import { describe, expect, it } from 'vitest'

// 会话中间件的固定配置：Cookie 名称与属性、挂载路径、签名密钥的检查（M1 技术方案 §5）。
const configModulePath = new URL('../src/modules/auth/session-config.ts', import.meta.url).href

type SessionConfig = {
  SESSION_COOKIE_NAME: string
  SESSION_COOKIE_OPTIONS: Record<string, unknown>
  SESSION_PATHS: readonly string[]
  readSessionSecret(value: unknown): string
}

async function loadConfig(): Promise<SessionConfig> {
  const configModule = await import(configModulePath)
  expect(configModule.readSessionSecret).toBeTypeOf('function')
  return configModule
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

describe('session cookie settings', () => {
  it('uses ledger.sid with HttpOnly, SameSite=Lax, Path=/, no Domain and no Secure on loopback HTTP', async () => {
    const { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } = await loadConfig()

    expect(SESSION_COOKIE_NAME).toBe('ledger.sid')
    // 不设 maxAge/expires：浏览器关闭即清除，真正的有效期由服务端的两个截止时间控制。
    expect(SESSION_COOKIE_OPTIONS).toStrictEqual({
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    })
  })

  it('mounts sessions only on /api/v1/auth, never on health or internal routes', async () => {
    const { SESSION_PATHS } = await loadConfig()

    expect(SESSION_PATHS).toEqual(['/api/v1/auth'])
  })
})

describe('readSessionSecret', () => {
  it.each([
    ['exactly 32 characters', 's'.repeat(32)],
    ['a base64 value from openssl rand -base64 32', 'q3Vb0m2y7cFh0Kx1d9Zr4tWl6Nn8PpEa2sUu5gJk7Ho='],
  ])('accepts %s and returns it unchanged', async (_case, secret) => {
    const { readSessionSecret } = await loadConfig()
    expect(readSessionSecret(secret)).toBe(secret)
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['not a string', 12345],
    ['empty', ''],
    ['only whitespace', ' '.repeat(40)],
  ])('rejects a secret that is %s', async (_case, value) => {
    const { readSessionSecret } = await loadConfig()
    expect(() => readSessionSecret(value)).toThrow(/SESSION_SECRET is required/)
  })

  it('rejects a secret shorter than 32 characters without echoing it', async () => {
    const { readSessionSecret } = await loadConfig()
    const tooShort = 'fixture-short-secret-31-chars-x'
    expect(tooShort).toHaveLength(31)

    const error = captureError(() => readSessionSecret(tooShort))

    expect(error.message).toMatch(/SESSION_SECRET must be at least 32 characters/)
    expect(error.message).not.toContain(tooShort)
  })
})
