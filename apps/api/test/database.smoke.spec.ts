import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { DatabaseReadinessService } from '../src/database/database-readiness.service.js'

describe('database smoke', () => {
  let moduleRef: TestingModule | undefined

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  it('reports ready through the real PostgreSQL connection', async () => {
    const readiness = moduleRef?.get(DatabaseReadinessService)

    await expect(readiness?.isReady()).resolves.toBe(true)
  })
})
