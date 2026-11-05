import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '@/api/http/client.ts'
import { ApiError, isRequestCanceled } from '@/api/index.ts'

interface EchoResponse {
  method: string
  path: string
  query: Record<string, string>
  body: unknown
  contentType: string
}

function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(data))
}

describe('公共 HTTP 请求契约', () => {
  let baseURL: string
  let client: ReturnType<typeof createHttpClient>
  let onSlowRequest: (() => void) | undefined
  let writeFailureCount = 0

  // 只启动本机虚构 HTTP 服务，不连接业务 API、数据库或外网。
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname.replace(/^\/api\/v1/, '')

    if (path === '/health') return json(response, 200, { status: 'ok' })
    if (path === '/conflict') {
      return json(response, 409, { message: '名称已存在', error: 'Conflict', statusCode: 409 })
    }
    if (path === '/validation') {
      return json(response, 400, { message: ['名称不能为空', '说明过长'] })
    }
    if (path === '/business-error') {
      response.setHeader('X-Request-Id', 'header-request-id')
      return json(response, 422, {
        code: 'EXPENSE_TYPE_INVALID',
        message: '报销类型无效',
        requestId: 'body-request-id',
      })
    }
    if (path === '/body-request-id') {
      return json(response, 400, { message: '请求无效', requestId: 'body-request-id' })
    }
    if (path === '/unavailable') {
      writeFailureCount += 1
      return json(response, 503, { message: 'fictional internal database detail' })
    }
    if (path === '/bad-gateway') {
      response.writeHead(502, { 'Content-Type': 'text/html', 'X-Request-Id': 'gateway-request-id' })
      return response.end('<html>fictional gateway detail</html>')
    }
    if (path === '/bad-json') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      return response.end('{invalid json')
    }
    if (path === '/empty') {
      response.writeHead(204)
      return response.end()
    }
    if (path === '/disconnect') return request.socket.destroy()
    if (path === '/slow') {
      onSlowRequest?.()
      const timer = setTimeout(() => json(response, 200, { status: 'ok' }), 500)
      response.once('close', () => clearTimeout(timer))
      return
    }

    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('error', () => response.destroy())
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      const contentType = request.headers['content-type'] ?? ''
      json(response, 200, {
        method: request.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: text && contentType.includes('application/json') ? JSON.parse(text) : text,
        contentType,
        testHeader: request.headers['x-test-request'],
      })
    })
  })

  beforeAll(async () => {
    vi.stubEnv('NO_PROXY', '127.0.0.1')
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject)
        resolve()
      })
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('测试 HTTP 服务未启动')
    baseURL = `http://127.0.0.1:${address.port}/api/v1`
  })

  beforeEach(() => {
    client = createHttpClient({ baseURL, timeout: 2000 })
    writeFailureCount = 0
  })

  afterEach(() => {
    onSlowRequest = undefined
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    server.closeAllConnections()
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  it('拼接统一前缀并直接返回响应数据', async () => {
    await expect(client.get('/health')).resolves.toEqual({ status: 'ok' })
  })

  it('正确编码查询参数，保留服务端响应结构', async () => {
    const result = await client.get<EchoResponse>('/echo', {
      params: { name: '研发&财务', enabled: false, page: 2 },
    })
    expect(result).toMatchObject({
      method: 'GET',
      path: '/api/v1/echo',
      query: { name: '研发&财务', enabled: 'false', page: '2' },
    })
  })

  it.each(['post', 'put', 'patch'] as const)('%s 自动发送 JSON 请求体', async (method) => {
    const result = await client[method]<EchoResponse>('/echo', { name: '差旅', enabled: false })
    expect(result.contentType).toContain('application/json')
    expect(result).toMatchObject({
      method: method.toUpperCase(),
      body: { name: '差旅', enabled: false },
    })
  })

  it('DELETE 使用正确的方法并传递调用方请求头', async () => {
    await expect(
      client.delete('/echo', { headers: { 'X-Test-Request': 'fictional' } }),
    ).resolves.toMatchObject({ method: 'DELETE', testHeader: 'fictional' })
  })

  it('FormData 自动生成 multipart boundary', async () => {
    const form = new FormData()
    form.append('description', '虚构发票')
    const result = await client.post<EchoResponse>('/echo', form)
    expect(result.contentType).toMatch(/^multipart\/form-data; boundary=/)
    expect(result.body).toContain('name="description"')
    expect(result.body).toContain('虚构发票')
  })

  it('204 无响应体时返回 undefined', async () => {
    await expect(client.delete<void>('/empty')).resolves.toBeUndefined()
  })

  it('保留 Nest 默认错误中的 HTTP 状态码和业务提示', async () => {
    await expect(client.post('/conflict', { name: '差旅' })).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'http',
      status: 409,
      message: '名称已存在',
    })
  })

  it('兼容字段校验提示数组', async () => {
    await expect(client.post('/validation', {})).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message: '名称不能为空；说明过长',
    })
  })

  it('保留业务错误码，优先使用响应头里的请求编号', async () => {
    await expect(client.get('/business-error')).rejects.toMatchObject({
      kind: 'http',
      status: 422,
      code: 'EXPENSE_TYPE_INVALID',
      message: '报销类型无效',
      requestId: 'header-request-id',
    })
  })

  it('响应头没有请求编号时使用响应体中的编号', async () => {
    await expect(client.get('/body-request-id')).rejects.toMatchObject({
      requestId: 'body-request-id',
    })
  })

  it('5xx 返回统一提示，一次写请求只发送一次', async () => {
    await expect(client.post('/unavailable', { name: '差旅' })).rejects.toMatchObject({
      kind: 'http',
      status: 503,
      message: '服务暂时不可用，请稍后重试',
    })
    expect(writeFailureCount).toBe(1)
  })

  it('网关返回 HTML 时仍保留 502 和请求编号', async () => {
    await expect(client.get('/bad-gateway')).rejects.toMatchObject({
      kind: 'http',
      status: 502,
      requestId: 'gateway-request-id',
      message: '服务暂时不可用，请稍后重试',
    })
  })

  it('成功响应不是合法 JSON 时报告响应格式错误', async () => {
    await expect(client.get('/bad-json')).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('连接中断时报告网络错误', async () => {
    await expect(client.get('/disconnect')).rejects.toMatchObject({ kind: 'network' })
  })

  it('超时错误和网络错误可以区分', async () => {
    await expect(client.get('/slow', { timeout: 25 })).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('已经取消的 signal 会报告取消错误', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = await client
      .get('/health', { signal: controller.signal })
      .catch((error: unknown) => error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'canceled' })
    expect(isRequestCanceled(error)).toBe(true)
  })

  it('请求发出后可以通过 AbortSignal 取消', async () => {
    const controller = new AbortController()
    const received = new Promise<void>((resolve) => {
      onSlowRequest = resolve
    })
    const pending = client.get('/slow', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'canceled' })
    await received
    controller.abort()
    await assertion
  })
})
