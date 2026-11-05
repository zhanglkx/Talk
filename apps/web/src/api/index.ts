// 页面和业务 Hook 的公共入口；HTTP 实例与错误归一化实现留在 api 内部。
export { healthApi } from '@/api/health/index.ts'
export type { HealthResponse } from '@/api/health/types.ts'
export { expenseTypesApi } from '@/api/expense-types/index.ts'
export type {
  ExpenseType,
  CreateExpenseTypeInput,
  UpdateExpenseTypeInput,
} from '@/api/expense-types/types.ts'
export { ApiError, isRequestCanceled } from '@/api/http/errors.ts'
export type { ApiErrorKind } from '@/api/http/errors.ts'
export type { RequestOptions } from '@/api/http/client.ts'
