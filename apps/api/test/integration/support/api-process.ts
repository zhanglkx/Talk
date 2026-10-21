import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

// 启动真正的 dist/main.js（和 pnpm start 相同）给真实库测试用；环境变量只注入这个子进程。
const apiRoot = fileURLToPath(new URL('../../../', import.meta.url))

export type RunningApi = { process: ChildProcess; baseUrl: string; output: () => string }

async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port')
  return address.port
}

// 等 health 返回 200 才算启动完成；进程提前退出或 10 秒内没开始监听都报错，并附上进程输出。
export async function startApi(environment: Record<string, string>): Promise<RunningApi> {
  const port = await freePort()
  const child = spawn('node', ['dist/main.js'], {
    cwd: apiRoot,
    env: { ...process.env, ...environment, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let raw = ''
  child.stdout?.on('data', (chunk) => (raw += String(chunk)))
  child.stderr?.on('data', (chunk) => (raw += String(chunk)))
  const output = () => stripVTControlCharacters(raw)
  let exitCode: number | null | undefined
  child.once('exit', (code) => (exitCode = code))
  const baseUrl = `http://127.0.0.1:${port}`

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (exitCode !== undefined) {
      throw new Error(`dist/main.js exited early with code ${exitCode}:\n${output()}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/health`)
      if (response.ok) return { process: child, baseUrl, output }
    } catch {
      // 还没开始监听，稍后重试。
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  child.kill('SIGKILL')
  throw new Error(`dist/main.js did not start listening:\n${output()}`)
}

// SIGTERM 让应用走正常关闭（释放连接池）；10 秒内没退出才强制结束。
export async function stopApi(api: RunningApi | undefined): Promise<void> {
  if (!api || api.process.exitCode !== null) return
  const exited = new Promise((resolve) => api.process.once('exit', resolve))
  api.process.kill('SIGTERM')
  const timer = setTimeout(() => api.process.kill('SIGKILL'), 10_000)
  await exited
  clearTimeout(timer)
}
