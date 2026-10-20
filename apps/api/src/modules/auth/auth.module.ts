import { Module } from '@nestjs/common'
import { DatabaseModule } from '@/database/database.module.js'
import { SessionsRepository } from '@/modules/auth/sessions.repository.js'
import { AuthService } from '@/modules/auth/auth.service.js'

// 认证模块：目前只提供 SessionsRepository 和 AuthService，登录、退出等接口以后加在这里。
@Module({
  // SessionsRepository 要的 ConnectionLifecycleService 来自 DatabaseModule，
  // AuthService 要的 UsersRepository 来自 UsersModule。
  imports: [DatabaseModule],
  providers: [SessionsRepository, AuthService],
  exports: [SessionsRepository, AuthService],
})
export class AuthModule {}
