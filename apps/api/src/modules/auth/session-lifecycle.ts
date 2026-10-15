// 会话期限规则与会话 ID 摘要，供以后的 SessionStore 读写 sessions 表时共用。
// 纯函数：「现在」由调用方传入，不读系统时钟，测试可以直接给固定时间。
import { createHash } from 'node:crypto'

// 与 sessions 表的三个时间列对应。
export type SessionWindow = { lastSeenAt: Date; idleExpiresAt: Date; absoluteExpiresAt: Date }

// 闲置 12 小时、绝对 7 天（M1 PRD §4），单位毫秒。
export const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000
export const SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000

// 登录时创建：两个截止时间都从登录时刻算起。
// 每个 Date 都新建一份：Date 可以被修改，共用同一个对象会互相影响。
export function startSessionWindow(now: Date): SessionWindow {
  return {
    lastSeenAt: new Date(now.getTime()),
    idleExpiresAt: new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS),
    absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS),
  }
}

// 每次使用时续期：闲置截止后推 12 小时，但不越过绝对截止；绝对截止不变。
// 只计算新值、返回新对象，不修改传入的 window；会话是否仍有效由调用方先用 isSessionActive 判断。
export function touchSessionWindow(window: SessionWindow, now: Date): SessionWindow {
  const idleExpiresAt = Math.min(
    now.getTime() + SESSION_IDLE_TIMEOUT_MS,
    window.absoluteExpiresAt.getTime(),
  )
  return {
    lastSeenAt: new Date(now.getTime()),
    idleExpiresAt: new Date(idleExpiresAt),
    absoluteExpiresAt: new Date(window.absoluteExpiresAt.getTime()),
  }
}

// 早于两个截止时间才有效，到达任一截止点即失效。
// 用 getTime() 比较毫秒数：两个 Date 用 === 比较的是是不是同一个对象，不是时间值。
export function isSessionActive(window: SessionWindow, now: Date): boolean {
  const time = now.getTime()
  return time < window.idleExpiresAt.getTime() && time < window.absoluteExpiresAt.getTime()
}

// 数据库只存会话 ID 的 SHA-256 摘要（64 位小写 16 进制），明文 ID 只在 Cookie 里。
// 不用 Argon2：会话 ID 是随机长串，无法靠猜；查库需要同一 ID 每次得到同一摘要，加随机盐就查不到了。
export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex')
}
