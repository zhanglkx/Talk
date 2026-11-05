import axios from 'axios'
import type { AxiosResponse, Method } from 'axios'
import { normalizeApiError } from '@/api/http/errors.ts'

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>

export interface RequestOptions {
  signal?: AbortSignal
  timeout?: number
  params?: QueryParams
  headers?: Record<string, string>
}

type ApiPath = `/${string}`

interface HttpClientConfig {
  baseURL?: string
  timeout?: number
}

interface HttpClient {
  get<T>(path: ApiPath, options?: RequestOptions): Promise<T>
  post<T>(path: ApiPath, data?: unknown, options?: RequestOptions): Promise<T>
  put<T>(path: ApiPath, data?: unknown, options?: RequestOptions): Promise<T>
  patch<T>(path: ApiPath, data?: unknown, options?: RequestOptions): Promise<T>
  delete<T>(path: ApiPath, options?: RequestOptions): Promise<T>
}

// 业务模块共用下面的单例；工厂用于隔离配置，并让契约测试连接本机虚构 HTTP 服务。
export function createHttpClient(config: HttpClientConfig = {}): HttpClient {
  const transport = axios.create({
    baseURL: config.baseURL ?? '/api/v1',
    timeout: config.timeout ?? 10_000,
    allowAbsoluteUrls: false,
    headers: { Accept: 'application/json' },
    responseType: 'json',
    transitional: { silentJSONParsing: false, clarifyTimeoutError: true },
  })

  async function request<T>(
    method: Method,
    path: ApiPath,
    data: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    try {
      // 逐项传递可覆盖的配置，调用方不能借助 options 更换统一地址或关闭错误检查。
      const response = await transport.request<T, AxiosResponse<T, unknown>, unknown>({
        method,
        url: path,
        data,
        signal: options.signal,
        timeout: options.timeout,
        params: options.params,
        headers: options.headers,
      })
      // Axios 对 204 返回空字符串，这里统一成 void，避免调用方对空响应做 JSON 解析。
      return response.status === 204 ? (undefined as T) : response.data
    } catch (error: unknown) {
      throw normalizeApiError(error)
    }
  }

  return {
    get: (path, options) => request('GET', path, undefined, options),
    post: (path, data, options) => request('POST', path, data, options),
    put: (path, data, options) => request('PUT', path, data, options),
    patch: (path, data, options) => request('PATCH', path, data, options),
    delete: (path, options) => request('DELETE', path, undefined, options),
  }
}

export const httpClient = createHttpClient()
