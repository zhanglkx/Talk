import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ExpenseReportItemEntity } from '@/modules/expense-reports/expense-report-item.entity.js'
import { ExpenseReportEntity } from '@/modules/expense-reports/expense-report.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseReportEntity, ExpenseReportItemEntity])],
})
export class ExpenseReportsModule {}
