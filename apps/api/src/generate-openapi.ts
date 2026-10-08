import 'reflect-metadata'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module.js'
import { configureApp } from './configure-app.js'

const app = await NestFactory.create(AppModule, { logger: false })

try {
  configureApp(app)
  await app.init()

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Ledger API').setVersion('1.0').build(),
  )
  const path = resolve(process.cwd(), '../../docs/openapi.json')
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`)
} finally {
  await app.close()
}
