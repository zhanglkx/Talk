import { randomUUID } from 'node:crypto'
import {
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import request from 'supertest'
import type { App } from 'supertest/types.js'
import { configureApp } from '@/configure-app.js'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'
import { ExpenseTypesModule } from '@/modules/expense-types/expense-types.module.js'
import { ExpenseTypesService } from '@/modules/expense-types/expense-types.service.js'

describe('ExpenseTypesController (e2e)', () => {
  let app: INestApplication<App>
  const existsBy = vi.fn()

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [ExpenseTypesModule] })
      .overrideProvider(getRepositoryToken(ExpenseTypeEntity))
      .useValue({ findOneBy: vi.fn().mockResolvedValue(null), existsBy })
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('停用报销类型时 ID 格式错误应返回 400、校验错误码和同一个请求 ID', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/expense-types/abc/disable')
      .expect(400)
    const requestId = response.get('X-Request-Id')

    expect(requestId).toEqual(expect.stringMatching(/\S/))
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringMatching(/\S/),
      requestId,
    })
  })

  it('新增同名报销类型时返回 409、重名错误码和同一个请求 ID', async () => {
    existsBy.mockResolvedValueOnce(true)
    const response = await request(app.getHttpServer())
      .post('/api/v1/expense-types')
      .send({ name: '交通' })
      .expect(409)
    const requestId = response.get('X-Request-Id')

    expect(requestId).toEqual(expect.stringMatching(/\S/))
    expect(response.body).toMatchObject({
      code: 'EXPENSE_TYPE_NAME_TAKEN',
      message: '名称已存在',
      requestId,
    })
  })

  it('服务抛出未指定业务码的 409 时返回通用冲突码', async () => {
    vi.spyOn(app.get(ExpenseTypesService), 'create').mockRejectedValueOnce(
      new ConflictException('操作冲突'),
    )

    const response = await request(app.getHttpServer())
      .post('/api/v1/expense-types')
      .send({ name: '交通' })
      .expect(409)
    const requestId = response.get('X-Request-Id')

    expect(requestId).toEqual(expect.stringMatching(/\S/))
    expect(response.body).toMatchObject({ code: 'CONFLICT', message: '操作冲突', requestId })
  })

  it.each([
    new Error('test-only-internal-detail'),
    new InternalServerErrorException('test-only-internal-detail'),
  ])('查询报销类型遇到 $name 时返回统一 500，并隐藏内部错误详情', async (error) => {
    vi.spyOn(app.get(ExpenseTypesService), 'findAll').mockRejectedValueOnce(error)

    const response = await request(app.getHttpServer()).get('/api/v1/expense-types').expect(500)
    const requestId = response.get('X-Request-Id')

    expect(requestId).toEqual(expect.stringMatching(/\S/))
    expect(response.text).not.toContain(error.message)
    expect(response.body).toStrictEqual({
      code: 'INTERNAL_ERROR',
      message: expect.stringMatching(/\S/),
      requestId,
    })
  })

  it('服务暂时不可用时保留原来的 503 状态和提示', async () => {
    vi.spyOn(app.get(ExpenseTypesService), 'findAll').mockRejectedValueOnce(
      new ServiceUnavailableException('服务暂时不可用'),
    )

    const response = await request(app.getHttpServer()).get('/api/v1/expense-types').expect(503)
    expect(response.body).toMatchObject({ message: '服务暂时不可用' })
  })
})
