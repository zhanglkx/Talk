import { httpClient } from '@/api/http/client.ts'
import type { RequestOptions } from '@/api/http/client.ts'
import type {
  CreateExpenseTypeInput,
  ExpenseType,
  UpdateExpenseTypeInput,
} from '@/api/expense-types/types.ts'

const resource = '/expense-types'

export const expenseTypesApi = {
  list: (options?: RequestOptions) => httpClient.get<ExpenseType[]>(resource, options),

  create: (input: CreateExpenseTypeInput, options?: RequestOptions) =>
    httpClient.post<ExpenseType>(resource, input, options),

  update: (id: string, input: UpdateExpenseTypeInput, options?: RequestOptions) =>
    httpClient.patch<ExpenseType>(`${resource}/${encodeURIComponent(id)}`, input, options),

  disable: (id: string, options?: RequestOptions) =>
    httpClient.post<ExpenseType>(
      `${resource}/${encodeURIComponent(id)}/disable`,
      undefined,
      options,
    ),

  enable: (id: string, options?: RequestOptions) =>
    httpClient.post<ExpenseType>(
      `${resource}/${encodeURIComponent(id)}/enable`,
      undefined,
      options,
    ),
}
