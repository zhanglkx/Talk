import { BadRequestException } from '@nestjs/common'

// Express 靠参数个数（4 个）认出错误处理中间件，所以未用到的参数也要保留。
type NextFunction = (error?: unknown) => void

// JSON 解析失败（body-parser 标记为 entity.parse.failed）时换成固定的 400。
// 原来的报错是 JSON.parse 的原文，会带出请求体的片段；请求体很短时整段带出，可能就是密码。
// 新异常不挂 cause：原错误的 body 属性存着完整请求体，以后的错误日志不能接触到它。
// 其他 body-parser 错误（413 过大、415 编码不支持等）原样往下传，它们的信息不含请求体。
export function rejectMalformedJson(
  error: unknown,
  _request: unknown,
  _response: unknown,
  next: NextFunction,
): void {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    next(new BadRequestException('Request body must be valid JSON'))
    return
  }
  next(error)
}
