import {
  BadRequestException,
  Catch,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { ResponseWithRequestId } from '@/common/request-context.js'

type RequestError = BadRequestException | NotFoundException

function hasBusinessCode(details: string | object): details is { code: string } {
  if (typeof details === 'string' || !('code' in details)) {
    return false
  }
  return typeof details.code === 'string'
}

function getErrorCode(exception: RequestError): string {
  const details = exception.getResponse()
  if (hasBusinessCode(details)) {
    return details.code
  }
  if (exception instanceof BadRequestException) {
    return 'VALIDATION_ERROR'
  }
  return 'NOT_FOUND'
}

@Catch(BadRequestException, NotFoundException)
export class RequestErrorFilter implements ExceptionFilter<RequestError> {
  catch(exception: RequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<ResponseWithRequestId>()

    res.status(exception.getStatus()).json({
      code: getErrorCode(exception),
      message: exception.message,
      requestId: res.locals.requestId,
    })
  }
}
