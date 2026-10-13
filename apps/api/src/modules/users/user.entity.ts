// 用户实体：描述 TypeScript 属性与 users 表的映射，供应用和 CLI 共用。
// 本文件不执行建表或迁移，也不包含登录、密码哈希等业务逻辑。
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

// 明确映射到 users 表，不依赖 TypeORM 根据类名推断表名。
@Entity('users')
export class User {
  // UUID 主键；PrimaryColumn 不生成值，创建用户时由业务代码提供 UUID。
  // 属性后的 ! 只用于 TypeScript 确定赋值检查，不会设置运行时默认值。
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  // 用户名最长 32 个字符，声明唯一约束；规范化由业务代码负责。
  // Column 默认非空，真实数据库约束仍需由 migration 创建。
  @Column({ type: 'varchar', length: 32, unique: true })
  username!: string

  // 属性使用 camelCase，数据库列使用 snake_case；这里只保存密码哈希，不存明文。
  // 实体本身不会执行哈希，写入前必须由业务代码完成。
  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string

  // 创建时间由 TypeORM 在插入时自动处理，数据库映射为 timestamptz，代码中使用 Date。
  // 后续 migration 需要与此列及其默认时间配置保持一致。
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
