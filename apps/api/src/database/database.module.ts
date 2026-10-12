import { Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseReadinessService } from './database-readiness.service.js'

const logger = new Logger('DatabaseModule')

@Module({
  imports: [
    // forRootAsync 会等配置模块读完环境变量，再生成这一份连接配置。
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        // 只认 DATABASE_URL 这一条连接串。没有它就启动失败，避免连到一个未配置的库。
        url: configService.getOrThrow<string>('DATABASE_URL'),
        // 启动时先不连接。数据库暂时不可用，进程仍然要能起来。
        manualInitialization: true,
        // 禁止 TypeORM 按代码自动改表，避免误删列或改字段类型。
        synchronize: false,
        // 启动时不自动执行建表脚本。改表必须是一次单独、可复查的命令。
        migrationsRun: false,
        // 还没有业务表需要映射。
        entities: [],
        // 3 秒内连不上就失败，请求不会一直挂着。
        connectTimeoutMS: 3_000,
        // 连接池是预先打开、反复借用的一组连接。这里只记发生了错误，不写连接串，避免密码进日志。
        poolErrorHandler: () => {
          logger.error('Database pool error')
        },
        extra: {
          // 单条查询超过 3 秒就中断。
          query_timeout: 3_000,
        },
      }),
    }),
  ],
  providers: [DatabaseReadinessService],
  exports: [DatabaseReadinessService],
})
export class DatabaseModule {}
