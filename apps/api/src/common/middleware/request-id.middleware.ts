import { randomUUID } from 'node:crypto'
import type { NextFunction, Request } from 'express'
import type { ResponseWithRequestId } from '@/common/request-context.js'

// 在解析请求体之前生成 ID，后续成功响应和异常过滤器都能使用响应头里的同一个值。
export function assignRequestId(_req: Request, res: ResponseWithRequestId, next: NextFunction) {
  const requestId = randomUUID()

  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}
