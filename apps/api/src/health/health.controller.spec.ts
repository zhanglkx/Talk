import { Test, TestingModule } from '@nestjs/testing'
import { HealthController } from '@/health/health.controller.js'

describe('HealthController', () => {
  let healthController: HealthController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile()

    healthController = app.get<HealthController>(HealthController)
  })

  it('returns status ok', () => {
    expect(healthController.getHealth()).toEqual({ status: 'ok' })
  })
})
