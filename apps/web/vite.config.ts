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
  server: {
    // 页面在 5173、API 在 3000，端口不同就是不同源，浏览器会拦下页面读取响应。
    // 由开发服务器转发 /api 开头的请求，浏览器只和 5173 打交道，API 不用开 CORS。
    // 目标写 127.0.0.1 而不是 localhost：localhost 可能先解析成 IPv6 的 ::1，而 API 只监听 IPv4
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
})
