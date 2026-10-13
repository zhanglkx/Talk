// TypeORM CLI 的独立入口：加载时校验配置并创建连接对象，不连接数据库或执行迁移。
// 不导入 AppModule，避免为命令行操作启动整个 Nest 应用。
import 'reflect-metadata'
import { validateEnvironment } from '@/config/validate-environment.js'
import { createCliDataSource } from '@/database/data-source.js'

// 只读取进程环境，不自动加载 .env；调用命令负责提供 DATABASE_URL。
// 复用应用的校验规则，缺少或非法配置时直接失败。
const environment = validateEnvironment(process.env)

// 复用共享配置创建 DataSource；此时不会调用 initialize，连接由后续 CLI 操作建立。
const dataSource = createCliDataSource(environment.DATABASE_URL)

// 只导出这一份数据源，避免 TypeORM CLI 检测到多个 DataSource 导出。
export default dataSource
