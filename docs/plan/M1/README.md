# M1｜业务数据库与认证最小闭环

- 目标窗口：2026-10-12 ～ 2026-11-08。
- 状态：**进行中**（M1-S11 已验收，M1-R01 通过；当前步骤 M1-S12，把 API 测试纳入 `pnpm check`）。
- 基线：`4a3f08b`；文档制定日期：2026-10-09。
- 核心任务：10 张卡，建议工时合计 15 小时；不含所有环境阻塞。

## 前置门与产出

已有 NestJS/React、TypeORM/PostgreSQL、环境校验、health/ready 和 OpenAPI 类型生成；业务 migration、Entity、账号与认证尚未实现。基线为 4a3f08b，历史测试记录不代表本阶段通过。

可复现 migration、两个虚构账号、会话登录/退出/me、受保护请求、最小登录页面与可核对的测试证据。分类写入为可选项，完整流水留给 M2/M3。

## 阅读顺序

| 顺序 | 文件 | 用途 |
|---|---|---|
| 1 | [PRD](01-PRD.md) | 定义用户、范围、接口行为、错误反馈与产品验收。 |
| 2 | [技术方案](02-%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88.md) | 定义模块、数据库、事务/信任边界、前端契约与测试方法。 |
| 3 | [学习与执行计划](03-%E5%AD%A6%E4%B9%A0%E4%B8%8E%E6%89%A7%E8%A1%8C%E8%AE%A1%E5%88%92.md) | 按四周目标窗口拆解任务、学习重点、建议工时、证据与顺延规则。 |

先读 PRD 锁定范围，再按技术方案设计与补失败测试，最后执行任务卡。当前这些文件是计划，不是已完成证据。

## 容量与顺延

每周4小时模式：3小时深度任务＋0.5小时阅读＋0.5小时算法/复盘；5小时模式：4小时深度任务＋1小时轻量学习。任务卡约15～16小时属于核心工作估算，另保留四周共4小时轻量学习后，总量约19～20小时。四周5小时模式才基本容纳全部内容且缓冲很少；4小时模式通常需至少5～6周。环境阻塞/缺陷超过余量即顺延，不增加通勤硬编码或熬夜补课。

前置质量门未过就延续当前阶段；不并行开始依赖它的后续主题。忙周先减美化/扩展，不减权限、事务、金额边界和真实数据库测试。

## 阶段验收追踪

实施时将每个编号关联实际测试文件/测试名、命令及结果。以下状态均为未验证，只有获得证据后才改为通过。

| 编号 | 验收条件 | 当前状态 |
|---|---|---|
| M1-R01 | 空库显式执行 migration 后具备 users/sessions；再次执行不重复建表；应用启动不自动建表或迁移。 | 通过（2026-10-15，M1-S11）：`apps/api/test/integration/migrations-run.db.spec.ts`、`users-migration.db.spec.ts`、`sessions-migration.db.spec.ts`；启动不连库、不迁移见 `apps/api/test/database-startup.spec.ts`（M1-S05）。down 未在真实库演练。 |
| M1-R02 | seed 建立两个虚构账号；只保存密码哈希，不把密码写入代码、文档或日志；再次执行不悄悄重置已有密码。 | 未验证 |
| M1-R03 | 正确凭据登录成功并轮换 Session ID；错误用户名和错误密码均返回相同 401 文案，不泄露账号存在性。 | 未验证 |
| M1-R04 | me 从会话取得身份；未登录、已退出、闲置/绝对过期均 401；客户端 userId 不改变返回用户。 | 未验证 |
| M1-R05 | 退出销毁服务端会话并清同名/同路径 Cookie；重放旧 Cookie 不恢复登录。 | 未验证 |
| M1-R06 | 登录检查可信 Origin；已登录写请求检查 Origin 和 X-CSRF-Token。缺失或错误返回 403。 | 未验证 |
| M1-R07 | Web 显示加载、账号、登录失败、网络失败和退出状态；密码及会话不得存入 localStorage。 | 未验证 |
| M1-R08 | 数据库离线时 health 仍为 200、ready 为 503、依赖数据库业务安全返回 503；恢复后业务能重试。 | 未验证 |

## 当前步骤

一次只展开这一步。验收通过后直接把状态改为 done 并记下验收证据，再写出下一步的计划、动作、注意事项和验收；未通过就停在本步。

执行分工：业务代码由用户手写；助手生成测试、执行验证并维护证据。助手不修改业务代码，也不为回归验证临时改动业务实现。

| 编号 | 内容 | 状态 |
|---|---|---|
| M1-S01 | 共享连接生命周期 `ensureConnected`：并发只连接一次，失败后可重试，成功后不重复初始化，不执行 migration。 | done |
| M1-S02 | 应用关闭时销毁这一份 `DataSource`，只销毁一次；关闭过程不再连接。 | done |
| M1-S03 | 抽出无副作用的数据库配置，供 Nest 和以后的 CLI 共用。本步不创建 CLI 进程。 | done |
| M1-S04 | CLI 用的 `DataSource` 复用这份配置：创建时不连接，未连接时关闭不调用 `destroy`。 | done |
| M1-S05 | 应用启动不连接数据库：`initialize` 和 `ensureConnected` 都不被调用。 | done |
| M1-S06 | 用不可达的本机数据库地址运行实际 contracts 命令，验证离线契约生成。 | done |
| M1-S07 | 为 TypeORM CLI 提供可加载的 DataSource 入口，加载时不连接数据库。 | done |
| M1-S08 | 定义 users Entity，并让应用与 CLI 的共享配置注册同一实体；不自动建表。 | done |
| M1-S09 | 编写首个 users migration，并在应用与 CLI 的共享配置注册；本步不连接或修改真实数据库。 | done |
| M1-S10 | 在经确认的专用空测试库显式执行 users migration，验证重复执行和真实数据库约束。 | done |
| M1-S11 | 编写 sessions 的 Entity 与 migration，并在 `ledger_it` 上验证建表、外键、到期约束和重复执行。 | done |
| M1-S12 | 把 API 测试纳入根目录 `pnpm test`，从而纳入 `pnpm check`；`test:db` 仍单独运行。 | 待确认分工 |

