import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { map } from 'rxjs'
import type { ResponseWithRequestId } from '@/common/request-context.js'

// Controller 的完整返回值放进 data，HTTP 状态码由 Nest 按路由设置。
@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const res = context.switchToHttp().getResponse<ResponseWithRequestId>()
    const requestId = res.locals.requestId

    return next.handle().pipe(map((data) => ({ data, requestId })))
  }
}
