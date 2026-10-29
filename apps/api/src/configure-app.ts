import type { INestApplication } from '@nestjs/common'

// 启动（main.ts）和测试都调用这一份配置。测试不经过 main.ts，配置如果只写在 main.ts 里，
// 测试中的应用就没有 /api/v1 前缀，测到的路由和真实运行时不一样。
// 以后的全局管道、过滤器、拦截器也加在这里。
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1')
}
