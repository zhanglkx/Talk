import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ConnectionLifecycleService } from '@/database/connection-lifecycle.service.js'
import { Session } from '@/modules/auth/session.entity.js'
import type { SessionData } from '@/modules/auth/session.entity.js'
import { hashSessionId, isSessionActive } from '@/modules/auth/session-lifecycle.js'
import type { SessionWindow } from '@/modules/auth/session-lifecycle.js'

export type SessionRecord = { userId: string; data: SessionData; window: SessionWindow }
// 更新时只能改内容和时间，类型里没有 userId：会话一旦创建，归属不再改变。
export type SessionChanges = { data: SessionData; window: SessionWindow }

// sessions 表的读写入口。各方法接收明文会话 ID，进来先转成摘要；明文不写库、不发给数据库。
@Injectable()
export class SessionsRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connectionLifecycle: ConnectionLifecycleService,
  ) {}

  // 登录成功后创建。用户不存在（外键）或 ID 重复（主键）时直接抛出数据库错误：正常流程不会出现，出现就是 bug。
  async create(sessionId: string, { userId, data, window }: SessionRecord): Promise<void> {
    // 启动时不连库，第一次使用时在这里建立连接。
    await this.connectionLifecycle.ensureConnected()
    await this.dataSource.getRepository(Session).insert({
      sessionKeyHash: hashSessionId(sessionId),
      userId,
      data,
      lastSeenAt: window.lastSeenAt,
      idleExpiresAt: window.idleExpiresAt,
      absoluteExpiresAt: window.absoluteExpiresAt,
    })
  }

  // 只返回仍然有效的会话；不存在或已过期都返回 null。
  async findActive(sessionId: string, now: Date): Promise<SessionRecord | null> {
    await this.connectionLifecycle.ensureConnected()
    const session = await this.dataSource.getRepository(Session).findOne({
      where: { sessionKeyHash: hashSessionId(sessionId) },
    })
    if (!session) return null
    const window = {
      lastSeenAt: session.lastSeenAt,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    }
    // 期限判断复用 session-lifecycle.ts，SQL 里不再写一遍，规则只有一份。
    if (!isSessionActive(window, now)) return null
    // 返回普通对象，不把实体整个传出去。
    return { userId: session.userId, data: session.data, window }
  }

  // 续期或保存会话内容；返回是否命中。会话已被删除（例如已退出）时返回 false，不会重新建出来。
  async update(sessionId: string, { data, window }: SessionChanges): Promise<boolean> {
    await this.connectionLifecycle.ensureConnected()
    // 逐个字段写入，不把传入对象整个交给 TypeORM，混进来的其他字段（如 userId）写不进去。
    const result = await this.dataSource.getRepository(Session).update(
      { sessionKeyHash: hashSessionId(sessionId) },
      {
        data,
        lastSeenAt: window.lastSeenAt,
        idleExpiresAt: window.idleExpiresAt,
        absoluteExpiresAt: window.absoluteExpiresAt,
      },
    )
    return result.affected === 1
  }

  // 退出时删除。删不到也不报错：重复退出或会话已过期都属于正常情况。
  async delete(sessionId: string): Promise<void> {
    await this.connectionLifecycle.ensureConnected()
    await this.dataSource
      .getRepository(Session)
      .delete({ sessionKeyHash: hashSessionId(sessionId) })
  }
}
