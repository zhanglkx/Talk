import { describe, expect, it } from 'vitest'

// 用户名规范化：seed 写入和登录查询共用同一规则，保证同一个人的不同写法落到同一个账号。
// 规则来自 M1 PRD §4：去掉首尾空白后，只允许 3～32 个 ASCII 字母、数字、下划线，再转小写。
const usernameModulePath = new URL('../src/modules/users/username.ts', import.meta.url).href

type NormalizeUsername = (input: string) => string | null

async function loadNormalizeUsername(): Promise<NormalizeUsername> {
  const usernameModule = await import(usernameModulePath)
  expect(usernameModule.normalizeUsername).toBeTypeOf('function')
  return usernameModule.normalizeUsername
}

describe('normalizeUsername', () => {
  it.each([
    ['alice', 'alice'],
    ['Alice', 'alice'],
    ['ALICE_01', 'alice_01'],
    ['  bob  ', 'bob'],
    ['\tCarol_2\n', 'carol_2'],
    ['abc', 'abc'],
    ['123', '123'],
    ['a'.repeat(32), 'a'.repeat(32)],
    [`  ${'B'.repeat(32)} `, 'b'.repeat(32)],
  ])('normalizes %j to %j', async (input, expected) => {
    const normalizeUsername = await loadNormalizeUsername()
    expect(normalizeUsername(input)).toBe(expected)
  })

  it('maps different spellings of the same name to one stored username', async () => {
    const normalizeUsername = await loadNormalizeUsername()
    const results = ['Alice', ' alice ', 'ALICE', 'aLiCe'].map(normalizeUsername)
    expect(new Set(results)).toEqual(new Set(['alice']))
  })

  it.each([
    ['an empty string', ''],
    ['only whitespace', '   '],
    ['2 characters', 'ab'],
    ['2 characters after trimming', '  ab  '],
    ['33 characters', 'a'.repeat(33)],
    ['33 characters after trimming', ` ${'a'.repeat(33)} `],
    ['an inner space', 'ali ce'],
    ['a hyphen', 'alice-1'],
    ['a dot', 'alice.b'],
    ['an at sign', 'alice@example'],
    ['Chinese characters', '张三丰'],
    ['an emoji', 'alice😀'],
    ['full-width letters', 'ａｌｉｃｅ'],
    ['a zero-width space', '\u200balice'],
    // 开尔文符号 U+212A 转小写后是普通的 k；先检查再转小写，才不会把它当成 kate。
    ['the Kelvin sign that lowercases to k', '\u212Aate'],
  ])('rejects %s', async (_description, input) => {
    const normalizeUsername = await loadNormalizeUsername()
    expect(normalizeUsername(input)).toBeNull()
  })
})
