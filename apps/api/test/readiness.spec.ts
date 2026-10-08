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

async function createApp(isReady: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseReadinessService)
    .useValue({ isReady: vi.fn().mockResolvedValue(isReady) })
    .compile()

  const testApp = moduleRef.createNestApplication()
  configureApp(testApp)
  await testApp.init()
  return testApp
}

describe('GET /internal/ready', () => {
  it('returns exactly 200 ready when the database is ready', async () => {
    app = await createApp(true)

    const response = await request(app.getHttpServer()).get('/internal/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ready' })
  })

  it('returns exactly 503 not_ready when the database is not ready', async () => {
    app = await createApp(false)

    const response = await request(app.getHttpServer()).get('/internal/ready')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'not_ready' })
  })

  it('is not exposed under the API version prefix', async () => {
    app = await createApp(true)

    const response = await request(app.getHttpServer()).get('/api/v1/internal/ready')

    expect(response.status).toBe(404)
  })
})