M1-S01 验收证据（2026-10-13）：`pnpm --filter @ledger/api test` 为 3 个文件、6 个测试通过；`pnpm typecheck` 通过。测试在 `apps/api/test/connection-lifecycle.service.spec.ts`、`health.spec.ts`、`readiness.spec.ts`。临时拿掉「进行中的连接只等一次」后，并发测试失败（第二个调用提前返回）；恢复后全套再次通过。仓库根的 `pnpm test` 仍只跑 Web。

M1-S02 验收证据（2026-10-13）：`pnpm --filter @ledger/api test` 为 4 个文件、7 个测试通过；`pnpm typecheck` 通过。关闭测试在 `apps/api/test/database-shutdown.spec.ts`。未改业务代码，未连接真实数据库。

M1-S03 验收证据（2026-10-13）：先用空函数看到两条断言失败（没有返回传入的 URL；连接池错误没有记下固定日志）。实现后 `pnpm --filter @ledger/api test` 为 5 个文件、9 个测试通过；`pnpm typecheck` 通过。测试在 `apps/api/test/database-options.spec.ts`。未连接真实数据库，未创建 CLI 进程。

M1-S04 验收证据（2026-10-13）：`pnpm --filter @ledger/api test` 为 6 个文件、11 个测试通过；`pnpm typecheck` 通过。测试在 `apps/api/test/data-source.spec.ts`。临时拿掉「没连上就返回」后，关闭测试抛出 `CannotExecuteNotConnectedError`；恢复后全套通过。未连接真实数据库，未加 npm 脚本。

M1-S05 验收证据（2026-10-13）：`pnpm --filter @ledger/api test` 为 7 个文件、12 个测试通过；`pnpm typecheck` 通过。测试在 `apps/api/test/database-startup.spec.ts`，使用真实 `AppModule`，不替换 `DatabaseModule` 或 `DataSource`；在模块创建前监听两个连接入口，断言 `app.init()` 和 `close()` 均不调用 `initialize` 或 `ensureConnected`。监听方法一旦被调用立即抛错，避免真实连接。临时将 `manualInitialization` 改为 `false` 并限制重试为一次后，测试按预期失败；恢复配置后单测及全套通过。生产配置和 `generate-openapi.ts` 均未保留修改，未连接真实数据库。此证据不等于实际 contracts 命令已完成离线验收。

M1-S06 验收证据（2026-10-13）：新增 `apps/api/test/contracts.spec.ts`，先分配并关闭临时 loopback 端口，确认连接返回 `ECONNREFUSED`；仅在子进程中注入该端口的 `DATABASE_URL`，执行真实 `pnpm contracts`，退出码为 0；命令结束后再次确认连接被拒绝。测试检查 OpenAPI 版本、health/ready 路径和 503 响应，以及生成 Web 类型中的路径和操作名。首次运行因错误假设标准输出包含脚本名而失败，修正为生成工具实际报告的产物路径后通过；这不是业务回归失败证据。最终 `pnpm --filter @ledger/api test` 为 8 个文件、13 个测试通过，`pnpm typecheck` 通过；两份生成文件均无 Git 差异。未改业务代码或 `.env`，未关闭 PostgreSQL，未使用真实数据库账号。

M1-S07 验收证据（2026-10-13）：用户完成 `apps/api/src/database/cli-data-source.ts`；助手在现有 `apps/api/test/data-source.spec.ts` 中新增 8 条测试，覆盖唯一 DataSource 导出、重复导入复用同一对象、调用共享工厂一次、加载不调用 `initialize`，以及缺失、空白、非法 URL、错误协议、缺少库名和缺少主机的配置拒绝。每条入口测试重置模块缓存并恢复环境变量，连接方法被拦截；针对性测试共 10 条通过。完整 `pnpm --filter @ledger/api test` 为 8 个文件、21 个测试通过，`pnpm typecheck` 通过。使用本次 contracts 构建产物，以锁定 TypeORM 版本的 `CommandUtils.loadDataSource` 加载 `dist/database/cli-data-source.js`，验证返回未连接的 DataSource，配置保留禁止同步和自动迁移；子进程内拦截 `initialize`，命令退出码为 0。未修改业务实现、未执行迁移、未连接真实数据库；生成文件无 Git 差异。此证据不代表业务表已存在或 migration 已通过。

### M1-S05 详情

