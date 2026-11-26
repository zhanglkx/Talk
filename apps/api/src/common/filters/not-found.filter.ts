import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { ResponseWithRequestId } from '@/common/request-context.js'

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter<NotFoundException> {
  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<ResponseWithRequestId>()

    res.status(exception.getStatus()).json({
      code: 'NOT_FOUND',
      message: exception.message,
      requestId: res.locals.requestId,
    })
  }
}
