# M1｜业务数据库与认证最小闭环

- 目标窗口：2026-10-12 ～ 2026-11-08。
- 状态：**进行中**（M1-S09 已验收；当前步骤 M1-S10，等待确认专用测试库）。
- 基线：`49410c2`；文档制定日期：2026-10-09。
- 核心任务：10 张卡，建议工时合计 15 小时；不含所有环境阻塞。

## 前置门与产出

已有 NestJS/React、TypeORM/PostgreSQL、环境校验、health/ready 和 OpenAPI 类型生成；业务 migration、Entity、账号与认证尚未实现。基线为 49410c2，历史测试记录不代表本阶段通过。

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
| M1-R01 | 空库显式执行 migration 后具备 users/sessions；再次执行不重复建表；应用启动不自动建表或迁移。 | 未验证 |
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
| M1-S10 | 在经确认的专用空测试库显式执行 users migration，验证重复执行和真实数据库约束。 | 环境确认中（尚未连接或执行迁移） |

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

### M1-S10 环境确认与计划

- 目标：从离线结构检查推进到本机真实 PostgreSQL 的 users migration 验收。仅处理 users；sessions 尚未实现，不能据此将 M1-R01 整体标为通过。
- 前置条件：用户确认独立、可用于测试的空数据库及其库名，允许在该库建表并写入虚构测试数据。不要向对话发送密码或连接串；由本机环境提供单一 DATABASE_URL。不沿用未知用途的默认库，也不删除已有表来制造空库。
- 动作：
  1. 确认专用库与操作授权，再准备隔离的 PostgreSQL 集成测试；普通离线 API 测试不得自动连接该库。
  2. 构建 API，用编译后的 CLI DataSource 入口执行显式 TypeORM migration 命令；环境注入仅用于该测试进程，不修改用户的 .env。
  3. 验证首次执行创建 users 并记录 migration；第二次执行没有待执行 migration、不重复建表；核对 UUID 主键、username 唯一及长度、非空、created_at 默认时间等真实约束。
  4. 记录命令、结果和库名，不记录凭据；失败时先定位，不改用户业务代码。保持应用启动和 contracts 离线回归。
- 注意事项：真实 down 会删除 users 及其数据，不作为默认测试清理动作；执行回滚或删库须另行明确授权。优先使用事务回滚清理虚构插入数据；测试连接必须在 finally 中关闭。保持 synchronize:false、migrationsRun:false，不实现 seed、Repository 或登录。
- 当前证据：只有计划，尚未准备真实数据库测试、确认目标库或执行迁移。

## 实际执行记录

2026-10-12 开始实施。2026-10-13 完成 M1-S01 到 M1-S09。S09 针对性测试 16 条通过，完整 API 测试 10 个文件、27 条通过，API/Web 类型检查通过，包含启动及实际 contracts 的离线回归。S10 等待确认专用空测试库及真实数据库操作授权。尚未执行业务迁移或真实建表，阶段验收 M1-R01 仍未验证。之后在此维护：实际日期与工时、应用/迁移/fixture版本、专用测试库名（不写连接串）、运行命令、通过/失败摘要、测试位置或报告链接、未完成项与阶段阻塞。

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
