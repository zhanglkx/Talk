import { Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseReadinessService } from './database-readiness.service.js'

const logger = new Logger('DatabaseModule')

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        manualInitialization: true,
        synchronize: false,
        migrationsRun: false,
        entities: [],
        connectTimeoutMS: 3_000,
        poolErrorHandler: () => {
          logger.error('Database pool error')
        },
        extra: {
          query_timeout: 3_000,
        },
      }),
    }),
  ],
  providers: [DatabaseReadinessService],
  exports: [DatabaseReadinessService],
})
export class DatabaseModule {}
