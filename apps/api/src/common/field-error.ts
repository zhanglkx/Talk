// 字段错误是前后端的错误契约：抛出方（Service、校验管道）产生，过滤器写入响应。
// path 用数组而不是 "items[1].amountCents" 字符串，前端可原样交给 antd form.setFields 的 name。
export type FieldErrorPath = (string | number)[]

export type FieldError = {
  path: FieldErrorPath
  message: string
}

function isPathSegment(value: unknown): value is string | number {
  if (typeof value === 'string') {
    return value.length > 0
  }
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('path' in value) || !('message' in value)) {
    return false
  }

  const path: unknown = value.path
  if (!Array.isArray(path)) {
    return false
  }
  const segments: unknown[] = path
  if (segments.length === 0 || !segments.every(isPathSegment)) {
    return false
  }

  return typeof value.message === 'string' && value.message.trim().length > 0
}
