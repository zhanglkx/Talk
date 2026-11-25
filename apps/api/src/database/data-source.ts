import 'reflect-metadata'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DataSource } from 'typeorm'
import { readDatabaseConnection } from '@/config/environment.js'

// 只给 TypeORM 命令行工具用（生成、执行、回滚、查看 migration），API 运行时不加载这个文件。
// 命令行工具加载的是 dist 里编译好的版本，所以下面的路径都指向编译后的 .js 文件。
const dir = dirname(fileURLToPath(import.meta.url))

export default new DataSource({
  type: 'postgres',
  ...readDatabaseConnection(process.env),
  // 按文件名找出所有实体，新加的实体不会被漏掉；API 那边用的是 autoLoadEntities
  entities: [join(dir, '..', '**', '*.entity.js')],
  migrations: [join(dir, 'migrations', '*.js')],
  synchronize: false,
})
