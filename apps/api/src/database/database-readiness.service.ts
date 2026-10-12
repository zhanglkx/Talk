import { Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ConnectionLifecycleService } from './connection-lifecycle.service.js'

@Injectable()
export class DatabaseReadinessService {
  private readonly logger = new Logger(DatabaseReadinessService.name)

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connectionLifecycleService: ConnectionLifecycleService,
  ) {}

  async isReady(): Promise<boolean> {
    try {
      await this.connectionLifecycleService.ensureConnected()
      await this.dataSource.query('SELECT 1')
      return true
    } catch {
      this.logger.warn('Database readiness check failed')
      return false
    }
  }
}
