import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger'

class HealthResponse {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok'
}

@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok' }
  }
}
