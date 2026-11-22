import 'reflect-metadata'
import { join } from 'node:path'
import { DataSource } from 'typeorm'
import type { readDatabaseConnection } from '@/config/environment.js'

export function createMigrationDataSource(
  connection: ReturnType<typeof readDatabaseConnection>,
  databaseDirectory = import.meta.dirname,
): DataSource {
  // CLI 和测试使用同一份构建产物，TypeORM 可以直接加载带装饰器的实体和迁移。
  return new DataSource({
    type: 'postgres',
    ...connection,
    entities: [join(databaseDirectory, '..', '**', '*.entity.js')],
    migrations: [join(databaseDirectory, 'migrations', '*.js')],
    synchronize: false,
  })
}
