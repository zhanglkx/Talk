import { randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { hashPassword, verifyPassword } from '@/modules/auth/password-hasher.js'
import { normalizeUsername } from '@/modules/users/username.js'
import { UsersRepository, type PublicUser } from '@/modules/users/users.repository.js'

// 登录凭证校验 只回答【这组账密对不对】，不碰 HTTP、Cookie 和会话
@Injectable()
export class AuthService {
  // 用户不存在时拿来校验的假哈希。存的是「生成中的 Promise」：并发的首次调用共用同一次计算。
  private dummyHash: Promise<string> | undefined

  // UsersRepository 必须是值导入（不能写 import type）：Nest 靠编译时记下的参数类型决定注入什么。
  constructor(private readonly users: UsersRepository) {}

  // 用户名不合法、用户不存在、密码错误都返回 null，调用方无从区分。
  // 不写 try/catch：数据库错误原样抛出，不能当成「用户名或密码错误」。
  async verifyCredentials(username: string, password: string): Promise<PublicUser | null> {
    const normalized = normalizeUsername(username)
    // 不合法的用户名查不到任何人，不必为它连库。
    const credentials =
      normalized === null ? null : await this.users.findCredentialsByUsername(normalized)

    if (credentials === null) {
      // 照样完整校验一次再丢掉结果：「用户不存在」和「密码错误」花的时间差不多，别人没法凭快慢猜账号。
      await verifyPassword(await this.getDummyHash(), password)
      return null
    }

    // 密码原样传入，不 trim、不改大小写。
    if (!(await verifyPassword(credentials.passwordHash, password))) {
      return null
    }
    // 只挑公开字段返回，passwordHash 不离开这个方法。
    return { id: credentials.id, username: credentials.username }
  }

  // 第一次需要时才生成，启动时不为登录多花时间。原文是谁也不知道的随机值，所以假哈希永远校验不通过。
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword(randomBytes(32).toString('base64'))
    return this.dummyHash
  }

  async findSessionUser(userId: string): Promise<PublicUser | null> {
    return this.users.findPublicById(userId)
  }
}
