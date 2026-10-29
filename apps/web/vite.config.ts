import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@/" 指向 src/，和 tsconfig.app.json 的 paths 保持一致：Vite 只认这里，TypeScript 只认 paths。
    // 只匹配 "@" 和 "@/..."，@tanstack/react-query 这类带作用域的包不受影响
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
