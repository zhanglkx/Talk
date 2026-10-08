import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { InternalController } from './internal.controller.js'

@Module({ imports: [DatabaseModule], controllers: [InternalController] })
export class InternalModule {}
