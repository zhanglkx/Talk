import { Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ConnectionLifecycleService } from '@/database/connection-lifecycle.service.js'

// 回答数据库现在能不能用。连接是否建立交给 ConnectionLifecycleService。
@Injectable()
export class DatabaseReadinessService {
  private readonly logger = new Logger(DatabaseReadinessService.name)

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connectionLifecycleService: ConnectionLifecycleService,
  ) {}

  async isReady(): Promise<boolean> {
    try {
      // 连接对象建立后，还要确认数据库真的能回答。失败返回 false，进程继续运行。
      await this.connectionLifecycleService.ensureConnected()
      // 向数据库发一条最简单的查询，确认它现在真的能回答。
      // 查询成功，方法返回 true，就绪接口回答可用；查询抛错，被下面的 catch 接住
      await this.dataSource.query('SELECT 1')
      return true
    } catch {
      this.logger.warn('Database readiness check failed')
      return false
    }
  }
}
