import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import request from 'supertest'
import type { App } from 'supertest/types.js'
import { configureApp } from '@/configure-app.js'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'
import { ExpenseTypesModule } from '@/modules/expense-types/expense-types.module.js'

describe('ExpenseTypesController (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [ExpenseTypesModule] })
      .overrideProvider(getRepositoryToken(ExpenseTypeEntity))
      .useValue({ findOneBy: vi.fn().mockResolvedValue(null) })
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('停用不存在的报销类型时返回 404、业务错误码和同一个请求 ID', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/expense-types/${randomUUID()}/disable`)
      .expect(404)
    const requestId = response.get('X-Request-Id')

    expect(requestId).toEqual(expect.stringMatching(/\S/))
    expect(response.body).toStrictEqual({
      code: 'EXPENSE_TYPE_NOT_FOUND',
      message: '报销类型不存在',
      requestId,
    })
  })
})