- 来源：任务卡 M1-T01 里「离线也能生成契约」这一半。还没有 Repository，所以「第一次查库不必先访问 ready」留到有仓储再写。
- 计划：证明应用启动本身不连接数据库。生成 OpenAPI 会创建 `AppModule` 并 `init`，再关掉。如果启动就去 `initialize`，数据库不在线时，生成契约会失败，进程也起不来。不建表，不做登录。
- 动作：
  1. 新增测试：用真实的 `AppModule` 创建应用并 `init`，不要替换 `DatabaseModule`。
  2. 在 `init` 之前监听 `DataSource.prototype.initialize` 和 `ConnectionLifecycleService.prototype.ensureConnected`。
  3. 断言这两个方法都没有被调用，然后 `close`。
- 注意事项：
  - 不要调用 `initialize`。测试环境里的地址不一定连得上，一调用就会真的去连。
  - 不要用假的 `DataSource` 换掉模块里那一个。换掉之后，测到的就不是启动时 TypeORM 实际拿到的配置。
  - 生成脚本 `generate-openapi.ts` 本步不改。它已经是 `create`、`init`、`close`；本步只把「init 不连库」锁进测试。
- 验收：`pnpm --filter @ledger/api test` 和 `pnpm typecheck` 通过，且测试包含：`app.init()` 期间 `initialize` 和 `ensureConnected` 都没有被调用。

### M1-S06 详情

- 来源：任务卡 M1-T01 的「离线 contracts 可生成」，承接 S05 的启动回归测试。
- 计划：运行仓库实际的契约生成链路，证明数据库不可达时仍能生成 OpenAPI 和 Web 类型。本步不创建 migration、Entity 或账号。
- 动作：
  1. 核对根目录 `contracts` 脚本及生成脚本的现有输入、输出，确认生成产物没有需要保留的手工修改。
  2. 为这一次命令注入格式合法、不可达的本机 `DATABASE_URL`，运行 `pnpm contracts`；不修改 `.env`，不关闭用户的 PostgreSQL。
  3. 检查退出码和生成产物，再运行 `pnpm typecheck` 与 `pnpm --filter @ledger/api test`，记录命令及结果。
- 注意事项：只覆盖当前命令的环境变量，不使用真实账号或连接串；不可达地址必须经确认，不把当前 `ledger_test` 默认地址直接视为离线。不得放宽环境校验或打开自动建表/迁移，也不为导出契约替换数据库模块。首次 Repository 调用无需 ready 的验证仍等有仓储后再做。
- 验收：数据库不可达时实际 `pnpm contracts` 退出码为 0，OpenAPI 和 Web 类型成功生成，类型检查及 API 测试通过；生成差异只包含可解释的契约变化。已通过，证据见上。
- 测试运行说明：此测试会调用实际构建及生成命令，重写两份生成产物；运行前应确认生成文件没有需保留的手工修改。它不替代未来真实数据库或 Repository 测试。

### M1-S07 详情

- 来源：M1-T02 的 CLI 配置与技术方案的独立 CLI DataSource；S04 只提供工厂，还不是 TypeORM CLI 可直接加载的入口。
- 计划：提供独立 CLI 入口，读取同一个 `DATABASE_URL` 并复用 `createCliDataSource`；加载入口时不连接。本步不写 migration、不执行迁移、不增加第二套运行连接池。
- 动作：
  1. 助手先在现有 CLI 测试附近补测试：加载入口后只导出一份 `DataSource`、复用共享配置、没有调用 `initialize`；缺少或非法 `DATABASE_URL` 时明确失败。
  2. 用户手写 CLI 入口业务代码。入口与无副作用工厂保持分离，复用现有环境校验，不把环境读取塞进共享配置函数。
  3. 助手运行针对性测试、完整 API 测试和 `pnpm typecheck`；失败时报告原因，不代写业务实现。
- 注意事项：兼容当前 ESM/编译输出及锁定的 TypeORM CLI；测试用虚构地址并拦截连接入口，不执行真实连接。保持 `synchronize:false`、`migrationsRun:false`。显式运行迁移时的连接与 finally 关闭在后续命令步骤验证，本步不把模块加载等同于迁移已可用。
- 验收：CLI 加载入口可取得唯一 `DataSource`，配置来自共享工厂；模块加载不调用 `initialize`，缺少或非法数据库配置被拒绝，API 测试与类型检查通过。已通过，证据见上。

### M1-S08 详情

- 来源：M1-T03 的 users/sessions migration 与实体；先完成 users 的映射这一小步，sessions 和真实迁移后续单独验收。
- 计划：定义 `User` 实体映射 users 表，并让应用与 CLI 共用实体注册；只描述表结构，不创建或修改数据库表。
- 动作：
  1. 助手先补离线元数据测试：users 表名、UUID 主键、username 的 VARCHAR(32) 与唯一约束、password_hash 的 TEXT 非空、created_at 的 timestamptz 非空，以及共享配置中的实体注册。
  2. 用户在技术方案指定的 users 模块中手写实体，并更新共享数据库配置的 entities；字段类型显式声明，不依赖测试编译器推断装饰器类型。
  3. 助手运行针对性测试、完整 API 测试和 `pnpm typecheck`，确认启动和离线 contracts 回归测试仍通过。
- 注意事项：不打开 synchronize 或 migrationsRun，不增加运行 DataSource，不编写 Repository、seed 或登录。不把元数据上的唯一标记视为真实数据库约束已生效；建表、重复迁移和约束验证必须留给专用测试库。UUID 生成策略保持与后续 migration 一致，避免无必要的数据库扩展。
- 验收：元数据及共享注册符合字段要求，API 测试和类型检查通过，应用启动与契约生成保持离线可用。已通过，证据见下；M1-R01 仍未验证。

