import { Module } from '@nestjs/common'
import { ExpenseTypesController } from '@/modules/expense-types/expense-types.controller.js'
import { ExpenseTypesService } from '@/modules/expense-types/expense-types.service.js'

@Module({
  controllers: [ExpenseTypesController],
  providers: [ExpenseTypesService],
})
export class ExpenseTypesModule {}
