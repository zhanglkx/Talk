import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseTypesApi } from '@/api/index.ts'
import type { CreateExpenseTypeInput } from '@/api/index.ts'

// 查询键只在这里定义：列表查询和写操作之后让缓存失效，必须用同一个键
const expenseTypesKey = ['expense-types'] as const

export function useExpenseTypes() {
  return useQuery({
    queryKey: expenseTypesKey,
    // 透传 signal：页面卸载或查询被取消时，中止还没回来的请求
    queryFn: ({ signal }) => expenseTypesApi.list({ signal }),
  })
}

export interface SaveExpenseTypeVariables {
  /** 不传表示新增 */
  id?: string
  input: CreateExpenseTypeInput
}

export function useSaveExpenseType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: SaveExpenseTypeVariables) =>
      id === undefined ? expenseTypesApi.create(input) : expenseTypesApi.update(id, input),
    // 不在前端手动改列表，而是让缓存失效、重新向后端要一份：去空格、默认启用、排序都以后端为准。
    // 返回 Promise，等列表取回后这次保存才算完成，弹窗关闭时列表已经是新数据
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expenseTypesKey }),
  })
}
