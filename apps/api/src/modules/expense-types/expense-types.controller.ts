import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
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

  @Post()
  async create(@Body() createExpenseTypeDto: CreateExpenseTypeDto) {
    return this.expenseTypesService.create(createExpenseTypeDto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateExpenseTypeDto: UpdateExpenseTypeDto) {
    return this.expenseTypesService.update(id, updateExpenseTypeDto)
  }

  @Post(':id')
  async disable(@Param('id') id: string) {
    return this.expenseTypesService.disable(id)
  }

  @Post(':id/enable')
  async enable(@Param('id') id: string) {
    return this.expenseTypesService.enable(id)
  }
}
