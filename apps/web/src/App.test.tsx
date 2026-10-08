import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('shows the ledger shell and reports a healthy API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }))

    render(<App />)

    expect(screen.getByRole('heading', { name: '个人账本与 AI 分析助手' })).toBeTruthy()
    expect((await screen.findByText('API 已连接')).closest('[role="status"]')).toBeTruthy()
  })

  it('does not treat an unsuccessful API response as connected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'ok' }),
    }))

    render(<App />)

    expect((await screen.findByText('API 暂不可用')).closest('[role="status"]')).toBeTruthy()
  })
})
