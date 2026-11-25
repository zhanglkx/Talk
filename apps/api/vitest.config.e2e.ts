import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: false,
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
})
