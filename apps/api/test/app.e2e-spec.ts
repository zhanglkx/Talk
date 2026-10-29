import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types.js'
import { AppModule } from '@/app.module.js'
import { configureApp } from '@/configure-app.js'

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    // 和 main.ts 用同一份配置，否则测试里的应用没有 /api/v1 前缀
    configureApp(app)
    await app.init()
  })

  it('GET /api/v1/health returns status ok', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' })
  })

  afterEach(async () => {
    await app.close()
  })
})
