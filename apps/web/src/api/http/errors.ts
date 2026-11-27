import axios from 'axios'

export type ApiErrorKind =
  'http' | 'network' | 'timeout' | 'canceled' | 'invalid-response' | 'unknown'

// path 与 antd Form 的 NamePath 同形，表单可直接交给 form.setFields 定位到字段。
export interface FieldError {
  path: (string | number)[]
  message: string
}

interface ApiErrorOptions {
  kind: ApiErrorKind
  status?: number
  code?: string
  requestId?: string
  fieldErrors?: FieldError[]
}

export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly requestId?: string
  // 仅在服务端定位到具体字段时存在；没有时调用方只展示 message。
  readonly fieldErrors?: FieldError[]

  constructor(message: string, options: ApiErrorOptions) {
    super(message)
    this.kind = options.kind
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
    this.fieldErrors = options.fieldErrors
  }
}

export function isRequestCanceled(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'canceled'
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function errorMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const messages = value.filter(
      (item): item is string => typeof item === 'string' && !!item.trim(),
    )
    return messages.length ? messages.join('；') : undefined
  }
  return nonEmptyString(value)
}

// 路径段只能是非空字段名或从 0 开始的数组下标；负数、小数对应不到任何数组元素。
function isPathSegment(value: unknown): value is string | number {
  if (typeof value === 'string') return value.length > 0
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// 空 path 不算字段错误：作用于整个请求体的问题定位不到输入框，应放进外层 message。
function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== 'object' || value === null) return false
  if (!('path' in value) || !('message' in value)) return false
  const path: unknown = value.path
  if (!Array.isArray(path)) return false
  // Array.isArray 会收窄成 any[]，转存为 unknown[]，让每一段仍经过类型守卫检查。
  const segments: unknown[] = path
  return segments.length > 0 && segments.every(isPathSegment) && !!nonEmptyString(value.message)
}

// 响应体来自网络，不可信：有一项结构不合格就整组忽略，退回只用整体提示，避免表单拿到无法定位的路径。
function fieldErrorList(value: unknown): FieldError[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items: unknown[] = value
  if (items.length === 0 || !items.every(isFieldError)) return undefined
  // 只复制约定的两个属性，路径另建数组，ApiError 不与原始响应数据共享引用。
  return items.map((item) => ({ path: [...item.path], message: item.message }))
}

const httpMessages: Record<number, string> = {
  400: '请求参数有误',
  401: '请先登录',
  403: '没有操作权限',
  404: '请求资源不存在',
  409: '数据冲突，请刷新后重试',
  429: '请求过于频繁，请稍后重试',
}

// 只暴露处理错误所需的信息，错误对象不携带原始请求、请求体或认证配置。
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError('请求已取消', { kind: 'canceled' })

  if (axios.isAxiosError<unknown, unknown>(error)) {
    const response = error.response
    if (response && (response.status < 200 || response.status >= 300)) {
      const payload: Record<string, unknown> =
        response.data && typeof response.data === 'object' && !Array.isArray(response.data)
          ? (response.data as Record<string, unknown>)
          : {}
      const message =
        response.status >= 500
          ? '服务暂时不可用，请稍后重试'
          : (errorMessage(payload.message) ??
            httpMessages[response.status] ??
            '请求失败，请稍后重试')

      return new ApiError(message, {
        kind: 'http',
        status: response.status,
        code: nonEmptyString(payload.code),
        requestId:
          nonEmptyString(response.headers['x-request-id']) ?? nonEmptyString(payload.requestId),
        // 5xx 只给统一提示，不暴露服务端返回的任何细节。
        fieldErrors: response.status >= 500 ? undefined : fieldErrorList(payload.fieldErrors),
      })
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return new ApiError('请求超时，请稍后重试', { kind: 'timeout' })
    }
    if (error.code === 'ERR_BAD_RESPONSE') {
      return new ApiError('服务器响应格式有误，请稍后重试', { kind: 'invalid-response' })
    }
    if (error.request || error.code === 'ERR_NETWORK') {
      return new ApiError('网络连接失败，请检查网络后重试', { kind: 'network' })
    }
  }

  return new ApiError('请求失败，请稍后重试', { kind: 'unknown' })
}
