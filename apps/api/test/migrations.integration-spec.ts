import { join } from 'node:path'
import { readTestDatabaseConnection } from '@/config/test-database.js'
import { createMigrationDataSource } from '@/database/create-migration-data-source.js'

describe('Database migrations', () => {
  it('applies the expense type baseline to the dedicated database', async () => {
    const dataSource = createMigrationDataSource(
      readTestDatabaseConnection(process.env),
      join(import.meta.dirname, '..', 'dist', 'database'),
    )
    await dataSource.initialize()
    try {
      const databases = await dataSource.query<{ name: string }[]>(
        'SELECT current_database() AS name',
      )
      expect(databases).toEqual([{ name: 'expense_test' }])

      const migrations = await dataSource.query<{ name: string }[]>(
        'SELECT name FROM public.migrations',
      )
      expect(migrations.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          'CreateExpenseTypes1793351626145',
          'NameExpenseTypesPrimaryKey1793353278841',
        ]),
      )
      expect(dataSource.migrations.map(({ name }) => name)).toEqual(
        expect.arrayContaining(migrations.map(({ name }) => name)),
      )

      const constraints = await dataSource.query<{ name: string; definition: string }[]>(`
        SELECT conname AS name, pg_get_constraintdef(oid) AS definition
        FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.expense_types'::regclass AND contype IN ('p', 'u')
      `)
      expect(constraints).toEqual(
        expect.arrayContaining([
          { name: 'pk_expense_types', definition: 'PRIMARY KEY (id)' },
          { name: 'uq_expense_types_name', definition: 'UNIQUE (name)' },
        ]),
      )

      await expect(dataSource.runMigrations()).resolves.toHaveLength(0)
    } finally {
      await dataSource.destroy()
    }
  })
})
