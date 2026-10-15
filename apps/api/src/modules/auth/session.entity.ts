// 会话实体：描述 TypeScript 属性与 sessions 表的映射，供应用和 CLI 共用。
// 本文件不建表、不读写会话，也不生成会话 ID；建表由 migration 负责，读写由 SessionsRepository 负责。
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm'

// 会话里保存的状态，只有 CSRF token；写成具体类型，密码、账本等数据就放不进来。
export type SessionData = { csrfToken: string }

// 闲置期限不能晚于绝对期限：续期只能把闲置期限往后推，推到绝对期限为止。
// 名称和表达式与 migration 保持一致；真正拦截错误数据的是 migration 在数据库里建的约束。
@Check('chk_sessions_idle_within_absolute', '"idle_expires_at" <= "absolute_expires_at"')
@Entity('sessions')
export class Session {
  // 主键存会话 ID 的 SHA-256 摘要（64 个 16 进制字符），明文会话 ID 只在 Cookie 里。
  // 数据库泄露时，摘要无法反推出会话 ID，拿去也不能冒充登录。
  @PrimaryColumn({ name: 'session_key_hash', type: 'char', length: 64 })
  sessionKeyHash!: string

  // 会话属于哪个用户。只映射成普通列，不加 @ManyToOne 关系：读写会话只需要用户 ID。
  // 外键（用户必须存在、删用户时连带删会话）由 migration 在数据库里建立。
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  // 会话状态，类型见 SessionData。
  @Column({ type: 'jsonb' })
  data!: SessionData

  // 会话创建时间，插入时由数据库默认值 now() 填写。
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  // 下面三个时间按 session-lifecycle.ts 的规则算好后显式写入，所以用普通 @Column，
  // 不用 @CreateDateColumn/@UpdateDateColumn，避免 TypeORM 自动改写它们。

  // 最近一次使用会话的时间。
  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date

  // 闲置期限：一段时间不操作就失效，每次使用会往后延。
  // 它总是最早的截止时间，清理过期会话时按这一列查找，所以建索引。
  @Index('idx_sessions_idle_expires_at')
  @Column({ name: 'idle_expires_at', type: 'timestamptz' })
  idleExpiresAt!: Date

  // 绝对期限：从登录起最长有效到这个时间，不会因为使用而延长。
  @Column({ name: 'absolute_expires_at', type: 'timestamptz' })
  absoluteExpiresAt!: Date
}
