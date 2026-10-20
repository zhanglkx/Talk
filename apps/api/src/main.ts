import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from '@/app.module.js'
import { configureApp, configureSession } from '@/configure-app.js'

// 指明是 Express 版的应用，configureApp 要用到它特有的 useBodyParser。
const app = await NestFactory.create<NestExpressApplication>(AppModule)
configureApp(app)
configureSession(app)
app.enableShutdownHooks()
await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1')
