export interface CreateExpenseTypeDto {
  name: string
  description?: string
}

export interface UpdateExpenseTypeDto {
  name?: string
  description?: string
}
