import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: false,
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ['test/**/*.integration-spec.ts'],
  },
})
