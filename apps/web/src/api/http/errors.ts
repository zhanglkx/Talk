import axios from 'axios'

export type ApiErrorKind =
  'http' | 'network' | 'timeout' | 'canceled' | 'invalid-response' | 'unknown'

interface ApiErrorOptions {
  kind: ApiErrorKind
  status?: number
  code?: string
  requestId?: string
}

export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly requestId?: string

  constructor(message: string, options: ApiErrorOptions) {
    super(message)
    this.kind = options.kind
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
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
