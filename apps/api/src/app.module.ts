import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HealthModule } from '@/health/health.module.js'
import { ExpenseTypesModule } from '@/modules/expense-types/expense-types.module.js'

function validate(config: Record<string, unknown>) {
  if (!config.DATABASE_URL) {
    throw new Error('缺少环境变量 DATABASE_URL')
  }
  return config
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    ExpenseTypesModule,
  ],
})
export class AppModule {}
