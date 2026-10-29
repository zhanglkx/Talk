// 本周手写接口类型；W2 改为从后端的 OpenAPI 文档自动生成，避免前后端对不上
export type HealthResponse = {
  status: string
}

// 只写路径、不写主机和端口：开发时由 Vite 转发给 API，上线后由 Nginx 转发，代码不用改
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health', { signal })
  // fetch 只在网络断开时才抛错；API 停掉时代理返回 502，要自己按状态码判断
  if (!response.ok) {
    throw new Error(`健康检查失败：HTTP ${response.status}`)
  }
  return (await response.json()) as HealthResponse
}
