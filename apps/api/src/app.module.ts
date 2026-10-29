import { Module } from '@nestjs/common'
import { HealthModule } from '@/health/health.module.js'
import { ExpenseTypesModule } from '@/modules/expense-types/expense-types.module.js'

@Module({
  imports: [HealthModule, ExpenseTypesModule],
})
export class AppModule {}
