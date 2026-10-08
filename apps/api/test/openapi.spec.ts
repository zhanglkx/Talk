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
})