M1-S08 测试准备记录（2026-10-13）：新增 `apps/api/test/user.entity.spec.ts` 的 3 条测试，使用 TypeORM 离线 metadata 构建检查字段及唯一约束，并检查共享配置与 CLI 的实体注册；拦截 `initialize`，不连接数据库。待实现文件为 `apps/api/src/modules/users/user.entity.ts`，命名导出 `User`；属性约定为 `id`、`username`、`passwordHash`、`createdAt`，后两者分别映射 `password_hash`、`created_at`。将现有 CLI 测试的空实体列表断言改为与共享配置一致。运行 `pnpm --filter @ledger/api test test/user.entity.spec.ts test/data-source.spec.ts`：现有 CLI 10 条通过，新增 3 条在实体文件缺失处失败，尚未执行到元数据断言；不是实体映射已通过的证据。测试辅助函数类型收窄为构造函数后，`pnpm typecheck` 通过。未修改业务代码，本步等待用户完成实体及共享注册；完整 API 与 contracts 验收留到实现后。

M1-S08 实体验证更新（2026-10-13）：用户已完成 `User` 实体。再次运行 `pnpm --filter @ledger/api test test/user.entity.spec.ts test/data-source.spec.ts`：12 条通过、1 条失败；字段映射和 username 唯一约束的离线元数据检查通过，现有 CLI 10 条通过。唯一失败是共享配置仍为 `entities: []`，没有注册 User；等待用户在 `database-options.ts` 中导入实体并更新 entities。未改业务代码，未连接数据库；完整 API、类型检查和离线 contracts 的最终验收留到注册后。本步保持进行中，元数据检查不等于真实数据库约束已经生效。

M1-S08 最终验收证据（2026-10-13）：用户已在共享配置中注册 `User`。`pnpm --filter @ledger/api test test/user.entity.spec.ts test/data-source.spec.ts` 为 2 个文件、13 条测试通过；`pnpm --filter @ledger/api test` 为 9 个文件、24 条测试通过，包含应用启动不连接数据库和执行实际离线 contracts 命令的回归测试；`pnpm typecheck` 的 API 与 Web 检查均通过。验证后 Git 无差异，生成契约未变化。未修改业务代码、未连接真实数据库、未执行 migration；本步 done 不表示 users 表或数据库唯一约束已存在。

### M1-S09 详情

- 来源：M1-T03 的版本化 migration，承接已完成的 users Entity。用户已确认本步范围；测试已准备，业务实现由用户手写。
- 计划：先只写 users 建表 migration 并注册在共享配置中；相比一次实现 users/sessions 和运行命令，这样可以单独核对映射与建表结构，避免提前确定会话 Store 的表结构。
- 动作：
  1. 助手新增 `apps/api/test/users-migration.spec.ts`，用 QueryRunner 替身记录 migration 的建表/删表操作；检查共享配置与 CLI 使用同一 migration。
  2. 用户创建 `apps/api/src/database/migrations/1791849600000-create-users.ts`，命名导出 `CreateUsers1791849600000`，实现 TypeORM 的 `MigrationInterface`。`up(queryRunner)` 使用 `queryRunner.createTable(new Table(...))` 创建 users；`down(queryRunner)` 使用 `queryRunner.dropTable('users')` 删除 users。共享配置显式注册 `migrations: [CreateUsers1791849600000]`；不修改 CLI 工厂。
  3. 助手执行针对性测试、完整 API 测试和 `pnpm typecheck`，记录结果；实现前的失败必须来自待实现功能，不临时修改业务代码。
- 结构：`id UUID PRIMARY KEY`，由调用方提供 UUID，不添加 UUID 扩展或默认生成函数；`username VARCHAR(32) NOT NULL UNIQUE`；`password_hash TEXT NOT NULL`；`created_at TIMESTAMPTZ NOT NULL DEFAULT now()`，与现有 CreateDateColumn 对齐。
- TypeORM 写法约定：Table 的 name 为 `users`，columns 使用数据库列名；username 的 length 为字符串 `'32'`，created_at 的 default 为 SQL 表达式字符串 `'now()'`，不是 JavaScript Date。id 使用 `isPrimary:true`，不设置 `isGenerated` 或 default；所有列不可为空。username 唯一约束可用列的 `isUnique:true` 或独立 TableUnique 表达。
- 注意事项：保持 `synchronize:false`、`migrationsRun:false`；不增加 DataSource、不执行真实建表或回滚、不编写 seed、Repository、sessions 或登录。离线替身只验证 migration 声明和调用，不证明 PostgreSQL 约束生效；后续必须在经确认的专用测试库验证显式迁移、重复执行和约束。
- 验收：离线测试检查表、列、主键、唯一约束、时间默认值、down 操作及共享注册；API 回归和类型检查通过，启动及 contracts 仍不自动连接或迁移。已通过，证据见下；M1-R01 继续保持未验证。

