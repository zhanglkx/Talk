import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { DatabaseReadinessService } from '../src/database/database-readiness.service.js'

let app: INestApplication | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /api/v1/health', () => {
  it('returns process liveness without checking database readiness', async () => {
    const isReady = vi.fn(() => {
      throw new Error('health must not check database readiness')
    })
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseReadinessService)
      .useValue({ isReady })
      .compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    const response = await request(app.getHttpServer()).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(isReady).not.toHaveBeenCalled()
  })
})
