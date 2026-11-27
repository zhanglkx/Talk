import {
  Catch,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  IntrinsicException,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import type { ResponseWithRequestId } from '@/common/request-context.js'

@Catch()
export class InternalServerErrorFilter extends BaseExceptionFilter<unknown> {
  private readonly logger = new Logger('ExceptionsHandler')

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (this.getStatus(exception) !== HttpStatus.INTERNAL_SERVER_ERROR) {
      super.catch(exception, host)
      return
    }

    if (!(exception instanceof IntrinsicException)) {
      this.logger.error(exception)
    }
    const res = host.switchToHttp().getResponse<ResponseWithRequestId>()
    const response = new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: res.locals.requestId,
    })
    super.catch(response, host)
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus()
    if (this.isHttpError(exception)) return exception.statusCode
    return HttpStatus.INTERNAL_SERVER_ERROR
  }
}