M1-S09 测试准备记录（2026-10-13）：新增 3 条离线测试，覆盖 up 的 users 表结构和唯一约束、down 仅删除 users、共享配置与 CLI 注册相同 migration；第三条还使用 TypeORM 离线 metadata 构建检查 migration 实例。QueryRunner 仅提供建表/删表替身，DataSource.initialize 被拦截。运行 `pnpm --filter @ledger/api test test/users-migration.spec.ts test/user.entity.spec.ts test/data-source.spec.ts`：现有 13 条通过，新增 3 条均因待实现 migration 文件不存在而失败，尚未执行到表结构或共享注册断言；不是建表或迁移已通过的证据。`pnpm typecheck` 通过，新增测试无编辑器诊断。未修改业务代码、未连接数据库、未执行实际 migration；等待用户完成 migration 及共享注册后再运行完整 API 和离线 contracts 验收。

M1-S09 最终验收证据（2026-10-13）：用户已完成 users migration 及共享配置注册。针对性命令 `pnpm --filter @ledger/api test test/users-migration.spec.ts test/user.entity.spec.ts test/data-source.spec.ts` 为 3 个文件、16 条测试通过，包含新增 migration 的 3 条；`pnpm --filter @ledger/api test` 为 10 个文件、27 条通过，包含真实应用启动不连接及实际离线 contracts 命令的回归；`pnpm typecheck` 的 API/Web 检查均通过，两个业务文件无编辑器诊断。未修改用户业务实现、未执行真实 migration 或建表；本步仅验收离线声明和注册，不表示真实数据库约束生效。

### M1-S10 详情

- 来源：M1-T03 的「空库/重复执行/约束通过；禁止开发库 reset」，承接 S09 的离线 migration。只处理 users；sessions 还没有 migration，所以本步通过也不能把 M1-R01 标为通过。
- 计划：在专用测试库 `ledger_it` 上真实执行 users migration。S09 只用替身检查了「代码打算怎么建表」，本步要证明 PostgreSQL 真的建出了这张表、真的拦得住不合规的数据，而且重复执行不会出错。
- 分工：用户已确认库名 `ledger_it`，并把集成测试的配置、脚本和重置方式交给助手决定。本步没有业务代码要写，测试、配置和脚本由助手完成；用户只负责以后按下面的命令运行。
- 动作：
  1. 隔离：默认 `vitest.config.ts` 排除 `test/integration/**`；新增 `vitest.integration.config.ts`，只跑 `test/integration/`，不加载 `setup-env.ts`，文件不并行；`apps/api/package.json` 新增 `test:db` 脚本，`tsconfig.json` 把新配置纳入类型检查。
  2. 防误删：测试开始前检查连接串，必须是本机回环地址（127.0.0.1、localhost、::1），库名必须是 `ledger_it`，且命令里的 `ALLOW_DATABASE_RESET` 必须等于这个库名；任一条不满足就在连库前报错退出。按技术方案 §4，仍只用 `DATABASE_URL` 这一个变量，由这条命令临时注入，不新增 `TEST_DATABASE_URL`。
  3. 重置：通过维护库 `postgres` 执行 `DROP DATABASE IF EXISTS ledger_it` 和 `CREATE DATABASE ledger_it`，只碰 `ledger_it`，不加 `FORCE`；有其他连接占用时直接失败，不强行断开。
  4. 迁移：构建 API，在 `apps/api` 下运行 `pnpm exec typeorm migration:run -d dist/database/cli-data-source.js`，也就是以后手动迁移用的同一条命令。
  5. 检查：首次执行建出 users 和 TypeORM 的 migrations 记录表，记录一行 `CreateUsers1791849600000`；第二次执行输出「No migrations are pending」、没有建表语句、记录仍为一行；核对列类型、长度、非空、默认值、主键和唯一约束；在事务里插入虚构数据验证约束，每次都回滚。
- 注意事项：测试只把库重置为空，不执行 down（down 会删表，它的演练另行授权）；结束时保留迁移后的库，方便用 `psql` 查看，下次运行会重新清空。构建会重写 `apps/api/dist`，正在运行的 `pnpm dev` 会因此重启 API。不修改 `.env`，不记录凭据，不改业务代码；保持 `synchronize:false`、`migrationsRun:false`，不实现 seed、Repository、sessions 或登录。
- 验收：
  - `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db` 通过。
  - 缺少 `ALLOW_DATABASE_RESET`、库名不是 `ledger_it` 时，`test:db` 在连库前失败。
  - `pnpm --filter @ledger/api test` 仍为 10 个文件、27 条通过，不包含集成测试；`pnpm typecheck` 通过；生成契约无 Git 差异。

M1-S10 环境记录（2026-10-15）：用户确认专用测试库名为 `ledger_it`。`psql` 只读连接显示该库不存在；助手执行 `createdb -w -h 127.0.0.1 -p 5432 ledger_it`，退出码为 0。复查结果：PostgreSQL 18.6，`ledger_it` 中非系统 schema 的表数量为 0；当前角色有 CREATE 和 CREATEDB 权限；本机连接无需在命令里写密码。未建表、未执行 migration，未修改 `.env`，也没有改动其他数据库。仍待用户确认三件事：集成测试与默认配置如何隔离（新增配置和脚本）、迁移命令是否做成脚本、每次测试怎么把库重置为空。之后用户把这三件事交给助手决定，结果写在上面的「动作」里。

