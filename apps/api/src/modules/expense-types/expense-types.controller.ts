import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import type { CreateExpenseTypeDto } from '@/modules/expense-types/dto/create-expense-type.dto.js'
import type { UpdateExpenseTypeDto } from '@/modules/expense-types/dto/update-expense-type.dto.js'
import { ExpenseTypesService } from '@/modules/expense-types/expense-types.service.js'

// 只负责接收请求、调用 service、返回结果；业务规则都在 ExpenseTypesService 里。
// 路径里的 id 都经过 ParseUUIDPipe：不是合法的 UUID 时直接返回 400。
// 不检查的话，这个值会原样传给 PostgreSQL，uuid 列解析失败，接口返回 500
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExpenseTypeDto: UpdateExpenseTypeDto,
  ) {
    return this.expenseTypesService.update(id, updateExpenseTypeDto)
  }

  // 停用、启用改的是已有的记录，没有新建，所以返回 200，而不是 POST 默认的 201
  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenseTypesService.disable(id)
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenseTypesService.enable(id)
  }
}
