// users 表的首个版本化迁移：Entity 描述属性映射，本文件负责实际建表和回滚。
// 导入或注册此类不会执行迁移；只能由显式迁移操作调用，应用启动不自动改表。
import { Table } from 'typeorm'
// 接口只用于类型检查，编译后不会作为运行时代码保留。
import type { MigrationInterface, QueryRunner } from 'typeorm'

// 类名末尾的时间戳供 TypeORM 判断迁移顺序；已执行的迁移应保留，后续改表另建迁移。
export class CreateUsers1791849600000 implements MigrationInterface {
  // 正向迁移：QueryRunner 通过数据库连接执行操作，await 等待建表完成并向上传递错误。
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      // Table 描述表结构，由 TypeORM 转换成当前数据库对应的建表 SQL。
      new Table({
        name: 'users',
        columns: [
          // UUID 主键不自动生成值；写入方需要提供 UUID。所有列都明确禁止 NULL。
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          // 数据库限制用户名长度并保证唯一；大小写等规范化规则仍由业务代码处理。
          {
            name: 'username',
            type: 'varchar',
            length: '32',
            isUnique: true,
            isNullable: false,
          },
          // 只存密码哈希；TEXT 类型不会自动加密或哈希，写入前必须完成哈希计算。
          {
            name: 'password_hash',
            type: 'text',
            isNullable: false,
          },
          // timestamptz 保存时间点；省略此字段时，数据库执行 SQL 表达式 now() 提供默认值。
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    )
  }

  // 撤销本次建表迁移会删除整张 users 表及其数据，不是仅撤销最近一次用户写入。
  // 有数据的环境执行回滚前必须确认授权和备份，不能把 down 当作无损恢复。
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users')
  }
}
