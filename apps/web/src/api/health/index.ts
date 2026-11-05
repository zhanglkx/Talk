import { httpClient } from '@/api/http/client.ts'
import type { RequestOptions } from '@/api/http/client.ts'
import type { HealthResponse } from '@/api/health/types.ts'

export const healthApi = {
  get: (options?: RequestOptions) => httpClient.get<HealthResponse>('/health', options),
}
