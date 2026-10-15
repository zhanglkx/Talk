import { defineConfig } from 'vitest/config'

// 真实 PostgreSQL 测试专用，只由 `pnpm --filter @ledger/api run test:db` 使用。
// 不加载 setup-env.ts：它会把 DATABASE_URL 改成连不上的地址；这里的连接串由运行命令临时注入。
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    // 这些测试会删除并重建同一个测试库，文件之间不能并行。
    fileParallelism: false,
    // 准备阶段要重建测试库、构建 API、执行一次迁移，比普通单测慢得多。
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
})
