import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ExpenseTypesService } from '@/modules/expense-types/expense-types.service.js'
import type {
  CreateExpenseTypeDto,
  UpdateExpenseTypeDto,
} from '@/modules/expense-types/dto/create-expense-type.dto.js'

@Controller('expense-types')
export class ExpenseTypesController {
  constructor(private readonly expenseTypesService: ExpenseTypesService) {}

  @Get()
  async findAll() {
    return this.expenseTypesService.findAll()
  }

  // 新建了一条记录，用 POST 默认的 201 Created
  @Post()
  async create(@Body() createExpenseTypeDto: CreateExpenseTypeDto) {
    return this.expenseTypesService.create(createExpenseTypeDto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateExpenseTypeDto: UpdateExpenseTypeDto) {
    return this.expenseTypesService.update(id, updateExpenseTypeDto)
  }

  // 停用、启用改的是已有的记录，没有新建，所以返回 200，而不是 POST 默认的 201
  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(@Param('id') id: string) {
    return this.expenseTypesService.disable(id)
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(@Param('id') id: string) {
    return this.expenseTypesService.enable(id)
  }
}
