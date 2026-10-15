import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { validateEnvironment } from '@/config/validate-environment.js'
import { DatabaseModule } from '@/database/database.module.js'
import { UsersModule } from '@/modules/users/users.module.js'
import { UsersRepository } from '@/modules/users/users.repository.js'
import { readDemoAccounts, seedDemoUsers } from '@/scripts/demo-users.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    UsersModule,
  ],
})
class SeedModule {}

async function main(): Promise<void> {
  const accounts = readDemoAccounts(process.env)
  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] })
  try {
    const results = await seedDemoUsers(accounts, app.get(UsersRepository))
    for (const { username, result } of results) {
      console.log(`${username}: ${result}`)
    }
  } finally {
    await app.close()
  }
}

main().catch((error: unknown) => {
  console.error(`seed:demo failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
