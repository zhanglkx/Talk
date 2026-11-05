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
    // 成功和失败之后都刷新：超时或响应在路上丢了时，服务端可能已经写进库。
    // 不返回 Promise：保存结果一出来就关弹窗或提示错误，不用等列表取回（取回失败还会重试几秒）
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: expenseTypesKey })
    },
  })
}

export interface SetExpenseTypeEnabledVariables {
  id: string
  enabled: boolean
}

// 每一行各调用一次这个 Hook：同一个 mutation 只记得最后一次调用的参数，
// 各行用自己的实例，快速先后操作两行时，两行都能正确显示自己的加载状态
export function useSetExpenseTypeEnabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: SetExpenseTypeEnabledVariables) =>
      enabled ? expenseTypesApi.enable(id) : expenseTypesApi.disable(id),
    // 成功时返回 Promise：等列表取回才结束加载，按钮从「停用」换成「启用」时不会先闪回旧状态
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expenseTypesKey }),
    // 失败也刷新（服务端可能已经改了），但不等列表取回，错误提示马上出现
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: expenseTypesKey })
    },
  })
}
