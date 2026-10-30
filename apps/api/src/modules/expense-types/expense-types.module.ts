import { Module } from '@nestjs/common'
import { ExpenseTypesController } from '@/modules/expense-types/expense-types.controller.js'
import { ExpenseTypesService } from '@/modules/expense-types/expense-types.service.js'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseTypeEntity])],
  controllers: [ExpenseTypesController],
  providers: [ExpenseTypesService],
})
export class ExpenseTypesModule {}
