import { Algorithm, hash, verify } from '@node-rs/argon2'

const HASH_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  paralleist: 1,
}

export function hashPassword(password: string) {
  return hash(password, HASH_OPTIONS)
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password)
  } catch {
    return false
  }
}
