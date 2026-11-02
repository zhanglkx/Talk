// 修改报销类型的请求体：只能改名称和说明，传了哪个改哪个。启用、停用走单独的接口
export interface UpdateExpenseTypeDto {
  name?: string
  description?: string
}
