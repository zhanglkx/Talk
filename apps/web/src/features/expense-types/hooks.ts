import { useQuery } from '@tanstack/react-query'
import { expenseTypesApi } from '@/api/index.ts'

// 查询键只在这里定义：列表查询和写操作之后让缓存失效，必须用同一个键
const expenseTypesKey = ['expense-types'] as const

export function useExpenseTypes() {
  return useQuery({
    queryKey: expenseTypesKey,
    // 透传 signal：页面卸载或查询被取消时，中止还没回来的请求
    queryFn: ({ signal }) => expenseTypesApi.list({ signal }),
  })
}
