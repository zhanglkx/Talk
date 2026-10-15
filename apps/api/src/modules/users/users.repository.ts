import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ConnectionLifecycleService } from '@/database/connection-lifecycle.service.js'
import { User } from '@/modules/users/user.entity.js'
import { normalizeUsername } from '@/modules/users/username.js'

export type PublicUser = { id: string; username: string }
export type UserCredentials = PublicUser & { passwordHash: string }
export type CreateUserInput = { username: string; passwordHash: string }
export type CreateUserResult = 'created' | 'exists'

// users 表的读写入口；其他代码不直接写 SQL。
@Injectable()
export class UsersRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connectionLifecycle: ConnectionLifecycleService,
  ) {}

  async findPublicById(id: string): Promise<PublicUser | null> {
    // 启动时不连库，第一次查询在这里建立连接。
    await this.connectionLifecycle.ensureConnected()

    const user = await this.dataSource.getRepository(User).findOne({
      select: { id: true, username: true },
      where: { id },
    })
    // 返回普通对象，只带选中的字段。
    return user ? { id: user.id, username: user.username } : null
  }

  // 用户名需已规范化（normalizeUsername），这里只做精确匹配。
  async findCredentialsByUsername(username: string): Promise<UserCredentials | null> {
    await this.connectionLifecycle.ensureConnected()

    const user = await this.dataSource.getRepository(User).findOne({
      select: { id: true, username: true, passwordHash: true },
      where: { username },
    })
    return user ? { id: user.id, username: user.username, passwordHash: user.passwordHash } : null
  }

  async createIfAbsent({ username, passwordHash }: CreateUserInput): Promise<CreateUserResult> {
    // 写入前把关：用户名已规范化、只存 Argon2id 哈希。报错不带传入值，免得明文进日志。
    if (normalizeUsername(username) !== username) {
      throw new Error('Username must be normalized')
    }
    if (!passwordHash.startsWith('$argon2id$')) {
      throw new Error('Password hash must be an Argon2id hash')
    }

    await this.connectionLifecycle.ensureConnected()

    // 用户名已存在时什么都不改；判断和写入在同一条语句里，并发调用也只会插入一行。
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO users (id, username, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [randomUUID(), username, passwordHash],
    )
    return rows.length > 0 ? 'created' : 'exists'
  }
}
