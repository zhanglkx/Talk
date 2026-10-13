import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabaseOptions } from '../src/database/database-options.js'
import { createCliDataSource } from '../src/database/data-source.js'

const databaseUrl = 'postgresql://127.0.0.1:1/ledger_user_metadata_test'
const entityModulePath = new URL('../src/modules/users/user.entity.ts', import.meta.url).href

class MetadataDataSource extends DataSource {
  async buildOfflineMetadata(): Promise<void> {
    await this.buildMetadatas()
  }
}

async function loadUserEntity(): Promise<new () => object> {
  const entityModule = await import(entityModulePath)
  expect(entityModule.User).toBeTypeOf('function')
  return entityModule.User
}

async function buildUserMetadata() {
  const User = await loadUserEntity()
  const dataSource = new MetadataDataSource({
    ...createDatabaseOptions(databaseUrl),
    entities: [User],
  })
  await dataSource.buildOfflineMetadata()
  expect(dataSource.isInitialized).toBe(false)
  return dataSource.getMetadata(User)
}

beforeEach(() => {
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('User metadata tests must not connect to the database')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('User entity', () => {
  it('maps users with the required PostgreSQL column names, types and nullability', async () => {
    const metadata = await buildUserMetadata()

    expect(metadata.tableName).toBe('users')
    expect(metadata.primaryColumns.map((column) => column.propertyName)).toEqual(['id'])
    expect(metadata.columns).toHaveLength(4)
    expect(metadata.findColumnWithPropertyName('id')).toMatchObject({
      databaseName: 'id',
      type: 'uuid',
      isPrimary: true,
      isNullable: false,
    })
    expect(metadata.findColumnWithPropertyName('username')).toMatchObject({
      databaseName: 'username',
      type: 'varchar',
      length: '32',
      isNullable: false,
    })
    expect(metadata.findColumnWithPropertyName('passwordHash')).toMatchObject({
      databaseName: 'password_hash',
      type: 'text',
      isNullable: false,
    })
    expect(metadata.findColumnWithPropertyName('createdAt')).toMatchObject({
      databaseName: 'created_at',
      type: 'timestamptz',
      isNullable: false,
    })
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('declares a uniqueness constraint on username alone', async () => {
    const metadata = await buildUserMetadata()
    const uniqueColumnSets = [
      ...metadata.uniques.map((constraint) =>
        constraint.columns.map((column) => column.propertyName),
      ),
      ...metadata.indices
        .filter((index) => index.isUnique)
        .map((index) => index.columns.map((column) => column.propertyName)),
    ]

    expect(uniqueColumnSets).toContainEqual(['username'])
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('registers the same User entity in shared application options and the CLI data source', async () => {
    const User = await loadUserEntity()
    const options = createDatabaseOptions(databaseUrl)
    const dataSource = createCliDataSource(databaseUrl)

    expect(options.entities).toContain(User)
    expect(dataSource.options.entities).toEqual(options.entities)
    expect(dataSource.options).toMatchObject({
      synchronize: false,
      migrationsRun: false,
    })
    expect(options.manualInitialization).toBe(true)
    expect(dataSource.isInitialized).toBe(false)
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })
})
