import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { getDataSourceToken } from '@nestjs/typeorm'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

let app: INestApplication | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
  vi.restoreAllMocks()
})

async function createApp(databaseAvailable: boolean): Promise<{
  app: INestApplication
  ensureConnected: ReturnType<typeof vi.fn>
  runMigrations: ReturnType<typeof vi.fn>
}> {
  const ensureConnected = databaseAvailable
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(new Error('connection failed'))
  const runMigrations = vi.fn()
  const dataSource = {
    isInitialized: databaseAvailable,
    initialize: vi.fn(),
    query: databaseAvailable ? vi.fn().mockResolvedValue([{ '?column?': 1 }]) : vi.fn(),
    runMigrations,
    destroy: vi.fn().mockResolvedValue(undefined),
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .overrideProvider(getDataSourceToken())
    .useValue(dataSource)
    .compile()
  const testApp = moduleRef.createNestApplication<NestExpressApplication>()
  configureApp(testApp)
  await testApp.init()
  return { app: testApp, ensureConnected, runMigrations }
}

describe('GET /internal/ready', () => {
  it('returns 200 ready after ensureConnected when the database answers', async () => {
    const created = await createApp(true)
    app = created.app

    const response = await request(app.getHttpServer()).get('/internal/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ready' })
    expect(created.ensureConnected).toHaveBeenCalledTimes(1)
    expect(created.runMigrations).not.toHaveBeenCalled()
  })

  it('returns 503 not_ready when ensureConnected fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const created = await createApp(false)
    app = created.app

    const response = await request(app.getHttpServer()).get('/internal/ready')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'not_ready' })
    expect(created.ensureConnected).toHaveBeenCalledTimes(1)
    expect(created.runMigrations).not.toHaveBeenCalled()
  })
})
