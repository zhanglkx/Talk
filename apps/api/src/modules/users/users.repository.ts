import { ConnectionLifecycleService } from '@/database/connection-lifecycle.service.js'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { User } from '@/modules/users/user.entity.js'

export type PublicUser = { id: string; username: string }
export type UserCredentials = PublicUser & { passwordHash: string }

@Injectable()
export class UsersRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connectionLifecycle: ConnectionLifecycleService,
  ) {}

  async findPublicById(id: string): Promise<PublicUser | null> {
    await this.connectionLifecycle.ensureConnected()

    const user = await this.dataSource.getRepository(User).findOne({
      select: { id: true, username: true },
      where: { id },
    })
    return user ? { id: user.id, username: user.username } : null
  }

  async findCredentialsByUsername(username: string): Promise<UserCredentials | null> {
    await this.connectionLifecycle.ensureConnected()

    const user = await this.dataSource.getRepository(User).findOne({
      select: { id: true, username: true, passwordHash: true },
      where: { username },
    })
    return user ? { id: user.id, username: user.username, passwordHash: user.passwordHash } : null
  }
}
