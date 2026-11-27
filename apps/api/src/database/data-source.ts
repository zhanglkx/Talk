import { readDatabaseConnection } from '@/config/environment.js'
import { createMigrationDataSource } from '@/database/create-migration-data-source.js'

// TypeORM CLI 加载编译后的数据源，API 运行时使用 Nest 的实体注册。
export default createMigrationDataSource(readDatabaseConnection(process.env))
