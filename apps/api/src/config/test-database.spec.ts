import { readDatabaseConnection, validateEnvironment } from '@/config/environment.js'

const testEnv = { NODE_ENV: 'test', DATABASE_URL: 'development-only' }

describe('测试库连接配置', () => {
  it.each([
    ['localhost', '127.0.0.1'],
    ['127.0.0.1', '127.0.0.1'],
    ['127.0.0.2', '127.0.0.2'],
    ['[::1]', '::1'],
  ])('将 %s 转成显式的回环地址和库名', (hostname, host) => {
    const env = { ...testEnv, TEST_DATABASE_URL: `postgresql://${hostname}/expense_test` }
    const expected = { host, port: 5432, database: 'expense_test' }
    expect(readDatabaseConnection(env)).toMatchObject(expected)
    expect(validateEnvironment(env).databaseConnection).toEqual(readDatabaseConnection(env))
  })

  it('保留显式端口并解码认证字段', () => {
    const connection = readDatabaseConnection({
      ...testEnv,
      TEST_DATABASE_URL: 'postgres://test%40user:demo%3Avalue@localhost:5433/expense_test',
    })
    expect(connection).toEqual({
      host: '127.0.0.1',
      port: 5433,
      database: 'expense_test',
      username: 'test@user',
      password: 'demo:value',
    })
  })

  it.each([undefined, '', '   '])('缺少测试配置时拒绝使用开发库', (value) => {
    expect(() => readDatabaseConnection({ ...testEnv, TEST_DATABASE_URL: value })).toThrow(
      '缺少环境变量 TEST_DATABASE_URL',
    )
  })

  it.each([
    'invalid',
    'https://localhost/expense_test',
    'postgres://db.example.invalid/expense_test',
    'postgres://192.0.2.1/expense_test',
    'postgres://[2001:db8::1]/expense_test',
    'postgres:///expense_test',
    'postgres://localhost/',
    'postgres://localhost/expense_dev',
    'postgres://localhost/expense_test/extra',
    'postgres://localhost:0/expense_test',
    'postgres://localhost:65536/expense_test',
    'postgres://localhost/expense_test?host=db.example.invalid',
    'postgres://localhost/expense_test?database=expense_dev',
    'postgres://localhost/expense_test#unused',
  ])('拒绝不符合测试库约定的地址 %s', (value) => {
    expect(() => readDatabaseConnection({ ...testEnv, TEST_DATABASE_URL: value })).toThrow()
  })

  it('认证字段无效时只提示原因', () => {
    expect(() =>
      readDatabaseConnection({
        ...testEnv,
        TEST_DATABASE_URL: 'postgres://demo:%FF@localhost/expense_test',
      }),
    ).toThrow(/^TEST_DATABASE_URL 中的认证信息编码无效$/)
  })

  it('开发模式继续使用原有 DATABASE_URL', () => {
    const env = { NODE_ENV: 'development', DATABASE_URL: 'development-only' }
    expect(readDatabaseConnection(env)).toEqual({ url: env.DATABASE_URL })
    expect(() => readDatabaseConnection({})).toThrow('缺少环境变量 DATABASE_URL')
  })
})
