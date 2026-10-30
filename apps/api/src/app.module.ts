import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { validateEnvironment } from '@/config/environment.js'
import { HealthModule } from '@/health/health.module.js'
import { ExpenseTypesModule } from '@/modules/expense-types/expense-types.module.js'

@Module({
  imports: [
    // 从当前目录的 .env 读取配置（用 pnpm 脚本启动时就是 apps/api/.env），已有的环境变量优先；
    // 启动时校验，缺了立刻报错退出。isGlobal 让其他模块不用再导入 ConfigModule 就能注入 ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        // getOrThrow<string> 拿到的是 string；get 不指定类型时返回 any，类型检查对它不起作用
        url: configService.getOrThrow<string>('DATABASE_URL'),
        // 各模块用 TypeOrmModule.forFeature 注册的实体自动加进来，不用在这里再列一遍
        autoLoadEntities: true,
        // 表结构只通过 migration 修改：打开它，启动时会按实体自动改表，可能悄悄删列、丢数据
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    ExpenseTypesModule,
  ],
})
export class AppModule {}
