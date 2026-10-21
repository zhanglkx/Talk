import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createConnection, createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const runCommand = promisify(execFile)
const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))

async function expectConnectionRefused(port: number): Promise<void> {
  const connection = new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(1_000)
    socket.once('connect', () => {
      socket.destroy()
      resolve()
    })
    socket.once('error', (error) => {
      socket.destroy()
      reject(error)
    })
    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error('Expected an immediate connection refusal'))
    })
  })

  await expect(connection).rejects.toMatchObject({ code: 'ECONNREFUSED' })
}

describe('offline contracts generation', () => {
  it('runs the actual contracts command and generates OpenAPI and Web types without a database', async () => {
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    if (!address || typeof address === 'string') {
      throw new Error('Expected a local TCP port')
    }

    await expectConnectionRefused(address.port)

    const { stdout } = await runCommand('pnpm', ['contracts'], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://127.0.0.1:${address.port}/ledger_contracts_offline`,
      },
      timeout: 45_000,
    })

    await expectConnectionRefused(address.port)

    const document = JSON.parse(
      await readFile(new URL('../../../docs/openapi.json', import.meta.url), 'utf8'),
    )
    const apiTypes = await readFile(
      new URL('../../web/src/generated/api-types.ts', import.meta.url),
      'utf8',
    )

    expect(stdout).toContain('src/generated/api-types.ts')
    expect(document.openapi).toBe('3.0.0')
    expect(document.info).toMatchObject({ title: 'Ledger API', version: '1.0' })
    expect(document.paths['/api/v1/health'].get.operationId).toBe('HealthController_check')
    expect(document.paths['/internal/ready'].get.responses).toHaveProperty('503')
    expect(apiTypes).toContain('"/api/v1/health"')
    expect(apiTypes).toContain('"/internal/ready"')
    expect(apiTypes).toContain('HealthController_check')
    expect(apiTypes).toContain('InternalController_ready')
    // M1-S24：登录接口进入契约和 Web 类型。
    expect(document.paths['/api/v1/auth/login'].post.operationId).toBe('AuthController_login')
    expect(apiTypes).toContain('"/api/v1/auth/login"')
    expect(apiTypes).toContain('AuthController_login')
  }, 60_000)
})
