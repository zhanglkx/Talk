import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types.js'
import { configureApp } from '@/configure-app.js'
import { HealthModule } from '@/health/health.module.js'

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    // 只导入要测的 HealthModule：健康检查用不到数据库，测试也就不依赖数据库和本机的 .env。
    // 导入整个 AppModule 的话，TypeORM 会先去连库，数据库连不上时这个测试会超时失败
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    // 和 main.ts 用同一份配置，否则测试里的应用没有 /api/v1 前缀
    configureApp(app)
    await app.init()
  })

  it('GET /api/v1/health 返回健康状态，响应体与响应头的请求 ID 一致', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200)
    const requestId = response.get('X-Request-Id')

    expect.soft(requestId).toEqual(expect.stringMatching(/\S/))
    expect(response.body).toStrictEqual({ data: { status: 'ok' }, requestId })
  })

  afterEach(async () => {
    await app.close()
  })
})
