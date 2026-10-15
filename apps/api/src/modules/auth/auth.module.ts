import { Module } from '@nestjs/common'
import { DatabaseModule } from '@/database/database.module.js'
import { SessionsRepository } from '@/modules/auth/sessions.repository.js'

// 认证模块：目前只提供 SessionsRepository，登录、退出等接口以后加在这里。
@Module({
  // SessionsRepository 要注入的 ConnectionLifecycleService 由 DatabaseModule 导出。
  imports: [DatabaseModule],
  providers: [SessionsRepository],
  exports: [SessionsRepository],
})
export class AuthModule {}
