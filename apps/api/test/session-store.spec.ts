import session from 'express-session'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSessionActive, startSessionWindow } from '../src/modules/auth/session-lifecycle.js'
import type { SessionChanges, SessionRecord } from '../src/modules/auth/sessions.repository.js'

// express-session 的 Store 适配层：把 get/set/touch/destroy 转成 SessionsRepository 调用。
// 这里用内存里的假仓储，只检查转换规则；真实数据库上的行为见 integration/session-store.db.spec.ts。
const storeModulePath = new URL('../src/modules/auth/session-store.ts', import.meta.url).href

type StoredSession = Record<string, unknown>
type Callback = (err?: unknown, value?: unknown) => void
type StoreLike = {
  get(sid: string, callback: Callback): void
  set(sid: string, sess: StoredSession, callback?: Callback): void
  touch(sid: string, sess: StoredSession, callback?: Callback): void
  destroy(sid: string, callback?: Callback): void
  load(sid: string, callback: Callback): void
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const loginAt = new Date('2026-10-15T08:00:00.000Z')
const at = (offsetMs: number) => new Date(loginAt.getTime() + offsetMs)
const cookieOptions = { path: '/', httpOnly: true, secure: false, sameSite: 'lax' as const }
const userId = '00000000-0000-4000-8000-00000000000a'
const otherUserId = '00000000-0000-4000-8000-00000000000b'
const sid = 'fixture-session-id'

// 内存版 SessionsRepository：行为与真实仓储一致（过期由 isSessionActive 判断，update 未命中返回 false）。
function createFakeSessions() {
  const rows = new Map<string, SessionRecord>()
  return {
    rows,
    create: vi.fn(async (id: string, record: SessionRecord) => {
      if (rows.has(id)) throw new Error('duplicate session id')
      rows.set(id, structuredClone(record))
    }),
    findActive: vi.fn(async (id: string, now: Date) => {
      const record = rows.get(id)
      return record && isSessionActive(record.window, now) ? structuredClone(record) : null
    }),
    update: vi.fn(async (id: string, changes: SessionChanges) => {
      const record = rows.get(id)
      if (!record) return false
      rows.set(id, { ...record, ...structuredClone(changes) })
      return true
    }),
    delete: vi.fn(async (id: string) => {
      rows.delete(id)
    }),
  }
}

type FakeSessions = ReturnType<typeof createFakeSessions>

async function createStore(sessions: FakeSessions, clock: () => Date): Promise<StoreLike> {
  const storeModule = await import(storeModulePath)
  expect(storeModule.PostgresSessionStore).toBeTypeOf('function')
  const store = new storeModule.PostgresSessionStore(sessions, cookieOptions, clock)
  expect(store).toBeInstanceOf(session.Store)
  return store
}

// 把回调式接口转成 Promise，并确认回调恰好被调用一次。
async function invoke(run: (callback: Callback) => void): Promise<[unknown, unknown]> {
  let calls = 0
  const result = await new Promise<[unknown, unknown]>((resolve) => {
    run((err, value) => {
      calls += 1
      resolve([err, value])
    })
  })
  await new Promise((resolve) => setImmediate(resolve))
  expect(calls).toBe(1)
  return result
}

function storedRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    userId,
    data: { csrfToken: 'fixture-csrf-token' },
    window: startSessionWindow(loginAt),
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PostgresSessionStore.get', () => {
  it('returns an unknown session as null', async () => {
    const store = await createStore(createFakeSessions(), () => at(HOUR))

    expect(await invoke((callback) => store.get(sid, callback))).toEqual([null, null])
  })

  it('rebuilds an active session with the configured cookie and a loaded marker', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(HOUR))

    const [err, value] = await invoke((callback) => store.get(sid, callback))

    expect(err).toBeNull()
    expect(value).toStrictEqual({
      cookie: { ...cookieOptions, originalMaxAge: null },
      userId,
      csrfToken: 'fixture-csrf-token',
      loadedFromStore: true,
    })
    expect(sessions.findActive).toHaveBeenCalledWith(sid, at(HOUR))
  })

  it('returns an expired session as null, using the injected clock', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(12 * HOUR))

    expect(await invoke((callback) => store.get(sid, callback))).toEqual([null, null])
  })

  it('produces data that express-session can inflate into a Session with a Cookie', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(HOUR))

    const [err, loaded] = await invoke((callback) => store.load(sid, callback))

    expect(err).toBeNull()
    expect(loaded).toBeInstanceOf(session.Session)
    const inflated = loaded as session.Session & StoredSession
    expect(inflated.id).toBe(sid)
    expect(inflated.userId).toBe(userId)
    expect(inflated.cookie).toBeInstanceOf(session.Cookie)
    expect(inflated.cookie).toMatchObject({ path: '/', httpOnly: true, secure: false })
    expect(inflated.cookie.sameSite).toBe('lax')
    // 不设过期时间（浏览器关闭即清除）；会话真正的有效期由服务端的两个截止时间控制。
    expect(inflated.cookie.expires).toBeNull()
  })
})

