import 'reflect-metadata'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DataSource } from 'typeorm'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'

const dir = dirname(fileURLToPath(import.meta.url))

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [ExpenseTypeEntity],
  migrations: [join(dir, 'migrations', '*.js')],
  synchronize: false,
})
