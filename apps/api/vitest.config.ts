import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-env.ts'],
    include: ['test/**/*.spec.ts'],
    // 真实数据库测试只由 test:db 运行（vitest.integration.config.ts），默认命令不碰真实库。
    exclude: [...configDefaults.exclude, 'test/integration/**'],
  },
})
