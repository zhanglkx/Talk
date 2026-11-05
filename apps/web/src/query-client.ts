import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/index.ts'

// 失败后最多再试 2 次（共 3 次），间隔用 TanStack Query 默认的 1 秒、2 秒
const MAX_QUERY_RETRIES = 2

// 只重试可能自己恢复的错误：网络断开、服务端临时故障（5xx）。
// 4xx 是请求本身有问题，原样重发结果不变；超时已经等了 10 秒，自动重试只会让用户等更久，
// 还会给本来就慢的服务端加压，交给用户点「重试」。
function shouldRetryQuery(failureCount: number, error: Error) {
  if (failureCount >= MAX_QUERY_RETRIES || !(error instanceof ApiError)) return false
  return error.kind === 'network' || (error.kind === 'http' && (error.status ?? 0) >= 500)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    // 只给查询配重试：GET 只读，重发不会改数据。写操作（mutation）保持默认的不重试：
    // 新增不是幂等的，第一次可能已经写进库、只是响应在路上丢了，重试会再建一条。
    queries: { retry: shouldRetryQuery },
  },
})
