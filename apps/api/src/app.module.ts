import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnvironment } from '@/config/validate-environment.js'
import { DatabaseModule } from '@/database/database.module.js'
import { HealthModule } from '@/health/health.module.js'
import { InternalModule } from '@/internal/internal.module.js'
import { AuthModule } from '@/modules/auth/auth.module.js'
import { APP_GUARD } from '@nestjs/core'
import { AuthGuard } from '@/common/guards/auth.guard.js'

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    InternalModule,
    AuthModule,
  ],
})
export class AppModule {}
