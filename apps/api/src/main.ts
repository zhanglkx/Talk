import { NestFactory } from '@nestjs/core'
import { AppModule } from '@/app.module.js'
import { configureApp } from '@/configure-app.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  configureApp(app)
  // 只监听本机：开发机上的 API 不暴露给同一局域网里的其他设备
  await app.listen(process.env.PORT ?? 3000, '127.0.0.1')
}
await bootstrap()