describe('PostgresSessionStore.set', () => {
  it('creates a new authenticated session with a fresh window and only the CSRF token as data', async () => {
    const sessions = createFakeSessions()
    const store = await createStore(sessions, () => loginAt)

    const [err] = await invoke((callback) =>
      store.set(
        sid,
        { cookie: { ...cookieOptions }, userId, csrfToken: 'fixture-csrf-token', views: 3 },
        callback,
      ),
    )

    expect(err).toBeFalsy()
    expect(sessions.create).toHaveBeenCalledExactlyOnceWith(sid, {
      userId,
      data: { csrfToken: 'fixture-csrf-token' },
      window: startSessionWindow(loginAt),
    })
    expect(sessions.update).not.toHaveBeenCalled()
  })

  it.each([
    ['without a userId', { csrfToken: 'fixture-csrf-token' }],
    ['without a CSRF token', { userId }],
    ['with a non-string userId', { userId: 42, csrfToken: 'fixture-csrf-token' }],
  ])('refuses to store a session %s', async (_case, fields) => {
    const sessions = createFakeSessions()
    const store = await createStore(sessions, () => loginAt)

    const [err] = await invoke((callback) =>
      store.set(sid, { cookie: { ...cookieOptions }, ...fields }, callback),
    )

    expect(err).toBeInstanceOf(Error)
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.update).not.toHaveBeenCalled()
    expect(sessions.rows.size).toBe(0)
  })

  it('updates a loaded session and extends its idle deadline from the stored window', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(6 * HOUR))

    const [err] = await invoke((callback) =>
      store.set(
        sid,
        { cookie: {}, userId, csrfToken: 'fixture-rotated-token', loadedFromStore: true },
        callback,
      ),
    )

    expect(err).toBeFalsy()
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.update).toHaveBeenCalledExactlyOnceWith(sid, {
      data: { csrfToken: 'fixture-rotated-token' },
      window: {
        lastSeenAt: at(6 * HOUR),
        idleExpiresAt: at(18 * HOUR),
        absoluteExpiresAt: at(7 * DAY),
      },
    })
  })

  it('does not bring back a loaded session that was deleted meanwhile', async () => {
    const sessions = createFakeSessions()
    const store = await createStore(sessions, () => at(HOUR))

    // 本次请求开始时读到了会话，随后另一个请求退出登录把它删掉了。
    const [err] = await invoke((callback) =>
      store.set(
        sid,
        { cookie: {}, userId, csrfToken: 'fixture-csrf-token', loadedFromStore: true },
        callback,
      ),
    )

    expect(err).toBeFalsy()
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.rows.size).toBe(0)
  })

  it('refuses to move a loaded session to another user', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(HOUR))

    const [err] = await invoke((callback) =>
      store.set(
        sid,
        { cookie: {}, userId: otherUserId, csrfToken: 'fixture-csrf-token', loadedFromStore: true },
        callback,
      ),
    )

    expect(err).toBeInstanceOf(Error)
    expect(sessions.update).not.toHaveBeenCalled()
    expect(sessions.rows.get(sid)?.userId).toBe(userId)
  })
})

