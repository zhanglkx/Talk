import { readTestDatabaseConnection } from '@/config/test-database.js'

// 缺少 DATABASE_URL 时立刻报错。不能让它悄悄变成 undefined：pg 会改去连和系统用户同名的库，
// API 会在第一次查库时才失败，migration 甚至可能在错误的库里执行。
export function readDatabaseUrl(env: Record<string, unknown>): string {
  const url = env.DATABASE_URL
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('缺少环境变量 DATABASE_URL')
  }
  return url
}

export function readDatabaseConnection(env: Record<string, unknown>) {
  if (env.NODE_ENV === 'test') return readTestDatabaseConnection(env)
  return { url: readDatabaseUrl(env) }
}

// Nest 和迁移工具使用同一份连接配置，启动校验和实际连库使用同一个目标。
export function validateEnvironment(config: Record<string, unknown>) {
  return { ...config, databaseConnection: readDatabaseConnection(config) }
}
