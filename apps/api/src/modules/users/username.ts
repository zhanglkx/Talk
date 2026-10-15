// 用户名规范化：seed 写入和登录查询共用这一条规则，同一个人的不同写法才会落到同一个账号。
// 纯字符串处理，不连数据库。

// 只允许 ASCII 字母、数字、下划线，长度 3～32（与 users.username 的 VARCHAR(32) 一致）。
// 大写也要允许：检查发生在转小写之前。
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/

// 合法时返回库里保存的形式（去掉首尾空白、转小写）；不合法返回 null，由调用方决定怎么回应。
export function normalizeUsername(input: string): string | null {
  const trimmed = input.trim()
  // 必须先检查再转小写：开尔文符号 K（U+212A）转小写后是普通的 k，先转会被误判为合法。
  if (!USERNAME_PATTERN.test(trimmed)) {
    return null
  }
  return trimmed.toLowerCase()
}
