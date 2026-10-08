import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger'
import { DatabaseReadinessService } from '../database/database-readiness.service.js'

class ReadyResponse {
  @ApiProperty({ enum: ['ready'], example: 'ready' })
  status!: 'ready'
}

class NotReadyResponse {
  @ApiProperty({ enum: ['not_ready'], example: 'not_ready' })
  status!: 'not_ready'
}

@Controller('internal')
export class InternalController {
  constructor(private readonly databaseReadinessService: DatabaseReadinessService) {}

  @Get('ready')
  @ApiOkResponse({ type: ReadyResponse, example: { status: 'ready' } })
  @ApiServiceUnavailableResponse({
    type: NotReadyResponse,
    example: { status: 'not_ready' },
  })
  async ready(): Promise<ReadyResponse> {
    if (await this.databaseReadinessService.isReady()) {
      return { status: 'ready' }
    }

    throw new HttpException({ status: 'not_ready' }, HttpStatus.SERVICE_UNAVAILABLE)
  }
}