M1-S10 验收证据（2026-10-15）：
- 新增文件：`apps/api/vitest.integration.config.ts`；`apps/api/test/integration/support/test-database.ts`（防误删检查、重建测试库、构建、执行迁移）；`apps/api/test/integration/test-database-guard.spec.ts`（8 条，只检查字符串、不连库）；`apps/api/test/integration/users-migration.db.spec.ts`（13 条，连接 `ledger_it`）。修改：默认 `vitest.config.ts` 排除 `test/integration/**`；`apps/api/package.json` 新增 `test:db`；`tsconfig.json` 纳入新配置。未改业务代码。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：2 个文件、21 条通过；紧接着再跑一次仍为 21 条通过，说明每次都从空库开始、结果可重复。
- 覆盖内容：首次执行输出「1 migrations are new migrations must be executed」和 `CreateUsers1791849600000` 执行成功，含 `CREATE TABLE "users"`；public 下只有 `migrations`、`users` 两张表，迁移记录 1 行。第二次执行输出「No migrations are pending」，没有建表语句，记录仍为 1 行。列类型、长度 32、四列非空、`created_at` 默认 `now()`、`PRIMARY KEY (id)`、`UNIQUE (username)` 与 S09 计划一致。在回滚的事务里插入虚构数据：重复用户名报 23505，32 个字符可写入、33 个报 22001，id/username/password_hash 为 NULL 以及显式写入 NULL 的 created_at 都报 23502，省略 id 时不会自动生成（23502），非 UUID 报 22P02，省略 created_at 时取数据库 `now()`；最后 users 为 0 行。
- 拒绝路径：不带 `ALLOW_DATABASE_RESET` 时，防误删检查报错，13 条真实库测试全部跳过，`ledger_it` 仍为 0 张表（未被连接或重建）；库名改为 `postgres` 时同样在连库前报错。另开一个 `psql` 连着 `ledger_it` 时，重建失败并报 `database "ledger_it" is being accessed by other users`，没有强行断开那个连接。
- 手动再执行一次迁移命令（在 `apps/api` 下运行 `pnpm exec typeorm migration:run -d dist/database/cli-data-source.js`）：退出码 0，输出「No migrations are pending」，输出中不含连接串。运行结束后 `ledger_it` 保留迁移后的状态：`migrations`、`users` 两张表，users 为 0 行。
- 回归：`pnpm --filter @ledger/api test` 为 10 个文件、27 条通过（不含集成测试）；`pnpm typecheck` 退出码 0；新文件通过 Prettier 检查；两份生成契约无 Git 差异。
- 用户复跑（2026-10-15 15:57）：用户在自己的终端运行同一条 `test:db` 命令，2 个文件、21 条通过（真实库 13 条、防误删检查 8 条），耗时约 2.1 秒。
- 没有验证到：down 回滚没有在真实库执行（需要另行授权）；sessions 还没有 migration，所以 M1-R01 仍未验证。

### M1-S11 详情

