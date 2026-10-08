import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { afterEach, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'

let app: INestApplication | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('OpenAPI contract', () => {
  it('documents the health response consumed by the web app', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Ledger API').setVersion('1.0').build(),
    )

    expect(document.paths['/api/v1/health']?.get?.responses?.['200']).toBeDefined()
    expect(document.components?.schemas?.HealthResponse).toMatchObject({
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ok'] } },
    })
  })

  it('documents ready and not-ready responses for the readiness endpoint', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Ledger API').setVersion('1.0').build(),
    )

    expect(document.paths['/internal/ready']?.get?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ReadyResponse' },
          example: { status: 'ready' },
        },
      },
    })
    expect(document.paths['/internal/ready']?.get?.responses?.['503']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/NotReadyResponse' },
          example: { status: 'not_ready' },
        },
      },
    })
    expect(document.components?.schemas?.ReadyResponse).toMatchObject({
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['ready'], example: 'ready' },
      },
    })
    expect(document.components?.schemas?.NotReadyResponse).toMatchObject({
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['not_ready'], example: 'not_ready' },
      },
    })
  })
})
