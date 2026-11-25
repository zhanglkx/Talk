import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { validateEnvironment } from '@/config/environment.js'
import { HealthModule } from '@/health/health.module.js'
import { ExpenseReportsModule } from '@/modules/expense-reports/expense-reports.module.js'
import { ExpenseTypesModule } from '@/modules/expense-types/expense-types.module.js'

@Module({
  imports: [
    // 测试库必须由测试进程显式指定，不能从开发环境文件补全。
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService<ReturnType<typeof validateEnvironment>>) => ({
        type: 'postgres',
        ...configService.getOrThrow('databaseConnection', { infer: true }),
        // 各模块用 TypeOrmModule.forFeature 注册的实体自动加进来，不用在这里再列一遍
        autoLoadEntities: true,
        // 表结构只通过 migration 修改：打开它，启动时会按实体自动改表，可能悄悄删列、丢数据
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    ExpenseTypesModule,
    ExpenseReportsModule,
  ],
})
export class AppModule {}
