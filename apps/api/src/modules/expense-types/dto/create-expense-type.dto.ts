// 新增报销类型的请求体。本周只是 TypeScript 类型，运行时不做校验（W2 换成 Zod）
export interface CreateExpenseTypeDto {
  name: string
  description?: string
}
