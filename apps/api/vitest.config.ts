import { defineConfig } from 'vitest/config'

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
    exclude: ['test/database.smoke.spec.ts'],
  },
})
