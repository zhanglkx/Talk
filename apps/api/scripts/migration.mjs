import { existsSync } from 'node:fs'

// 开发迁移沿用本地配置；测试迁移只使用调用者显式提供的环境变量。
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env')
}
await import('typeorm/cli.js')
