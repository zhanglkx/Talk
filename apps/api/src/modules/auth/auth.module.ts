import { Module } from '@nestjs/common'
import { DatabaseModule } from '@/database/database.module.js'
import { AuthController } from '@/modules/auth/auth.controller.js'
import { SessionsRepository } from '@/modules/auth/sessions.repository.js'
import { AuthService } from '@/modules/auth/auth.service.js'
import { UsersModule } from '@/modules/users/users.module.js'

// 认证模块：登录接口，以及它用到的 SessionsRepository 和 AuthService；退出、me 以后也加在这里。
@Module({
  // SessionsRepository 要的 ConnectionLifecycleService 来自 DatabaseModule，
  // AuthService 要的 UsersRepository 来自 UsersModule。
  imports: [DatabaseModule, UsersModule],
  controllers: [AuthController],
  providers: [SessionsRepository, AuthService],
  exports: [SessionsRepository],
})
export class AuthModule {}
