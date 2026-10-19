import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateEnvironment } from '../../src/config/validate-environment.js'
import { DatabaseModule } from '../../src/database/database.module.js'
import { hashPassword } from '../../src/modules/auth/password-hasher.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

// 用真实的 AuthModule 组装（它自己导入 UsersModule），在 ledger_it 上走完「查凭据 → 校验 Argon2id」。
const authModulePath = new URL('../../src/modules/auth/auth.module.ts', import.meta.url).href
const authServicePath = new URL('../../src/modules/auth/auth.service.ts', import.meta.url).href

type PublicUser = { id: string; username: string }
type AuthServiceLike = {
  verifyCredentials(username: string, password: string): Promise<PublicUser | null>
}

const fixtureUser: PublicUser = { id: randomUUID(), username: 'fixture_carol' }
const fixturePassword = 'fixture-Carol-passw0rd'

let client: Client | undefined
let moduleRef: TestingModule | undefined
let service: AuthServiceLike | undefined

function auth(): AuthServiceLike {
  if (!service) throw new Error('AuthService is not available')
  return service
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
  await client.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
    fixtureUser.id,
    fixtureUser.username,
    await hashPassword(fixturePassword),
  ])

  const { AuthModule } = await import(authModulePath)
  const { AuthService } = await import(authServicePath)
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      AuthModule,
    ],
  }).compile()
  await moduleRef.init()
  service = moduleRef.get<AuthServiceLike>(AuthService)
})

afterAll(async () => {
  // 关闭容器释放连接池，下一个测试文件才能重建 ledger_it。
  await moduleRef?.close()
  await client?.end()
})

describe('AuthService.verifyCredentials on a real PostgreSQL database', () => {
  it.each([
    ['the stored username', 'fixture_carol'],
    ['another spelling of it', '  Fixture_Carol '],
  ])('returns the stored user for the right password with %s', async (_case, username) => {
    await expect(auth().verifyCredentials(username, fixturePassword)).resolves.toStrictEqual(
      fixtureUser,
    )
  })

  it.each([
    ['a wrong password', 'fixture_carol', 'fixture-Wrong-passw0rd'],
    ['an unknown username', 'fixture_nobody', fixturePassword],
    ['an invalid username', 'fixture-carol', fixturePassword],
  ])('returns null for %s', async (_case, username, password) => {
    await expect(auth().verifyCredentials(username, password)).resolves.toBeNull()
  })
})
