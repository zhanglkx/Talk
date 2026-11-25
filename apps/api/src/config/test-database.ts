import { isIPv4 } from 'node:net'

export function readTestDatabaseConnection(env: Record<string, unknown>) {
  const value = env.TEST_DATABASE_URL
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('缺少环境变量 TEST_DATABASE_URL')
  }

  const url = URL.parse(value.trim())
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('TEST_DATABASE_URL 必须是 PostgreSQL 连接地址')
  }
  if (url.pathname !== '/expense_test') {
    throw new Error('测试数据库名称必须是 expense_test')
  }
  if (url.search || url.hash || url.port === '0') {
    throw new Error('TEST_DATABASE_URL 不支持查询参数、片段或端口 0')
  }

  // 把 localhost 固定到回环 IP，连接时无需再解析主机名。
  const hostname = url.hostname.toLowerCase()
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname
  if (host !== '[::1]' && !(isIPv4(host) && host.startsWith('127.'))) {
    throw new Error('测试数据库必须位于本机回环地址')
  }

  // 传给驱动的是校验过的字段，避免它用另一套规则重新解析原始连接串。
  try {
    return {
      host: host === '[::1]' ? '::1' : host,
      port: url.port ? Number(url.port) : 5432,
      database: 'expense_test',
      username: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
    }
  } catch {
    throw new Error('TEST_DATABASE_URL 中的认证信息编码无效')
  }
}
