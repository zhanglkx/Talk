import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger'
import { Public } from '@/common/guards/auth.guard.js'

class HealthResponse {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok'
}
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok' }
  }
}
