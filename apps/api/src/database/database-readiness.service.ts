import { Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class DatabaseReadinessService {
  private readonly logger = new Logger(DatabaseReadinessService.name)
  private initializationPromise: Promise<void> | undefined

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async isReady(): Promise<boolean> {
    try {
      await this.ensureInitialized()
      await this.dataSource.query('SELECT 1')
      return true
    } catch {
      this.logger.warn('Database readiness check failed')
      return false
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise
      return
    }

    if (this.dataSource.isInitialized) {
      return
    }

    const initializationPromise = this.dataSource.initialize().then(() => undefined)
    this.initializationPromise = initializationPromise

    try {
      await initializationPromise
    } finally {
      if (this.initializationPromise === initializationPromise) {
        this.initializationPromise = undefined
      }
    }
  }
}
