import { ConnectionLifecycleService } from '@/database/connection-lifecycle.service.js'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { User } from '@/modules/users/user.entity.js'
import { normalizeUsername } from '@/modules/users/username.js'
import { randomUUID } from 'node:crypto'

export type PublicUser = { id: string; username: string }
export type UserCredentials = PublicUser & { passwordHash: string }
export type CreateUserInput = { username: string; passwordHash: string }
export type CreateUserResult = 'created' | 'exists'

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

  async createIfAbsent({ username, passwordHash }: CreateUserInput): Promise<CreateUserResult> {
    if (normalizeUsername(username) !== username) {
      throw new Error('Username must be normalized')
    }

    if (!passwordHash.startsWith('$argon2id$')) {
      throw new Error('Password hash must be an Argon2id hash')
    }

    await this.connectionLifecycle.ensureConnected()

    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO users (id, username ,password_hash)
        VALUES($1,$2,$3)
ON CONFLICT (username) DO NOTHING
RETURNING ID
        
        `,
      [randomUUID(), username, passwordHash],
    )

    return rows.length > 0 ? 'created' : 'exists'
  }
}
