import { DataSource } from 'typeorm'
import { createDatabaseOptions } from '@/database/database-options.js'

// 给命令行单独用的连接对象。创建时不连接。
export function createCliDataSource(databaseUrl: string): DataSource {
  return new DataSource(createDatabaseOptions(databaseUrl))
}

// 没连上就不要 destroy。TypeORM 这时会抛 CannotExecuteNotConnectedError，把原来的失败盖住。
export async function closeCliDataSource(dataSource: DataSource): Promise<void> {
  if (!dataSource.isInitialized) {
    return
  }

  await dataSource.destroy()
}
