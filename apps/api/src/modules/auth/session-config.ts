import type { SessionCookieOptions } from '@/modules/auth/session-store.js'

export const SESSION_COOKIE_NAME = 'ledger.sid'

// 不设 maxAge/expires：浏览器关闭即清除，真正的有效期由服务端的闲置/绝对截止时间控制。
// secure:false 只因为本地是 http://127.0.0.1；部署到 HTTPS 时要改成 true。
export const SESSION_COOKIE_OPTIONS: SessionCookieOptions = {
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
}

// 只在需要会话的路径上装中间件；挂到全部路径的话，数据库一断，带 Cookie 的 health 也会失败。
// app.use 不受全局前缀影响，所以要写完整路径。
export const SESSION_PATHS: readonly string[] = ['/api/v1/auth']

export const MIN_SECRET_LENGTH = 32

// 先判空再判长度：全是空格的值长度可能够 32，但等于没配。返回原值，不 trim。
// 错误信息里不带传入的值，避免密钥出现在日志里。
export function readSessionSecret(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('SESSION_SECRET is required')
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`)
  }
  return value
}
