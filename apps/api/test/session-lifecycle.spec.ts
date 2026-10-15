import { describe, expect, it } from 'vitest'

// 会话期限规则：闲置 12 小时、绝对 7 天，到达任一截止点即失效（M1 PRD §4）。
// 「现在」由测试传入固定的虚构时间，不读系统时钟、不 sleep。
const lifecycleModulePath = new URL('../src/modules/auth/session-lifecycle.ts', import.meta.url)
  .href

type SessionWindow = { lastSeenAt: Date; idleExpiresAt: Date; absoluteExpiresAt: Date }
type SessionLifecycle = {
  SESSION_IDLE_TIMEOUT_MS: number
  SESSION_ABSOLUTE_TIMEOUT_MS: number
  startSessionWindow(now: Date): SessionWindow
  touchSessionWindow(window: SessionWindow, now: Date): SessionWindow
  isSessionActive(window: SessionWindow, now: Date): boolean
  hashSessionId(sessionId: string): string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const loginAt = new Date('2026-10-15T08:00:00.000Z')
const at = (offsetMs: number) => new Date(loginAt.getTime() + offsetMs)

async function loadLifecycle(): Promise<SessionLifecycle> {
  const lifecycleModule = await import(lifecycleModulePath)
  expect(lifecycleModule.startSessionWindow).toBeTypeOf('function')
  return lifecycleModule
}

function times(window: SessionWindow) {
  return {
    lastSeenAt: window.lastSeenAt.toISOString(),
    idleExpiresAt: window.idleExpiresAt.toISOString(),
    absoluteExpiresAt: window.absoluteExpiresAt.toISOString(),
  }
}

describe('session timeouts', () => {
  it('uses a 12-hour idle timeout and a 7-day absolute timeout', async () => {
    const { SESSION_IDLE_TIMEOUT_MS, SESSION_ABSOLUTE_TIMEOUT_MS } = await loadLifecycle()

    expect(SESSION_IDLE_TIMEOUT_MS).toBe(12 * HOUR)
    expect(SESSION_ABSOLUTE_TIMEOUT_MS).toBe(7 * DAY)
  })
})

describe('startSessionWindow', () => {
  it('starts both deadlines from the login time', async () => {
    const { startSessionWindow } = await loadLifecycle()

    expect(times(startSessionWindow(loginAt))).toEqual({
      lastSeenAt: '2026-10-15T08:00:00.000Z',
      idleExpiresAt: '2026-10-15T20:00:00.000Z',
      absoluteExpiresAt: '2026-10-22T08:00:00.000Z',
    })
  })
})

describe('isSessionActive', () => {
  it.each([
    ['right after login', 0, true],
    ['1 ms before the idle deadline', 12 * HOUR - 1, true],
    ['exactly at the idle deadline', 12 * HOUR, false],
    ['after the idle deadline', 13 * HOUR, false],
  ])('is %s: %s', async (_case, offset, expected) => {
    const { startSessionWindow, isSessionActive } = await loadLifecycle()
    expect(isSessionActive(startSessionWindow(loginAt), at(offset))).toBe(expected)
  })

  it('checks the earliest deadline even if the absolute one comes first', async () => {
    const { isSessionActive } = await loadLifecycle()
    // 正常数据里闲置截止不会晚于绝对截止（数据库有 CHECK），这里确认两个都会被检查。
    const window = {
      lastSeenAt: loginAt,
      idleExpiresAt: at(12 * HOUR),
      absoluteExpiresAt: at(HOUR),
    }

    expect(isSessionActive(window, at(HOUR - 1))).toBe(true)
    expect(isSessionActive(window, at(HOUR))).toBe(false)
  })
})

describe('touchSessionWindow', () => {
  it('moves the idle deadline to 12 hours after the touch and keeps the absolute one', async () => {
    const { startSessionWindow, touchSessionWindow, isSessionActive } = await loadLifecycle()
    const touched = touchSessionWindow(startSessionWindow(loginAt), at(6 * HOUR))

    expect(times(touched)).toEqual({
      lastSeenAt: '2026-10-15T14:00:00.000Z',
      idleExpiresAt: '2026-10-16T02:00:00.000Z',
      absoluteExpiresAt: '2026-10-22T08:00:00.000Z',
    })
    // 原来的闲置截止（20:00）已经过了，续期后仍然有效。
    expect(isSessionActive(touched, at(12 * HOUR + 1))).toBe(true)
    expect(isSessionActive(touched, at(18 * HOUR))).toBe(false)
  })

  it('never extends the idle deadline past the absolute deadline', async () => {
    const { startSessionWindow, touchSessionWindow, isSessionActive } = await loadLifecycle()
    const touched = touchSessionWindow(startSessionWindow(loginAt), at(7 * DAY - 2 * HOUR))

    expect(touched.idleExpiresAt.toISOString()).toBe('2026-10-22T08:00:00.000Z')
    expect(isSessionActive(touched, at(7 * DAY - 1))).toBe(true)
    expect(isSessionActive(touched, at(7 * DAY))).toBe(false)
  })

  it('cannot keep a session alive beyond 7 days however often it is touched', async () => {
    const { startSessionWindow, touchSessionWindow, isSessionActive } = await loadLifecycle()
    let window = startSessionWindow(loginAt)

    // 每 11 小时使用一次，从不超过闲置期限。
    for (let offset = 11 * HOUR; offset < 7 * DAY; offset += 11 * HOUR) {
      expect(isSessionActive(window, at(offset))).toBe(true)
      window = touchSessionWindow(window, at(offset))
      expect(window.idleExpiresAt.getTime()).toBeLessThanOrEqual(window.absoluteExpiresAt.getTime())
    }

    expect(window.absoluteExpiresAt.toISOString()).toBe('2026-10-22T08:00:00.000Z')
    expect(isSessionActive(window, at(7 * DAY))).toBe(false)
  })

  it('returns a new window and leaves the given one unchanged', async () => {
    const { startSessionWindow, touchSessionWindow } = await loadLifecycle()
    const original = startSessionWindow(loginAt)
    const before = times(original)

    const touched = touchSessionWindow(original, at(6 * HOUR))

    expect(touched).not.toBe(original)
    expect(times(original)).toEqual(before)
  })
})

describe('hashSessionId', () => {
  it('returns the lower-case hex SHA-256 digest that fits session_key_hash CHAR(64)', async () => {
    const { hashSessionId } = await loadLifecycle()

    // SHA-256("abc") 的公开测试向量（FIPS 180-2）。
    expect(hashSessionId('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(hashSessionId('fixture-session-id')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for the same id, differs between ids and never contains the id', async () => {
    const { hashSessionId } = await loadLifecycle()
    const sessionId = 'fixture-session-id-0001'

    expect(hashSessionId(sessionId)).toBe(hashSessionId(sessionId))
    expect(hashSessionId(sessionId)).not.toBe(hashSessionId('fixture-session-id-0002'))
    expect(hashSessionId(sessionId)).not.toContain(sessionId)
  })
})
