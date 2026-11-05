import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// 复用 Vite 的别名，测试和页面解析到同一份业务模块。
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['test/**/*.spec.ts'],
    },
  }),
)