- 来源：M1-T03 的后一半「sessions migration 与实体」，以及技术方案 §3 的 sessions 表。做完这一步，M1-R01 的「空库执行后具备 users/sessions、重复执行不重复建表」就有了真实库证据；「应用启动不自动建表或迁移」已由 S05 证明。
- 计划：sessions 表存「谁登录了、什么时候过期」。浏览器 Cookie 里只放一个随机的会话 ID（SID）；服务端用 SID 的 SHA-256 摘要当主键查这张表。这样即使数据库泄露，拿到的摘要也不能直接冒充 Cookie。本步只建表和映射，不写 SessionStore、不接 express-session、不做登录。
- 表结构（用户确认后照此实现）：
  - `session_key_hash CHAR(64) PRIMARY KEY`：SHA-256 的 16 进制字符串固定 64 个字符；明文 SID 不入库。
  - `user_id UUID NOT NULL`，外键引用 `users(id)`，`ON DELETE CASCADE`：只保存已登录的会话，所以必须有用户；用户被删除时，他的会话一起删除，不留下指向不存在用户的登录状态。
  - `data JSONB NOT NULL`：CSRF token 等会话状态；不放密码或账本数据。
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`；`last_seen_at`、`idle_expires_at`、`absolute_expires_at` 均为 `TIMESTAMPTZ NOT NULL`，由以后的 Store 写入，不设默认值。
  - CHECK `idle_expires_at <= absolute_expires_at`：续期只能延长闲置期限，不能超过绝对期限；由数据库兜底，Store 写错时直接报错。
  - 索引 `idle_expires_at`：有了上面的 CHECK，闲置期限总是最早的截止点，以后清理过期会话只需按这一列查找。
- 动作：
  1. 助手先写测试：离线的 Entity 元数据测试和 migration 声明测试（与 S08/S09 同样的方式）；扩展 `users-migration.db.spec.ts` 或新增 sessions 的真实库测试，覆盖两份 migration 首次执行、重复执行、列类型、主键、外键（用户不存在报 23503，删除用户时会话一起删除）、CHECK（报 23514）、索引存在、64 字符上限（65 个报 22001）。S10 的「只有 users 一张业务表、只有 1 条迁移记录」断言会随之改为两张表、两条记录。运行并确认失败原因是待实现的文件不存在。
  2. 用户手写：
     - `apps/api/src/modules/auth/session.entity.ts`，命名导出 `Session`，映射 sessions 表；`userId` 用普通 `@Column` 映射 `user_id`，不加 `@ManyToOne` 关系（Store 只需要用户 ID；外键由 migration 建）。属性名为 `sessionKeyHash`、`userId`、`data`、`createdAt`（`@CreateDateColumn`）、`lastSeenAt`、`idleExpiresAt`、`absoluteExpiresAt`（后三个用普通 `@Column`）。类上用 `@Check` 声明 CHECK，`idleExpiresAt` 上用 `@Index` 声明索引，名称和表达式与 migration 相同。
     - `apps/api/src/database/migrations/1791936000000-create-sessions.ts`，命名导出 `CreateSessions1791936000000`；`up` 用 `createTable`，外键、CHECK、索引分别用 `TableForeignKey`、`TableCheck`、`TableIndex` 写进同一个 `Table`；`down` 只删除 sessions。列顺序：`session_key_hash`、`user_id`、`data`、`created_at`、`last_seen_at`、`idle_expires_at`、`absolute_expires_at`。约束名：外键 `fk_sessions_user_id`，CHECK `chk_sessions_idle_within_absolute`（表达式 `"idle_expires_at" <= "absolute_expires_at"`），索引 `idx_sessions_idle_expires_at`；主键名交给 TypeORM 生成。显式命名是为了以后的 migration 要修改或删除某个约束时，能直接写出它的名字。
     - 共享配置 `database-options.ts` 的 `entities` 加入 `Session`，`migrations` 按时间顺序为 `[CreateUsers1791849600000, CreateSessions1791936000000]`。
  3. 助手运行离线测试、`test:db`、完整 API 测试和 `pnpm typecheck`，记录证据；失败时报告断言和文件位置，由用户修改。
- 注意事项：已经执行过的 users migration 不修改，sessions 另建新 migration（技术方案 §3：已执行的 migration 只能用新版本向前演进）。`CHAR(64)` 只限制最长长度，短的值会补空格存入；摘要格式由以后的 Store 保证，本步不加格式 CHECK。保持 `synchronize:false`、`migrationsRun:false`；不实现 Store、Repository、seed 或登录，不执行 down。
- 验收：离线测试覆盖 Session 元数据、migration 声明和共享注册；`DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db` 通过，且包含上面的外键、CHECK、索引与重复执行检查；`pnpm --filter @ledger/api test` 与 `pnpm typecheck` 通过，生成契约无差异。通过后把 M1-R01 改为通过并关联测试文件。

M1-S11 测试准备记录（2026-10-15）：用户确认表结构，回复「开始 S11」。
- 离线测试：新增 `apps/api/test/session.entity.spec.ts`（3 条：列映射、索引与 CHECK、共享注册 `[User, Session]`）和 `apps/api/test/sessions-migration.spec.ts`（3 条：建表声明含外键/CHECK/索引且 `createTable` 不跳过外键和索引、down 只删 sessions、迁移按 `[CreateUsers, CreateSessions]` 顺序注册）。`users-migration.spec.ts` 的注册测试从「迁移列表只有 users」改为「users 排第一」。
- 真实库测试：S10 里「迁移执行」相关的 2 条移到新文件 `test/integration/migrations-run.db.spec.ts`，改为检查两份迁移（3 条：按时间顺序执行两份、只有 migrations/sessions/users 三张表和 2 条记录、第二次执行无待办）；`users-migration.db.spec.ts` 保留 users 的 11 条结构与约束检查；新增 `sessions-migration.db.spec.ts`（18 条：列、主键/外键/CHECK 定义、索引、合法写入与默认时间、用户不存在 23503、删除用户连带删除会话、闲置期限晚于绝对期限 23514、两者相等允许、主键重复 23505、65 个字符 22001、6 列 NULL 23502、显式 NULL created_at 23502、无残留数据）。重建库、构建、执行迁移和回滚事务的代码移到 `support/test-database.ts` 共用。期望的约束定义字符串先在 `ledger_it` 的一个回滚事务里用同结构探测表核对过，事务回滚后无残留。
- 实现前运行：`pnpm --filter @ledger/api test` 为 12 个文件，原有 10 个文件 27 条通过，新增 6 条全部因 `session.entity.ts`、`1791936000000-create-sessions.ts` 不存在（Cannot find module）而失败。`test:db` 为 4 个文件、40 条：防误删 8 条和 users 11 条通过；`migrations-run` 3 条因只执行了 1 份迁移而失败（找不到「2 migrations are new」、表列表缺 sessions、记录数为 1）；sessions 18 条全部因 `relation "sessions" does not exist` 而失败。`pnpm typecheck` 通过。以上失败都来自待实现的文件，不是实现已通过的证据。未修改业务代码。

M1-S11 实现进度（2026-10-15）：用户写好 `session.entity.ts` 的前四列，并明确要求助手补完其余部分和注释；助手补上 `@Check`、`@Index` 和三个期限列。`pnpm --filter @ledger/api exec vitest run test/session.entity.spec.ts`：列映射、索引与 CHECK 两条通过；共享注册一条失败（`entities` 仍只有 `User`），属于第三处待改的 `database-options.ts`。`pnpm typecheck` 通过，文件通过 Prettier 检查。下一处是 sessions migration，由用户手写。

M1-S11 验收证据（2026-10-15）：
- 实现：用户手写 sessions migration 和 `database-options.ts` 的注册（已自行提交为 `98d2b61`、`fd17fdf`）；按用户要求，助手补完 `session.entity.ts`，并精简了 migration 与 `database-options.ts` 中过时或复制来的注释，没有改动代码逻辑。
- `pnpm --filter @ledger/api test`：12 个文件、33 条通过（含新增的 Session 元数据 3 条、sessions migration 声明 3 条）。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：4 个文件、40 条通过，连续两次结果相同。其中 `migrations-run.db.spec.ts` 3 条（空库上按 users → sessions 顺序执行两份迁移；只有 migrations/sessions/users 三张表、2 条迁移记录；第二次执行「No migrations are pending」且不建表），`sessions-migration.db.spec.ts` 18 条（列与默认值、主键/外键 `ON DELETE CASCADE`/CHECK 的定义、索引；外键 23503、连带删除、CHECK 23514、相等允许、主键重复 23505、超长 22001、6 列 NULL 与显式 NULL created_at 23502、无残留），`users-migration.db.spec.ts` 11 条，防误删 8 条。
- 运行后 `ledger_it`：migrations、sessions、users 三张表；迁移记录依次为 `CreateUsers1791849600000`、`CreateSessions1791936000000`；users、sessions 均为 0 行。
- `pnpm typecheck` 退出码 0；两份生成契约无 Git 差异；本步改动的文件均通过 Prettier。`database.module.ts`、`internal.controller.ts` 有 Prettier 格式差异，来自 `8d38446`，与本步无关，未改动。
- 没有验证到：两份 migration 的 down 都没有在真实库执行（会删表，需另行授权）。

### M1-S12 详情

- 来源：技术方案「pnpm check 目前不含 API 测试（M1-S12 纳入）」和执行计划的提交前检查。以后每一步都会加 API 测试；`pnpm check` 不跑它们，就可能出现 check 通过、API 实际已坏的情况。
- 计划：根目录 `pnpm test` 先跑 API 测试，再跑 Web 测试；`pnpm check` 本身调用 `pnpm run test`，所以无需另改。`test:db` 不进入 check：它会删除并重建 `ledger_it`，需要本机数据库在线和显式确认，不能藏在一条日常命令里。
- 分工：只改根目录 `package.json` 的一个脚本，并同步 README、steering 和计划文档中「根 `pnpm test` 只跑 Web」的说明；没有业务代码。按协作规则，脚本改动需要用户确认由谁来改。
- 动作：
  1. 根 `test` 改为 `pnpm --filter @ledger/api run test && pnpm --filter @ledger/web run test`；用 `&&`，API 测试失败时直接停止并返回非 0。
  2. 运行 `pnpm test` 与 `pnpm check`，记录文件数、测试数和退出码。
  3. 临时放一个必定失败的 API 测试，确认 `pnpm check` 返回非 0；删除后再跑一次，恢复通过。
- 注意事项：API 测试中的 contracts 测试会执行真实的 `pnpm contracts` 并重建 `apps/api/dist`，所以 check 会多花几秒，正在运行的 `pnpm dev` 也会重启一次 API。普通 API 测试仍固定连不上数据库，check 不依赖 PostgreSQL。
- 验收：`pnpm test` 包含 API 12 个文件、33 条和 Web 测试且全部通过；`pnpm check` 退出码 0；临时失败的 API 测试能让 `pnpm check` 失败；临时文件删除后工作区无多余差异。

## 实际执行记录

2026-10-12 开始实施。2026-10-13 完成 M1-S01 到 M1-S09。S09 针对性测试 16 条通过，完整 API 测试 10 个文件、27 条通过，API/Web 类型检查通过，包含启动及实际 contracts 的离线回归。2026-10-15 确认并建立专用测试库 `ledger_it`，新增 `test:db`，完成 M1-S10：users migration 在真实 PostgreSQL 上首次执行建表、重复执行不再建表，约束与计划一致（21 条通过，两次运行可重复）。sessions 尚未建表，阶段验收 M1-R01 仍未验证。同日完成 M1-S11：sessions 的 Entity 与 migration 在 `ledger_it` 上验证通过（API 测试 12 个文件 33 条，`test:db` 4 个文件 40 条，连续两次可重复），M1-R01 通过。之后在此维护：实际日期与工时、应用/迁移/fixture版本、专用测试库名（不写连接串）、运行命令、通过/失败摘要、测试位置或报告链接、未完成项与阶段阻塞。

- [ ] 前置门已核对。
- [ ] PRD 各编号已有实际测试证据。
- [ ] 真实 PostgreSQL／HTTP／Web 或本阶段评测通过。
- [ ] 生成契约与运行行为一致。
- [ ] 未解决阻塞已清楚记录，未虚报完成。

## 依据与导航

[总阅读索引](../README.md) · [总学习计划](../2026-10-09-%E4%B8%AA%E4%BA%BA%E8%B4%A6%E6%9C%AC%E5%85%A8%E6%A0%88%E5%AD%A6%E4%B9%A0%E8%AE%A1%E5%88%92.md)

[产品需求](../../PRD-fullstack-ai-ledger.md) · [总技术方案](../../TECH-PLAN-fullstack-ai-ledger.md)

重点依据：PRD §4～§6、§8；技术方案 §2～§5、§9；数据库与 AppModule 当前代码。

通用约束：只有虚构数据；NestJS/React 单体、本机 PostgreSQL、TypeORM、单一 DATABASE_URL；synchronize:false、migrationsRun:false；无 Docker、Redis 或新业务框架。金额分字符串，月份固定上海时区。文档中的目标文件、命令与验收不是已有实现。
