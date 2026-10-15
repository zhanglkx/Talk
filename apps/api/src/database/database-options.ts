import { Logger } from '@nestjs/common'
import type { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { User } from '@/modules/users/user.entity.js'
import { CreateUsers1791849600000 } from '@/database/migrations/1791849600000-create-users.js'
import { Session } from '@/modules/auth/session.entity.js'
import { CreateSessions1791936000000 } from '@/database/migrations/1791936000000-create-sessions.js'

// 只描述怎么连。不创建连接，也不读取环境变量；调用方把地址传进来。
const logger = new Logger('DatabaseModule')

export function createDatabaseOptions(databaseUrl: string) {
  return {
    type: 'postgres' as const,
    // 只认调用方传来的这一条连接串。函数自己不读环境变量，测试才能用假地址。
    url: databaseUrl,
    // 启动时先不连接。数据库暂时不可用，进程仍然要能起来。
    manualInitialization: true,
    // 禁止 TypeORM 按代码自动改表，避免误删列或改字段类型。
    synchronize: false,
    // 启动时不自动执行建表脚本。改表必须是一次单独、可复查的命令。
    migrationsRun: false,
    // 应用和 CLI 共用的实体映射。
    entities: [User, Session],
    // 按时间戳顺序执行；sessions 引用 users，必须在后。
    migrations: [CreateUsers1791849600000, CreateSessions1791936000000],
    // 3 秒内连不上就失败，请求不会一直挂着。
    connectTimeoutMS: 3_000,
    // 连接池是预先打开、反复借用的一组连接。这里只记发生了错误，不写连接串，避免密码进日志。
    poolErrorHandler: (_error: unknown) => {
      logger.error('Database pool error')
    },
    extra: {
      // 单条查询超过 3 秒就中断。
      query_timeout: 3_000,
    },
  } satisfies TypeOrmModuleOptions
}
