import { useEffect, useState } from 'react'
import type { components } from './generated/api-types'

type HealthResponse = components['schemas']['HealthResponse']

export function App() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'unavailable'>('checking')

  useEffect(() => {
    let active = true

    void fetch('/api/v1/health')
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed')
        return response.json() as Promise<HealthResponse>
      })
      .then((health) => {
        if (active) setConnectionStatus(health.status === 'ok' ? 'online' : 'unavailable')
      })
      .catch(() => {
        if (active) setConnectionStatus('unavailable')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <p>个人学习项目 · 仅使用虚构数据</p>
      <h1>个人账本与 AI 分析助手</h1>
      <p>Web 与 NestJS API 已接入同一个工作区。账本功能将按 PRD 分阶段实现。</p>
      <p role="status">
        {connectionStatus === 'checking'
          ? '正在连接 API…'
          : connectionStatus === 'online'
            ? 'API 已连接'
            : 'API 暂不可用'}
      </p>
    </main>
  )
}
