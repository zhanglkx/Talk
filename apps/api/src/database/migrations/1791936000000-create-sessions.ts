// users 表的首个版本化迁移：Entity 描述属性映射，本文件负责实际建表和回滚。
// 导入或注册此类不会执行迁移；只能由显式迁移操作调用，应用启动不自动改表。
import { Table } from 'typeorm'
// 接口只用于类型检查，编译后不会作为运行时代码保留。
import type { MigrationInterface, QueryRunner } from 'typeorm'

// 类名末尾的时间戳供 TypeORM 判断迁移顺序；已执行的迁移应保留，后续改表另建迁移。
export class CreateSessions1791936000000 implements MigrationInterface {
  // 正向迁移：QueryRunner 通过数据库连接执行操作，await 等待建表完成并向上传递错误。
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      // Table 描述表结构，由 TypeORM 转换成当前数据库对应的建表 SQL。
      new Table({
        name: 'sessions',
        columns: [
          // 会话 ID 的 SHA-256 摘要（64 个 16 进制字符），明文会话 ID 只在 Cookie 里。
          // 数据库泄露时，摘要无法反推出会话 ID，拿去也不能冒充登录。
          {
            name: 'session_key_hash',
            type: 'char',
            length: '64',
            isPrimary: true,
            isNullable: false,
          },
          // 会话属于哪个用户。只映射成普通列，不加外键关系，读写会话只需要用户 ID。
          // 外键（用户必须存在、删用户时连带删会话）由 migration 在数据库里建立。
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          // 会话里的其他状态，例如 CSRF token；不存密码、密码哈希或账本数据。
          {
            name: 'data',
            type: 'jsonb',
            isNullable: false,
          },
          // timestamptz 保存时间点；省略此字段时，数据库执行 SQL 表达式 now() 提供默认值。
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'last_seen_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'idle_expires_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'absolute_expires_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    )
  }

  // 撤销本次建表迁移会删除整张 sessions 表及其数据，不是仅撤销最近一次用户写入。
  // 有数据的环境执行回滚前必须确认授权和备份，不能把 down 当作无损恢复。
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions')
  }
}
