import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-env.ts'],
    include: ['test/**/*.spec.ts'],
    exclude: ['test/database.smoke.spec.ts'],
  },
})