describe('PostgresSessionStore.touch', () => {
  it('extends the idle deadline and keeps the stored data', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(6 * HOUR))

    const [err] = await invoke((callback) =>
      store.touch(sid, { cookie: {}, userId, csrfToken: 'ignored-by-touch' }, callback),
    )

    expect(err).toBeFalsy()
    expect(sessions.update).toHaveBeenCalledExactlyOnceWith(sid, {
      data: { csrfToken: 'fixture-csrf-token' },
      window: {
        lastSeenAt: at(6 * HOUR),
        idleExpiresAt: at(18 * HOUR),
        absoluteExpiresAt: at(7 * DAY),
      },
    })
  })

  it('never extends past the absolute deadline', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, {
      ...storedRecord(),
      window: { ...startSessionWindow(loginAt), idleExpiresAt: at(7 * DAY - 30 * 60 * 1000) },
    })
    const store = await createStore(sessions, () => at(7 * DAY - HOUR))

    await invoke((callback) => store.touch(sid, { cookie: {} }, callback))

    expect(sessions.rows.get(sid)?.window.idleExpiresAt).toEqual(at(7 * DAY))
  })

  it.each([
    ['unknown', undefined],
    ['expired', storedRecord()],
  ])('does nothing for an %s session', async (_case, record) => {
    const sessions = createFakeSessions()
    if (record) sessions.rows.set(sid, record)
    const store = await createStore(sessions, () => at(13 * HOUR))

    const [err] = await invoke((callback) => store.touch(sid, { cookie: {} }, callback))

    expect(err).toBeFalsy()
    expect(sessions.update).not.toHaveBeenCalled()
    expect(sessions.create).not.toHaveBeenCalled()
  })
})

describe('PostgresSessionStore.destroy', () => {
  it('deletes the session', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(HOUR))

    const [err] = await invoke((callback) => store.destroy(sid, callback))

    expect(err).toBeFalsy()
    expect(sessions.delete).toHaveBeenCalledExactlyOnceWith(sid)
    expect(sessions.rows.size).toBe(0)
  })

  it('works without a callback', async () => {
    const sessions = createFakeSessions()
    sessions.rows.set(sid, storedRecord())
    const store = await createStore(sessions, () => at(HOUR))

    store.destroy(sid)
    await vi.waitFor(() => expect(sessions.rows.size).toBe(0))
  })
})

describe('PostgresSessionStore error handling', () => {
  const loaded = { cookie: {}, userId, csrfToken: 'fixture-csrf-token', loadedFromStore: true }
  const fresh = { cookie: {}, userId, csrfToken: 'fixture-csrf-token' }

  it.each([
    ['get', 'findActive', (store: StoreLike, callback: Callback) => store.get(sid, callback)],
    [
      'set (new)',
      'create',
      (store: StoreLike, callback: Callback) => store.set(sid, fresh, callback),
    ],
    [
      'set (loaded)',
      'findActive',
      (store: StoreLike, callback: Callback) => store.set(sid, loaded, callback),
    ],
    [
      'touch',
      'findActive',
      (store: StoreLike, callback: Callback) => store.touch(sid, loaded, callback),
    ],
    ['destroy', 'delete', (store: StoreLike, callback: Callback) => store.destroy(sid, callback)],
  ] as const)(
    '%s passes a repository failure to the callback exactly once',
    async (_name, method, run) => {
      const sessions = createFakeSessions()
      const failure = new Error('database unavailable')
      sessions[method].mockRejectedValueOnce(failure)
      const store = await createStore(sessions, () => at(HOUR))

      const [err] = await invoke((callback) => run(store, callback))

      expect(err).toBe(failure)
    },
  )
})
