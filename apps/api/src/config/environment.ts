// 环境变量的读取和校验放在这里：API 启动（ConfigModule）和 TypeORM 命令行工具（data-source.ts）共用同一条规则和报错。

// 缺少 DATABASE_URL 时立刻报错。不能让它悄悄变成 undefined：pg 会改去连和系统用户同名的库，
// API 会在第一次查库时才失败，migration 甚至可能在错误的库里执行。
export function readDatabaseUrl(env: Record<string, unknown>): string {
  const url = env.DATABASE_URL
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('缺少环境变量 DATABASE_URL')
  }
  return url
}

// 给 ConfigModule.forRoot 的 validate 用：启动时检查一遍，有问题就不让 API 启动
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  readDatabaseUrl(config)
  return config
}
