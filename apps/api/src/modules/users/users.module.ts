import { Module } from '@nestjs/common'
import { DatabaseModule } from '@/database/database.module.js'
import { UsersRepository } from '@/modules/users/users.repository.js'

// 用户数据访问模块；导出 UsersRepository，供以后的登录模块注入。
@Module({
  // UsersRepository 要注入的 ConnectionLifecycleService 由 DatabaseModule 导出。
  imports: [DatabaseModule],
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
