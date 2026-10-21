// express-session 的 Store 适配：把它的 get/set/touch/destroy 转成 SessionsRepository 调用。
// 只做转换，期限规则在 session-lifecycle.ts，读写数据库在 SessionsRepository。
import session from 'express-session'
import { startSessionWindow, touchSessionWindow } from '@/modules/auth/session-lifecycle.js'
import type { SessionsRepository } from '@/modules/auth/sessions.repository.js'

// 给 req.session 补上这三个字段的类型。
declare module 'express-session' {
  interface SessionData {
    userId?: string
    // csrfToken: 用于防止 CSRF 攻击，每次登录生成。
    csrfToken?: string
    // 只有从数据库读出的会话才有；用来区分「刚登录的新会话」和「读出后被删掉的会话」。
    loadedFromStore?: true
  }
}

// 读出的会话按这里还原 Cookie：express-session 不会对已有会话重新套用中间件配置。
export type SessionCookieOptions = Pick<
  session.CookieOptions,
  'path' | 'httpOnly' | 'secure' | 'sameSite'
>
// 只依赖这四个方法，测试可以换成内存版。
type SessionsStorage = Pick<SessionsRepository, 'create' | 'findActive' | 'update' | 'delete'>

export class PostgresSessionStore extends session.Store {
  constructor(
    private readonly sessions: SessionsStorage,
    private readonly cookie: SessionCookieOptions,
    // 时钟可注入，测试用固定时间。
    private readonly now: () => Date = () => new Date(),
  ) {
    super()
  }

  // 下面四个公开方法只把结果交给回调；用 then(成功, 失败) 两参数写法，回调自己抛错时不会被再调一次。
  // 回调可能不传，所以写成 callback?.()。
  get(sid: string, callback: (err: unknown, sess?: session.SessionData | null) => void): void {
    this.read(sid).then(
      (sess) => callback(null, sess),
      (err: unknown) => callback(err),
    )
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    this.write(sid, sess).then(
      () => callback?.(),
      (err: unknown) => callback?.(err),
    )
  }

  touch(sid: string, _sess: session.SessionData, callback?: (err?: unknown) => void): void {
    this.extend(sid).then(
      () => callback?.(),
      (err: unknown) => callback?.(err),
    )
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.sessions.delete(sid).then(
      () => callback?.(),
      (err: unknown) => callback?.(err),
    )
  }

  // 不存在或已过期返回 null，express-session 会改为生成新会话。
  private async read(sid: string): Promise<session.SessionData | null> {
    const record = await this.sessions.findActive(sid, this.now())
    if (!record) return null
    return {
      // 不设过期时间，浏览器关闭即清除；真正的有效期由服务端的两个截止时间控制。
      cookie: { ...this.cookie, originalMaxAge: null },
      userId: record.userId,
      csrfToken: record.data.csrfToken,
      loadedFromStore: true,
    }
  }

  private async write(sid: string, sess: session.SessionData): Promise<void> {
    // 只保存已登录的会话。
    const { userId, csrfToken } = sess
    if (typeof userId !== 'string' || typeof csrfToken !== 'string') {
      throw new Error('Only authenticated sessions can be stored')
    }
    const now = this.now()
    // 没有标记：本次请求新建的会话（例如刚登录），期限从现在开始。
    if (sess.loadedFromStore !== true) {
      await this.sessions.create(sid, {
        userId,
        data: { csrfToken },
        window: startSessionWindow(now),
      })

      sess.loadedFromStore = true

      return
    }
    // 有标记：以数据库里的期限为准续期。读不到说明期间已退出或过期，不重新创建。
    const stored = await this.sessions.findActive(sid, now)
    if (!stored) return
    if (stored.userId !== userId) throw new Error('A session cannot change its user')
    await this.sessions.update(sid, {
      data: { csrfToken },
      window: touchSessionWindow(stored.window, now),
    })
  }

  // 会话内容没变时由 express-session 调用：只续期，数据保持库里的值。
  private async extend(sid: string): Promise<void> {
    const now = this.now()
    const stored = await this.sessions.findActive(sid, now)
    if (!stored) return
    await this.sessions.update(sid, {
      data: stored.data,
      window: touchSessionWindow(stored.window, now),
    })
  }
}
