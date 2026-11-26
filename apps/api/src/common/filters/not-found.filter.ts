import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { ResponseWithRequestId } from '@/common/request-context.js'

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter<NotFoundException> {
  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<ResponseWithRequestId>()
    const body = exception.getResponse()
    const code =
      typeof body === 'object' && 'code' in body && typeof body.code === 'string'
        ? body.code
        : 'NOT_FOUND'

    res.status(exception.getStatus()).json({
      code,
      message: exception.message,
      requestId: res.locals.requestId,
    })
  }
}
