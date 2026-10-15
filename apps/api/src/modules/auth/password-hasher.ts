import { Algorithm, hash, verify } from '@node-rs/argon2'
import type { Options } from '@node-rs/argon2'
// Argon2id，OWASP 最低档：19 MiB、2 次迭代、1 线程；参数会写进哈希字符串。
const HASH_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} satisfies Options

// 只用异步版本，计算在后台线程进行，不阻塞其他请求。
export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS)
}

// 参数和盐从存储的哈希里读取；哈希损坏时按校验失败处理。
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password)
  } catch {
    return false
  }
}
