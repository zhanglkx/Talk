import type { INestApplication } from '@nestjs/common'
import { InternalServerErrorFilter } from '@/common/filters/internal-server-error.filter.js'
import { SuccessResponseInterceptor } from '@/common/interceptors/success-response.interceptor.js'
import { assignRequestId } from '@/common/middleware/request-id.middleware.js'
import { RequestErrorFilter } from '@/common/filters/request-error.filter.js'

// 应用启动和 e2e 测试共用这个入口，确保路由前缀和全局响应处理一致。
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1')
  app.use(assignRequestId)
  app.useGlobalInterceptors(new SuccessResponseInterceptor())
  // Nest 逆序匹配，已知业务异常优先交给 RequestErrorFilter。
  app.useGlobalFilters(
    new InternalServerErrorFilter(app.getHttpAdapter()),
    new RequestErrorFilter(),
  )
}
