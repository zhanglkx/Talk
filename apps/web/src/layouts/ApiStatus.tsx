import { useEffect, useState } from 'react'
import { Badge } from 'antd'
import { fetchHealth } from '@/api/health.ts'

type ConnectionStatus = 'checking' | 'online' | 'offline'

// 每种状态对应的圆点颜色和文字
const statusView = {
  checking: { badge: 'processing', text: '正在连接 API…' },
  online: { badge: 'success', text: 'API 已连接' },
  offline: { badge: 'error', text: 'API 不可用' },
} as const

export default function ApiStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()

    async function check() {
      try {
        const health = await fetchHealth(controller.signal)
        if (!controller.signal.aborted) setStatus(health.status === 'ok' ? 'online' : 'offline')
      } catch {
        // 组件卸载时会主动取消请求，这不代表 API 不可用
        if (!controller.signal.aborted) setStatus('offline')
      }
    }

    void check()
    return () => controller.abort()
  }, [])

  const view = statusView[status]
  // role="status"：文字变化时，读屏软件会播报新的状态
  return (
    <span role="status">
      <Badge status={view.badge} text={view.text} />
    </span>
  )
}
