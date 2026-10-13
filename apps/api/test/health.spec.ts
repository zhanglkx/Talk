import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

let app: INestApplication | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /api/v1/health', () => {
  it('returns 200 without connecting to the database', async () => {
    const ensureConnected = vi.fn(() => {
      throw new Error('health must not connect to the database')
    })
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConnectionLifecycleService)
      .useValue({ ensureConnected })
      .compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    const response = await request(app.getHttpServer()).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(ensureConnected).not.toHaveBeenCalled()
  })
})
