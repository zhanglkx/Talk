import type { INestApplication } from '@nestjs/common'
import { SuccessResponseInterceptor } from '@/common/interceptors/success-response.interceptor.js'
import { assignRequestId } from '@/common/middleware/request-id.middleware.js'
import { NotFoundFilter } from '@/common/filters/not-found.filter.js'

// 应用启动和 e2e 测试共用这个入口，确保路由前缀和全局响应处理一致。
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1')
  app.use(assignRequestId)
  app.useGlobalInterceptors(new SuccessResponseInterceptor())
  // configureApp 函数内
  app.useGlobalFilters(new NotFoundFilter())
}
