// 本周手写接口契约，W2 改为引用 OpenAPI 生成类型。
export interface ExpenseType {
  id: string
  name: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateExpenseTypeInput {
  name: string
  description?: string
}

export interface UpdateExpenseTypeInput {
  name?: string
  description?: string
}
