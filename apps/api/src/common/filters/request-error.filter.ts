import {
  BadRequestException,
  Catch,
  NotFoundException,
  ConflictException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import { isFieldError, type FieldError } from '@/common/field-error.js'
import type { ResponseWithRequestId } from '@/common/request-context.js'

type RequestError = BadRequestException | NotFoundException | ConflictException

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

  if (exception instanceof NotFoundException) {
    return 'NOT_FOUND'
  }

  return 'CONFLICT'
}

// 只输出结构合格的字段错误，并且只复制 path 和 message，避免把异常对象里的其他内容带给客户端。
// 有一项不合格就整组不输出：说明抛出方写错了，应由测试暴露，而不是只展示半份清单。
function getFieldErrors(exception: RequestError): FieldError[] | undefined {
  const details = exception.getResponse()
  if (typeof details === 'string' || !('fieldErrors' in details)) {
    return undefined
  }

  const list: unknown = details.fieldErrors
  if (!Array.isArray(list)) {
    return undefined
  }
  const items: unknown[] = list
  if (items.length === 0 || !items.every(isFieldError)) {
    return undefined
  }

  // 路径另建数组，响应数据不与异常对象共享引用。
  return items.map((item) => ({ path: [...item.path], message: item.message }))
}

@Catch(BadRequestException, NotFoundException, ConflictException)
export class RequestErrorFilter implements ExceptionFilter<RequestError> {
  catch(exception: RequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<ResponseWithRequestId>()

    res.status(exception.getStatus()).json({
      code: getErrorCode(exception),
      message: exception.message,
      requestId: res.locals.requestId,
      // 值为 undefined 时 JSON 序列化会省略这个键，对应契约里的可选字段
      fieldErrors: getFieldErrors(exception),
    })
  }
}
