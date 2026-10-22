# M1｜业务数据库与认证最小闭环

- 目标窗口：2026-10-12 ～ 2026-11-08。
- 状态：**进行中**（M1-S24 已验收；当前步骤 M1-S25，me 与 AuthGuard，测试已就绪）。
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
| M1-R02 | seed 建立两个虚构账号；只保存密码哈希，不把密码写入代码、文档或日志；再次执行不悄悄重置已有密码。 | 通过（2026-10-15，M1-S17，限 `ledger_it`）：`apps/api/test/integration/seed-demo-users.db.spec.ts`、`apps/api/test/demo-users.spec.ts`、`apps/api/test/integration/users-repository-write.db.spec.ts`。开发库上的演示留到 M1-T10。 |
| M1-R03 | 正确凭据登录成功并轮换 Session ID；错误用户名和错误密码均返回相同 401 文案，不泄露账号存在性。 | 部分（2026-10-21，M1-S24）：条件本身已有证据，见 `apps/api/test/auth-login.spec.ts`、`apps/api/test/integration/auth-login.db.spec.ts`。按 S24 计划，等 M1-T08 加上登录前的 Origin 检查、统一错误形状后复核，再标通过。 |
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
| M1-S12 | 把 API 测试纳入根目录 `pnpm test`，从而纳入 `pnpm check`；`test:db` 仍单独运行。 | done |
| M1-S13 | 用户名规范化规则：一个纯函数，供以后的 seed 和登录共用。 | done |
| M1-S14 | `UsersRepository` 的两个只读查询：按用户名取登录凭据、按 ID 取公开身份；第一次调用时自己建立连接，不依赖 ready。 | done |
| M1-S15 | 密码哈希与校验（Argon2id）：供以后的 seed 和登录共用。 | done |
| M1-S16 | `UsersRepository` 的写入方法：用户名不存在时创建，已存在时不改动（为 seed「重复执行不重置密码」打基础）。 | done |
| M1-S17 | seed 脚本：建立两个虚构演示账号，密码从运行命令临时提供；重复执行不改已有账号。 | done |
| M1-S18 | 会话期限规则：创建时算出闲置/绝对截止时间，续期不越过绝对期限，到达任一截止点即失效；会话 ID 摘要。纯函数，注入时钟。 | done |
| M1-S19 | `SessionsRepository`：按会话 ID 摘要读写 sessions 表（创建、读取有效会话、更新、删除）。不引入 express-session。 | done |
| M1-S20 | express-session 的 Store 适配：把 express-session 的 get/set/destroy/touch 转成 `SessionsRepository` 调用。需新增依赖。 | done |
| M1-S21 | 把 express-session 挂到应用上（会话密钥配置、Cookie 属性、只作用于需要会话的路径），不含登录接口。 | done |
| M1-S22 | 登录凭据校验 `AuthService.verifyCredentials`：规范化用户名、查凭据、校验密码；所有失败返回同一结果，用户名不存在时也校验一次哈希。不含 HTTP 接口。 | done |
| M1-S23 | 接入 Zod，定义登录请求体 Schema，并验证它在当前 Nest/Swagger 版本上能在运行时拦截不合格请求、也能写进 OpenAPI。不含登录 Controller。 | done |
| M1-S24 | 登录接口 `POST /api/v1/auth/login`：校验凭据、轮换 Session ID、显式保存后返回最小 user；失败不下发 Cookie。不含 Origin 检查和限流（M1-T08）。 | done |
| M1-S25 | `GET /api/v1/auth/me` 与 AuthGuard：身份只来自会话，未登录、会话过期或用户不存在均 401；返回 user 和 csrfToken。不含退出，退出留到下一步。 | 测试已就绪，等待用户实现 |

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
- 验收：`pnpm test` 包含 API 12 个文件、33 条和 Web 测试且全部通过；`pnpm check` 退出码 0；临时失败的 API 测试能让 `pnpm check` 失败；临时文件删除后工作区无多余差异。已通过，证据见下。

M1-S12 验收证据（2026-10-15）：
- 用户把这一步交给助手处理。改动前基线：`pnpm check` 退出码 0，但测试阶段只运行了 `apps/web` 的 1 个文件、2 条，API 测试没有运行。
- 根 `package.json` 的 `test` 改为 `pnpm --filter @ledger/api run test && pnpm --filter @ledger/web run test`。
- `pnpm test`：退出码 0，API 12 个文件、33 条通过，随后 Web 1 个文件、2 条通过。`pnpm check`：退出码 0，依次完成 contracts、typecheck、API 测试、Web 测试和 build。
- 拦截验证：临时新增 `apps/api/test/zz-gate-probe.spec.ts`（断言 `1` 等于 `2`），`pnpm check` 退出码 1，报告 1 个失败、33 个通过；输出中没有 Web 测试和 build 的记录，说明在 API 失败处停下。删除该文件后再跑 `pnpm check`，退出码 0，工作区只剩 `package.json` 和文档的改动。
- 同步更新了根 README、`docs/plan/README.md`、M1 技术方案与执行计划、M5 技术方案和 steering 中「根 `pnpm test` 只跑 Web」的旧说明。
- 未改业务代码；`test:db` 仍不在 check 中。

### M1-S13 详情

- 来源：M1 PRD §4 的用户名契约「trim 后的小写 ASCII，3～32 个字符，仅 a-z、0-9、下划线；seed 和登录采用同一规则」，以及技术方案 §8 单元测试矩阵的「用户名规范化」。它是 M1-T04（UserRepository 与 seed）的第一小步：seed 写入、登录查询都要先把用户名变成同一种形式，否则 `Alice` 和 `alice` 会被当成两个账号，或者登录时查不到。
- 计划：写一个不连数据库的纯函数，把用户输入变成库里保存的用户名；不合法时明确拒绝。本步不写 Repository、seed、密码哈希或登录接口，也不接入 Zod（输入 Schema 留到登录接口那一步）。
- 建议规则（开始前请用户确认）：
  - 文件 `apps/api/src/modules/users/username.ts`，导出 `normalizeUsername(input: string): string | null`；合法时返回规范化后的用户名，不合法时返回 `null`，不抛异常。
  - 先去掉首尾空白；再检查剩下的内容是否只由 3～32 个 `A-Z`、`a-z`、`0-9`、`_` 组成；通过后再转小写。
  - 先检查再转小写，原因是有些非 ASCII 字符转小写后会变成 ASCII，例如开尔文符号 `K`（U+212A）转小写后是普通的 `k`。如果先转小写再检查，它就会被当成合法输入，和真正的 `k` 撞成同一个账号。
  - 中间的空格、连字符、点、中文和 emoji 都不合法。
- 动作：
  1. 助手先写 `apps/api/test/username.spec.ts`：合法输入（含大写、首尾空白、恰好 3 和 32 个字符）返回期望值；2 个和 33 个字符、空串、只有空白、中间空格、非法符号、中文、开尔文符号等返回 `null`；同一用户名的不同写法得到同一个结果。运行并确认因文件不存在而失败。
  2. 用户手写 `username.ts`。
  3. 助手运行该测试和 `pnpm check`，记录证据。
- 注意事项：长度上限 32 与 users 表的 `VARCHAR(32)` 一致，函数先挡住超长输入，不必等数据库报错。密码不经过这个函数，按 PRD 原样使用、不 trim。
- 验收：`username.spec.ts` 全部通过；`pnpm check` 退出码 0。

M1-S13 测试准备记录（2026-10-15）：用户回复「开始 S13」，确认上面的规则。新增 `apps/api/test/username.spec.ts`，共 25 条：9 条合法输入（大写转小写、首尾空格/制表符/换行去掉、恰好 3 个和 32 个字符、纯数字）；1 条同一名字的 4 种写法得到同一个结果；15 条拒绝（空串、只有空白、2 个和 33 个字符及其去空白后的情况、中间空格、连字符、点、@、中文、emoji、全角字母、零宽空格、开尔文符号 U+212A）。用户已先建了空文件 `apps/api/src/modules/users/username.ts`。运行 `pnpm --filter @ledger/api exec vitest run test/username.spec.ts`：25 条全部失败，原因都是 `normalizeUsername` 尚未导出（`expected undefined to be type of 'function'`），还没有执行到规则断言。完整 API 测试中原有 33 条仍然通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S13 验收证据（2026-10-15）：
- 实现：用户先建了空文件，随后明确要求助手代写 `apps/api/src/modules/users/username.ts`（含注释）。实现为：`trim()` 后用 `/^[A-Za-z0-9_]{3,32}$/` 检查，通过再 `toLowerCase()`，否则返回 `null`。
- `pnpm --filter @ledger/api exec vitest run test/username.spec.ts`：25 条通过。
- `pnpm check`：退出码 0；API 13 个文件、58 条通过，Web 1 个文件、2 条通过，build 完成。
- 检查顺序的必要性：用 `node -e` 对比两种写法，开尔文符号开头的 `Kate`（U+212A）在「先转小写再检查」时得到 `kate`，在「先检查再转小写」时得到 `null`；测试中的对应用例能区分这两种实现。没有为此临时修改业务文件。
- 没有验证到：函数还没有被 seed 或登录调用，接入在后续步骤验证。

### M1-S14 详情

- 来源：技术方案 §2「users.repository：按规范化用户名/会话身份参数化读取，显式选择公开字段」、§1「ready 与 SessionStore/Repository 入口都复用 ensureConnected，不能假设第一次业务请求前有人调用 ready」，以及 §8 真实 DB 矩阵的「Repo 首次请求无需先探针」。这是 M1-T04 的第二小步；写入（seed）与密码哈希留到下一步。
- 计划：以后登录要按用户名取出密码哈希来比对，`me` 要按会话里的用户 ID 取出公开身份。两个查询都放进 `UsersRepository`，其他代码不直接写 SQL 或操作实体。
  - 应用启动时不连数据库（S05），所以 Repository 每次查询前先 `await ensureConnected()`。第一次调用会建立连接，之后直接复用；数据库离线时错误原样抛给调用方，以后再映射成 503。
  - 只查需要的列。公开身份只有 `id`、`username`，SQL 里不读 `password_hash`，返回普通对象而不是实体实例；这样哪怕以后有人把结果直接返回给浏览器，也带不出密码哈希。
  - Repository 只做精确匹配，不再规范化用户名；调用方先用 S13 的 `normalizeUsername`。查询参数由 TypeORM 以 `$1` 形式传给数据库，不拼进 SQL 字符串。
- 动作：
  1. 助手先写测试：
     - 离线 `apps/api/test/users.repository.spec.ts`：用真实的 `DatabaseModule` 和 `UsersModule` 组装容器，把 `ensureConnected` 换成一定失败的替身；两个方法都必须原样抛出这个错误，且不调用 `initialize`、不发出查询。
     - 真实库 `apps/api/test/integration/users-repository.db.spec.ts`：在 `ledger_it` 写入两个虚构用户后，用真实的配置、`DatabaseModule`、`UsersModule` 启动容器，不调用 ready；检查第一次查询前未连接、两个并发的首次查询只连接一次；公开身份恰好是 `{ id, username }` 普通对象，且该查询的 SQL 不含 `password_hash`；登录凭据为 `{ id, username, passwordHash }`；不存在的 ID/用户名返回 `null`；大写用户名不匹配（说明规范化由调用方负责）；带引号的恶意输入只返回 `null`。
     - 运行并确认失败原因是待实现的文件不存在。
  2. 用户手写 `apps/api/src/modules/users/users.repository.ts`（`UsersRepository`，以及类型 `PublicUser`、`UserCredentials`）和 `apps/api/src/modules/users/users.module.ts`（`UsersModule`，导入 `DatabaseModule`，提供并导出 `UsersRepository`）。
  3. 助手运行离线测试、`test:db` 和 `pnpm check`，记录证据。
- 注意事项：
  - 不使用 `TypeOrmModule.forFeature`。技术方案要求先在当前锁定版本上验证它在未连接时的行为；本步直接注入共享的 `DataSource`，在 `ensureConnected` 之后再 `getRepository(User)`，绕开这个未验证点。
  - 不新建 DataSource、不调用 ready、不定时探测；本步不把 `UsersModule` 接入 `AppModule`，等登录模块使用它时再接入。
  - 真实库测试结束时必须关闭 Nest 容器，释放连接；否则下一个测试文件重建 `ledger_it` 时会因「库正被使用」而失败。
- 验收：离线测试通过；`DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db` 通过且包含上述检查；`pnpm check` 退出码 0。

M1-S14 测试准备记录（2026-10-15）：
- 新增离线 `apps/api/test/users.repository.spec.ts`（2 条，两个方法各一条）和真实库 `apps/api/test/integration/users-repository.db.spec.ts`（7 条：首次查询自行连接且并发只连一次、公开身份为普通对象且 SQL 不含 `password_hash`、不存在的 ID 返回 null、凭据为普通对象、不存在的用户名返回 null、大写或带空格的用户名不匹配、恶意引号输入作为参数传递且返回 null）。SQL 通过监听 TypeORM 的 `PostgresQueryRunner.prototype.query` 收集。
- 离线运行：2 条均因 `users.module.ts` 不存在（Cannot find module）而失败；完整 API 测试中原有 58 条仍然通过；`pnpm typecheck` 通过；两个测试文件通过 Prettier。
- 真实库运行被阻塞：`test:db` 的 4 个真实库文件都在重建 `ledger_it` 时报 `database "ledger_it" is being accessed by other users`，防误删 8 条通过、其余 39 条跳过。`pg_stat_activity` 显示占用者是两个 DBeaver 连接（17:08 建立，空闲）。按 S10 的设计不强行断开，等用户在 DBeaver 中断开 `ledger_it` 后重跑，确认新增 7 条按预期失败。
- 用户断开 DBeaver 后重跑（17:3x）：`ledger_it` 上无其他连接；`test:db` 为 5 个文件，原有 40 条通过，新增 `users-repository.db.spec.ts` 的 7 条因 `Nest cannot create the RootTestModule instance` 全部跳过——此时用户已建 `users.repository.ts`，`users.module.ts` 仍为空文件，`UsersModule` 未导出。运行结束后 `ledger_it` 无残留连接。

M1-S14 验收证据（2026-10-15）：
- 实现：用户手写 `apps/api/src/modules/users/users.repository.ts` 与 `users.module.ts`。评审时指出并由用户修正：`DataSource` 原从 `typeorm/browser/data-source/index.js` 导入（浏览器构建，带装饰器的构造参数会让这条导入保留到运行时，进程里会多加载一份 TypeORM），改为从 `typeorm` 导入；删除未使用的 `Inject`；实体改用 `@/` 别名导入。构建产物中已无 `typeorm/browser` 引用。
- `pnpm --filter @ledger/api exec vitest run test/users.repository.spec.ts`：2 条通过（连接失败时两个方法都原样抛出同一个错误，不调用 `initialize`、不发 SQL）。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：5 个文件、47 条通过，连续两次相同；其中 `users-repository.db.spec.ts` 7 条覆盖首次查询自行连接且并发只调用一次 `initialize`、公开身份 `toStrictEqual({ id, username })` 且 SQL 不含 `password_hash`、凭据为普通对象、不存在返回 `null`、大写或带空格不匹配、带引号的输入不出现在 SQL 文本中。运行后 `ledger_it` 无残留连接。
- `pnpm check`：退出码 0；API 14 个文件、60 条，Web 1 个文件、2 条，build 完成。相关文件通过 Prettier；生成契约无差异。
- 没有验证到：`UsersModule` 还没有接入 `AppModule`，HTTP 路径上的调用留给登录步骤；数据库离线时映射为 503 也留到后续步骤。

### M1-S15 详情

- 来源：M1 技术方案 §4「seed 使用 Argon2id 异步哈希」、§6「Argon2id 参数按维护库推荐与本机耗时测量选择」，PRD M1-R02「只保存密码哈希」。这是 seed 之前的一小步：seed 写入哈希、登录校验哈希都要用同一套函数。
- 计划：提供两个异步函数，`hashPassword(password)` 返回可直接存进 `users.password_hash` 的字符串，`verifyPassword(storedHash, password)` 返回是否匹配。哈希字符串采用通用的 PHC 格式（`$argon2id$v=19$m=…,t=…,p=…$盐$哈希`），参数和随机盐都写在里面，以后调整参数也能校验旧哈希。本步不写 seed、不改数据库、不做登录。
- 待用户选择实现方式：
  - A（建议）：新增依赖 `@node-rs/argon2`，精确锁定 `2.2.2`（2026-10-15 查询 npm 的最新版本，由 napi-rs 组织维护）。它提供 `hash`/`verify`，自己生成盐、编码 PHC 字符串、做常量时间比较；按平台下载预编译文件，没有安装脚本。安装若被 `pnpm-workspace.yaml` 的发布时长限制挡住，需要另行确认是否加例外。
  - B：不加依赖，使用 Node 26 自带的 `crypto.argon2`。本机 Node 26.11.1 上可用，调用时没有实验性警告（文档稳定性级别开工前再核对）；但它只返回原始哈希字节，PHC 编码、解析和常量时间比较要自己写，出错面更大。
- 参数：以 OWASP 建议的最低档 `m=19456`（19 MiB）、`t=2`、`p=1` 为起点，测量本机单次哈希耗时并记录；不照抄库的默认值，也不在文档里编造测量结果。
- 动作：
  1. 用户选定 A 或 B；选 A 时由助手安装依赖并记录 `package.json` 与锁文件的变化。
  2. 助手先写 `apps/api/test/password-hasher.spec.ts`：输出是 argon2id 的 PHC 字符串且带上述参数；同一密码两次哈希结果不同（随机盐）；正确密码校验为 `true`，错误密码、多一个空格、大小写不同均为 `false`；中文等非 ASCII 密码可用；哈希字符串里不包含明文；格式损坏的哈希返回 `false` 而不是让进程崩溃。运行并确认因文件不存在而失败。
  3. 用户手写 `apps/api/src/modules/auth/password-hasher.ts`。
  4. 助手运行测试、测量耗时、运行 `pnpm check`，记录证据。
- 注意事项：密码原样参与哈希，不 trim、不转小写（PRD §4）；测试只用虚构的固定密码，不写进日志；函数里不打印密码或哈希。只用异步版本，同步版本会在计算的几十毫秒里卡住整个服务器。
- 验收：`password-hasher.spec.ts` 全部通过；记录本机单次哈希耗时；`pnpm check` 退出码 0。

M1-S15 测试准备记录（2026-10-15）：
- 用户选择 A。助手执行 `pnpm --filter @ledger/api add @node-rs/argon2@2.2.2 --save-exact`：`apps/api/package.json` 新增 `"@node-rs/argon2": "2.2.2"`；锁文件只新增该包及其各平台预编译包的条目（本机实际下载 2 个包：主包和 `darwin-arm64`），无安装脚本，安装时供应链检查通过，没有修改 `pnpm-workspace.yaml`。安装输出的 peer 依赖警告是 `@nestjs/swagger@12.0.2` 期望 TypeScript 5/6 而项目用 7.0.2，与新依赖无关。
- 库行为核对（临时脚本，已删除）：`hash` 默认即 Argon2id，输出 PHC 字符串，长度 97；`verify` 遇到格式损坏的哈希会抛出 `InvalidArg: Decoding failed`，所以 `verifyPassword` 要自己接住并返回 `false`。本机（Apple M4）参数 `m=19456,t=2,p=1` 下，10 次哈希耗时中位数 8.5ms（最小 7.2、最大 10.8），校验中位数 8.9ms。
- 新增 `apps/api/test/password-hasher.spec.ts`，14 条：PHC 格式与参数；同一密码两次哈希不同且都能校验；哈希不含明文；错误密码、首尾多空格、大小写不同、空串均为 `false`；中文与 emoji 密码可用；旧参数生成的哈希仍能校验；三种损坏的哈希返回 `false` 而不是抛错；哈希和校验期间不阻塞事件循环。最后一条事先用临时脚本核对过区分力：真正异步的实现 50/50 次通过，用同步 `hashSync` 包一层 `async` 的实现 0/50 次通过。
- 实现前运行：14 条均因 `password-hasher.ts` 不存在而失败；原有 60 条通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S15 验收证据（2026-10-15）：
- 实现：用户手写 `apps/api/src/modules/auth/password-hasher.ts`，并自行提交了初版（`4f35623`，含依赖）。评审发现初版把 `parallelism` 拼成了 `paralleist`：库忽略未知字段并改用默认值 1，结果碰巧仍是 `p=1`，所以 14 条测试和 tsc 都没有发现。用户改正拼写，并按建议加上 `satisfies Options`、`hashPassword` 的返回类型和注释。助手用临时文件确认：保留错误拼写并加上 `satisfies Options` 时，tsc 报 `TS2561 ... Did you mean to write 'parallelism'?`；临时文件已删除。
- `pnpm --filter @ledger/api exec vitest run test/password-hasher.spec.ts`：14 条通过。
- `pnpm check`：退出码 0；API 15 个文件、74 条，Web 1 个文件、2 条，build 完成。文件通过 Prettier。
- 编译产物 `dist/modules/auth/password-hasher.js` 中 `Algorithm.Argon2id` 被内联为 `2`；直接导入该产物哈希一次虚构密码，得到 `$argon2id$v=19$m=19456,t=2,p=1` 前缀，且校验为 `true`。
- 本机耗时（Apple M4，见上方准备记录）：哈希中位数 8.5ms，校验中位数 8.9ms；参数暂定 OWASP 最低档，调高后旧哈希仍可校验。
- 没有验证到：还没有被 seed 或登录调用；「用户名不存在时也执行一次等价的哈希校验，减少时间差」（技术方案 §6）留到登录步骤。

### M1-S16 详情

- 来源：PRD M1-R02「seed 建立两个虚构账号；只保存密码哈希；再次执行不悄悄重置已有密码」，技术方案 §4「现有账号再次 seed 不重置密码」。seed 本身（命令、账号来源）放到下一步；本步只做它依赖的写入方法，把「已存在就不动」落实在数据库层。
- 计划：在 `UsersRepository` 增加 `createIfAbsent({ username, passwordHash })`，返回 `'created'` 或 `'exists'`。
  - 用一条带参数的 SQL：`INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING RETURNING id`。用户名已存在时数据库什么都不做、不返回行，据此判断 `'exists'`。不要先查询再插入：两次 seed 同时运行时，两边都可能查到「不存在」，然后一边插入成功、另一边撞上唯一约束报错；`ON CONFLICT` 把判断和写入合成一步。
  - `id` 在 Repository 内用 `crypto.randomUUID()` 生成（users 表不自动生成 id，见 S09）。
  - 写入前做两道检查，不符合就抛错、不写库（建议，待用户确认）：用户名必须已经是规范化形式（`normalizeUsername(username) === username`），否则登录时永远查不到；密码哈希必须以 `$argon2id$` 开头，防止把明文密码误传进来存进库里。
  - 先 `ensureConnected()`，与 S14 的读取方法一致。
- 动作：
  1. 用户确认上述设计（尤其两道检查）。
  2. 助手先写测试：离线测试覆盖两道检查在连库前就拒绝，以及连接失败原样抛出；`ledger_it` 上覆盖首次创建、再次调用（换一个哈希）返回 `'exists'` 且库里仍是原来的哈希、两个并发调用恰好一个 `'created'` 且只有一行、创建后能用 S14 的两个查询读到、SQL 以参数传值。运行并确认因方法不存在而失败。
  3. 用户在 `users.repository.ts` 中实现。
  4. 助手运行离线测试、`test:db`、`pnpm check`，记录证据。
- 注意事项：本步不写 seed 脚本、不读取任何密码来源、不新增 npm 脚本；不提供修改密码的方法。真实库测试写入的虚构用户会随下次 `test:db` 重建库一起清掉。
- 验收：离线测试与 `test:db` 通过且包含上述检查；`pnpm check` 退出码 0。

M1-S16 测试准备记录（2026-10-15）：用户回复「开始 S16」，同意两道写入检查。
- 离线 `apps/api/test/users.repository.spec.ts` 新增 10 条：`createIfAbsent` 连接失败时原样抛出；4 种未规范化的用户名（大写、首尾空白、过短、不允许的字符）和 4 种不合格的哈希（明文、空串、`$argon2i$`、缺开头的 `$`）都在调用 `ensureConnected` 之前被拒绝、不发 SQL；错误信息和堆栈不包含传入的明文。
- 真实库 `apps/api/test/integration/users-repository-write.db.spec.ts` 4 条：首次创建返回 `'created'`，id 为 UUID v4，S14 的两个查询能读到；已存在时换一个哈希再调用返回 `'exists'`，库里的行（含原哈希）不变；同名并发 10 轮，每轮恰好一个 `'created'`、一行；SQL 文本不含用户名和哈希。
- 并发测试的区分力：用临时脚本直接在 `ledger_it` 上对比，「先查再插」在单次并发中 30 轮有 15 轮出错或结果不对，`ON CONFLICT` 为 0/30；因此测试改为 10 轮，「先查再插」全部侥幸通过的概率约 0.1%。脚本写入的数据已删除，脚本文件已删除。
- 实现前运行：离线 10 条和真实库 4 条均因 `createIfAbsent is not a function` 失败；其余 API 测试 74 条、真实库 47 条通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S16 验收证据（2026-10-15）：
- 实现：用户在 `apps/api/src/modules/users/users.repository.ts` 中手写 `createIfAbsent`：先做两道检查（报错信息不含传入值），再 `ensureConnected()`，然后执行带参数的 `INSERT ... ON CONFLICT (username) DO NOTHING RETURNING id`，按返回行数判断 `'created'`/`'exists'`。
- `pnpm --filter @ledger/api exec vitest run test/users.repository.spec.ts`：12 条通过。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：6 个文件、51 条通过，含新增 4 条（并发 10 轮均恰好一行）。
- `pnpm check`：退出码 0；API 15 个文件、84 条，Web 1 个文件、2 条，build 完成。`pnpm typecheck` 通过，文件通过 Prettier（Prettier 不整理模板字符串内的 SQL 排版）。
- 没有验证到：seed 尚未调用该方法；没有提供修改密码的方法（本阶段不需要）。

### M1-S17 详情

- 来源：PRD M1-R02、技术方案 §2 `src/scripts/seed-demo-users.ts`「受控建立两名演示账号；禁止内嵌秘密、静默改密码、自动建表」、§4「seed 不使用固定演示密码」。
- 计划：一个显式运行的命令，为两个虚构账号各执行一次「哈希密码 → `createIfAbsent`」，并逐个输出 `created` 或 `exists`。它复用已有的 `UsersRepository`、`hashPassword` 和共享连接，结束时关闭连接；不建表、不迁移，库里没有 users 表时报错退出。
- 设计（用户回复「然后下一步」，按以下建议执行）：
  - 账号：`demo_a`、`demo_b`（虚构，写在代码里；用户名不是秘密）。
  - 密码来源：运行命令时由环境变量 `SEED_DEMO_A_PASSWORD`、`SEED_DEMO_B_PASSWORD` 临时提供，不写进代码、`.env`、文档或日志。按 PRD 要求长度 12～128，原样使用；缺少或不合格时在连接数据库之前报错。每次运行都要提供两个密码：先把输入全部检查完再连库，比边连边查更简单；账号已存在时，算出的新哈希会被 `ON CONFLICT` 丢弃，不改动库里的数据。
  - 文件拆成两个：`apps/api/src/scripts/demo-users.ts` 只放没有副作用的逻辑（读取并检查密码、逐个创建账号），便于离线测试；`apps/api/src/scripts/seed-demo-users.ts` 是命令入口，负责组装 Nest、打印结果、关闭连接和设置退出码。
  - 运行方式：`apps/api` 新增脚本 `seed:demo`（先构建，再运行 `dist/scripts/seed-demo-users.js`），入口用 `NestFactory.createApplicationContext` 组装 `ConfigModule`、`DatabaseModule`、`UsersModule`，在 `finally` 中关闭。
  - 输出：只打印用户名和结果；失败时只打印错误信息（不打印堆栈），退出码 1。不打印密码、哈希或连接串。
- 测试（助手先写）：离线覆盖密码缺少、过短、过长时报错且错误信息不含密码，12 和 128 个字符可用、前后空格原样保留，以及逐个调用 `createIfAbsent` 时传入的是能校验通过的 Argon2id 哈希；`ledger_it` 上运行真实的 `pnpm run seed:demo`，覆盖首次创建两个账号、第二次换密码运行均为 `exists` 且哈希不变、命令能自己退出、输出不含密码/哈希/连接串、缺密码时即使数据库地址连不上也先报密码错误、未迁移的空库上报错退出且不建表。
- 注意事项：本步只在 `ledger_it` 上验证；开发库还没执行过 migration，给开发库迁移和 seed 留到 M1-T10 的演示步骤。脚本 `seed:demo` 由助手添加（与 `test:db` 相同的分工）。
- 验收：离线测试和 `test:db` 通过；`pnpm check` 退出码 0。

M1-S17 测试准备记录（2026-10-15）：
- 用户要求助手整理 S16 的两处可选问题：`users.repository.ts` 的 SQL 排版、导入顺序和注释（`b97e75b`，未改逻辑；离线 12 条、`test:db` 51 条、`pnpm typecheck` 均通过）。
- `apps/api/package.json` 新增 `"seed:demo": "pnpm run build && node dist/scripts/seed-demo-users.js"`。
- 离线 `apps/api/test/demo-users.spec.ts` 10 条：`readDemoAccounts` 返回 `demo_a`/`demo_b` 及原样密码（保留首尾空格），12 和 128 个字符可用，缺少、空串、11 个、129 个字符时报错且信息含变量名、不含密码；`seedDemoUsers` 按顺序调用 `createIfAbsent`，传入的哈希能用对应密码校验通过，并返回各账号结果；第一个失败时原样抛出且不再处理第二个。
- 真实库 `apps/api/test/integration/seed-demo-users.db.spec.ts` 4 条，运行真实的 `pnpm run seed:demo`：首次运行两个账号 `created`、哈希可校验；换密码再运行两个都是 `exists`，行不变，旧密码仍能校验、新密码不能；缺少 `SEED_DEMO_B_PASSWORD` 时先确认 `127.0.0.1:1` 连接被拒绝，再用它作数据库地址运行，命令失败、输出含变量名且不含 `ECONNREFUSED`；把 `ledger_it` 重建为空库后运行，命令失败、输出含 `relation "users" does not exist`，且库里仍没有任何表。每条都检查输出不含密码、`$argon2id$` 和 `postgresql://`；命令 60 秒内未自行退出视为失败。
- 实现前运行：离线 10 条因 `demo-users.ts` 不存在失败；真实库 4 条因 `dist/scripts/seed-demo-users.js` 不存在而失败；其余 API 测试 84 条、真实库 51 条通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S17 验收证据（2026-10-15）：
- 实现：用户手写 `apps/api/src/scripts/demo-users.ts`（`readDemoAccounts`、`seedDemoUsers`）和 `apps/api/src/scripts/seed-demo-users.ts`（命令入口：先检查密码，再用 `createApplicationContext` 组装模块，`finally` 中关闭，失败时只打印错误信息并设退出码 1）。
- `pnpm --filter @ledger/api exec vitest run test/demo-users.spec.ts`：10 条通过。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：7 个文件、55 条通过，连续两次相同；其中 `seed-demo-users.db.spec.ts` 4 条全部通过。运行后 `ledger_it` 无残留连接。
- 手动运行（`ledger_it`，先执行一次 migration 命令，输出「No migrations are pending」；虚构密码只在命令里提供）：第一次输出 `demo_a: created`、`demo_b: created`，第二次换密码输出两个 `exists`，退出码均为 0；缺少 `SEED_DEMO_B_PASSWORD` 时输出 `seed:demo failed: SEED_DEMO_B_PASSWORD must be set to a password of 12 to 128 characters`。库中两行的哈希均以 `$argon2id$v=19$m=19456,t=2,p=1$` 开头。
- `pnpm check`：退出码 0；API 16 个文件、94 条，Web 1 个文件、2 条，build 完成。`src/scripts` 通过 Prettier。
- 同步更新根 README 命令表、`docs/plan/README.md` 和 steering 中关于 seed 的说明。
- 没有验证到：没有在开发库上运行（开发库尚未执行 migration，留到 M1-T10 演示步骤）。

### M1-S18 详情

- 用户回复「开始 S18」，确认以下设计。
- 来源：M1 PRD §4「会话闲置 12 小时、绝对 7 天；到达任一截止点即失效」，技术方案 §5「touch 仅延长闲置期限，不越过 absolute_expires_at；读写均检查最早截止点」「以 SHA-256(Session ID) 为 DB 键」，§8 单元测试「绝对/闲置期限；注入时钟，不靠长时间 sleep」。这是 M1-T05（SessionStore）的第一小步：先把时间规则写成纯函数，Store 读写数据库时直接调用，规则只有一份。
- 计划：新建 `apps/api/src/modules/auth/session-lifecycle.ts`，不连数据库、不读系统时间（「现在」由调用方传入），本步不引入 express-session、不写 Store。
- 建议内容：
  - 常量 `SESSION_IDLE_TIMEOUT_MS`（12 小时）和 `SESSION_ABSOLUTE_TIMEOUT_MS`（7 天）。
  - `startSessionWindow(now)`：返回 `{ lastSeenAt: now, idleExpiresAt: now + 12h, absoluteExpiresAt: now + 7d }`。
  - `touchSessionWindow(window, now)`：`lastSeenAt` 改为 `now`，`idleExpiresAt` 改为 `now + 12h` 与 `absoluteExpiresAt` 两者中较早的那个；`absoluteExpiresAt` 不变。这样永远满足 sessions 表的 CHECK。
  - `isSessionActive(window, now)`：`now` 早于两个截止时间才算有效；恰好等于截止时间即失效。
  - `hashSessionId(sessionId)`：返回 SHA-256 的 64 位小写 16 进制字符串，与 `session_key_hash CHAR(64)` 对应。
  - 所有函数返回新对象，不修改传入的对象；时间都用 `Date`。
- 动作：用户确认后，助手先写 `apps/api/test/session-lifecycle.spec.ts`（固定的虚构时间，覆盖创建、续期、续期被绝对期限截住、恰好到期、多次续期累计也不超过 7 天、不修改入参、摘要长度与格式、同一 ID 摘要相同且不含原文），确认失败后由用户实现，再运行测试和 `pnpm check`。
- 验收：`session-lifecycle.spec.ts` 全部通过；`pnpm check` 退出码 0。

M1-S18 测试准备记录（2026-10-15）：
- 新增 `apps/api/test/session-lifecycle.spec.ts`，13 条，全部使用固定的虚构时间 `2026-10-15T08:00:00.000Z`：两个常量为 12 小时和 7 天；创建时三个时间正确；刚登录、闲置截止前 1ms 有效，恰好到达和超过闲置截止失效；绝对截止早于闲置截止时同样会被检查；6 小时后续期，闲置截止移到续期后 12 小时、绝对截止不变；7 天前 2 小时续期时闲置截止被截在绝对截止；每 11 小时续期一次共 15 次，每次闲置截止都不晚于绝对截止，到第 7 天仍失效；续期返回新对象且不修改传入的对象；摘要与 SHA-256("abc") 公开测试向量一致、为 64 位小写 16 进制、同一 ID 结果相同、不同 ID 结果不同、不含原文。
- 实现前运行：13 条均因 `session-lifecycle.ts` 不存在而失败；原有 94 条通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S18 验收证据（2026-10-15）：
- 实现：用户手写 `apps/api/src/modules/auth/session-lifecycle.ts`（两个常量、`startSessionWindow`、`touchSessionWindow`、`isSessionActive`、`hashSessionId`），并要求助手补充注释；助手只增改注释，没有改动代码逻辑。
- `pnpm --filter @ledger/api exec vitest run test/session-lifecycle.spec.ts`：13 条通过。
- `pnpm check`：退出码 0；API 17 个文件、107 条，Web 1 个文件、2 条，build 完成。文件通过 Prettier。
- 没有验证到：还没有被 Store 或登录调用。

### M1-S19 详情

- 用户回复「开始 S19」，确认以下设计。
- 来源：技术方案 §5「Store 的 get/set/destroy/touch 全部以 SHA-256(Session ID) 为 DB 键；明文 SID 不写 DB/日志」「读写均检查最早截止点」，§8 真实 DB 矩阵「Session FK、SID hash、touch 不延长绝对期限、destroy」。M1-T05 估 2 小时、允许拆成两张卡：本步只做数据库这一层，下一步再接 express-session。
- 为什么先拆出这一层：express-session 是新依赖（2026-10-15 查询 npm 最新为 `1.19.0`，Nest 当前用 Express `5.2.1`），它的 Store 接口还要单独核对。先把「怎么按摘要读写 sessions 表」做好并在 `ledger_it` 上验证，接 express-session 时只需要做一层薄薄的转换。
- 建议内容：`apps/api/src/modules/auth/sessions.repository.ts` 的 `SessionsRepository`，每个方法先 `ensureConnected()`，接收明文会话 ID 并在内部用 `hashSessionId` 转成摘要，SQL 一律带参数：
  - `create(sessionId, { userId, data, window })`：插入一行；摘要已存在就报错（随机 ID 不应重复）。
  - `findActive(sessionId, now)`：按摘要读一行，用 `isSessionActive` 判断，过期或不存在返回 `null`。期限规则只在 S18 一处，SQL 里不再写一遍。
  - `update(sessionId, { data, window })`：更新 data 和三个时间，不改 `user_id`；用于续期和保存会话内容。
  - `delete(sessionId)`：删除这一行，用于退出。
  - 一个 `AuthModule`（导入 `DatabaseModule`，提供并导出 `SessionsRepository`）；本步不接入 `AppModule`。
- 测试（助手先写）：离线覆盖连接失败原样抛出、不发 SQL；`ledger_it` 上覆盖库里存的是摘要而不是明文 ID、能按 ID 读回、过期（用传入的时间判断）返回 `null`、更新后读到新内容且 `user_id` 不变、续期写入后 CHECK 约束仍满足、删除后读不到、用户不存在时创建失败（外键）、SQL 中不出现明文 ID。
- 验收：离线测试与 `test:db` 通过；`pnpm check` 退出码 0。

M1-S19 测试准备记录（2026-10-15）：
- 准备中的核对（临时脚本，已删除，写入的数据已清除）：用编译后的 `Session` 实体在 `ledger_it` 上试了 TypeORM 的 `insert`/`findOne`/`update`/`delete`：读回的 `data` 是普通对象、三个时间是 `Date`；`update`、`delete` 的 `affected` 在命中时为 1、未命中时为 0；外键冲突和主键重复抛 `QueryFailedError`，`code` 分别为 `23503`、`23505`。类型检查发现：实体的 `data` 声明为 `Record<string, unknown>` 时，`update` 的参数类型不接受它（TS2322）；改成具体类型 `{ csrfToken: string }` 后通过。因此本步把实体的 `data` 改为导出类型 `SessionData = { csrfToken: string }`，这也符合技术方案「会话最少持有 userId、csrfToken」。
- 离线 `apps/api/test/sessions.repository.spec.ts` 4 条：`create`、`findActive`、`update`、`delete` 在连接失败时都原样抛出，不调用 `initialize`、不发 SQL。
- 真实库 `apps/api/test/integration/sessions-repository.db.spec.ts` 10 条：库里只有摘要（按明文 ID 在主键和 data 中都查不到）；有效会话读回为与写入相同的普通记录；闲置截止前 1ms 可读、恰好到达和超过截止返回 `null`、未知 ID 返回 `null`；续期更新返回 `true`，原闲置截止过后仍可读到新内容；更新内容里混入 `userId` 也不会改变归属；更新未知 ID 返回 `false` 且不建行；删除只影响目标会话、重复删除不报错；用户不存在时创建报 `23503`；同一 ID 再次创建报 `23505` 且原行不变；四个方法发给数据库的 SQL 和参数中都没有明文 ID、只有摘要。
- 实现前运行：离线 4 条与真实库 10 条均因 `auth.module.ts` 不存在而失败（真实库的 10 条在准备阶段失败后跳过）；其余 API 测试 107 条、真实库 55 条通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S19 验收证据（2026-10-15）：
- 实现：用户手写 `apps/api/src/modules/auth/sessions.repository.ts`、`auth.module.ts`，并把 `session.entity.ts` 的 `data` 改为 `SessionData`。按用户要求，助手补充并修正注释：实体顶部和三个时间列的说明从「以后的 SessionStore」改为实际负责的文件，`SessionData` 加说明；`auth.module.ts` 中从 `UsersModule` 复制来的注释（写的是 UsersRepository）改为 AuthModule 的实际内容，并去掉导入间的空行；`sessions.repository.ts` 为各方法加注释，并给 `create` 补上返回类型 `Promise<void>`。没有改动代码逻辑。
- `pnpm --filter @ledger/api exec vitest run test/sessions.repository.spec.ts test/session.entity.spec.ts`：7 条通过（含 S11 的实体元数据测试，确认改类型后映射不变）。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：8 个文件、65 条通过，连续两次相同；运行后 `ledger_it` 无残留连接。
- `pnpm check`：退出码 0；API 18 个文件、111 条，Web 1 个文件、2 条，build 完成。`modules/auth` 通过 Prettier；生成契约无差异。
- 没有验证到：过期会话不会自动删除（清理任务不在 M1 范围内，需要时另行规划）；`AuthModule` 尚未接入 `AppModule`。

### M1-S20 详情

- 用户回复「开始 S20」。
- 来源：技术方案 §5「采用维护中的 express-session；持久化 Store 适配层复用项目 DataSource……不符合要求则以清晰、可测试的薄适配实现 Store 接口」「set 写入已认证会话；saveUninitialized:false 不保存匿名会话；touch 仅延长闲置期限」。这是 M1-T05 的后一半。
- 依赖：`pnpm --filter @ledger/api add express-session@1.19.0 --save-exact`、`pnpm --filter @ledger/api add -D @types/express-session@1.19.0 --save-exact`。锁文件新增 express-session 的 7 个运行时依赖包和类型包带来的 `@types/express@5.0.6` 等类型包；无新的安装脚本，peer 依赖警告仍只有原有的 `@nestjs/swagger` 与 TypeScript 7。
- 源码核对（`express-session@1.19.0` 的 `index.js`、`session/store.js`、`session/session.js`、`session/cookie.js`）：
  - `get(sid, cb)`：回调第二个参数为空时，express-session 生成一个新会话（新 ID）；回调带错误且 `code` 不是 `ENOENT` 时直接交给 `next(err)`。
  - `get` 返回的对象会经过 `Store.prototype.createSession`，它读取 `sess.cookie.expires` 并用 `new Cookie(sess.cookie)` 还原 Cookie，所以必须带 `cookie` 字段；已有会话的 Cookie 属性来自 Store 返回的值，而不是中间件配置，因此 Store 需要知道配置的 Cookie 属性。Cookie 不设 `maxAge` 时，`expires` 为 `null`（浏览器关闭即清除）。
  - 什么时候调用 `set`/`touch`（`resave:false`、`saveUninitialized:false`）：新会话只有被修改过才 `set`；读出来的会话在本次请求里被修改（比较不含 cookie 的 JSON 摘要）就 `set`，没修改就 `touch`（Store 实现了 `touch` 时）。退出用 `destroy`，`regenerate` 先 `destroy` 旧 ID 再生成新会话。
  - `Session.prototype.save` 调用 `store.set(id, this, fn || noop)`；`Session.prototype.destroy(fn)` 可能不传回调；类型包里 `set`/`destroy`/`touch` 的回调都是可选的。
- 设计（据此确定）：新建 `apps/api/src/modules/auth/session-store.ts`，导出 `PostgresSessionStore extends session.Store`，构造参数为 `SessionsRepository`、Cookie 属性（`path`、`httpOnly`、`secure`、`sameSite`）和时钟（默认 `() => new Date()`）。
  - `get`：`findActive(sid, now)`；不存在或过期回调 `null`；有效时回调 `{ cookie: { ...Cookie 属性, originalMaxAge: null }, userId, csrfToken, loadedFromStore: true }`。
  - `set`：没有字符串类型的 `userId` 和 `csrfToken` 就回调错误、不写库（不保存匿名会话）。没有 `loadedFromStore` 标记的是本次请求新建的会话（例如登录后）→ `create`，期限用 `startSessionWindow`。带标记的是读出来的会话 → 先 `findActive` 取数据库里的期限，再用 `touchSessionWindow` 续期并 `update`；读不到（期间已退出或过期）就什么都不做，不重新创建；`userId` 与库里不一致就回调错误。
  - 为什么要 `loadedFromStore` 标记：没有它，「读出来后被另一个请求退出删除的会话」和「刚登录的新会话」在 Store 看来都是「库里没有」，`set` 只能一律创建，退出的会话就会以同一个 ID 被重新建出来，旧 Cookie 又能用了（违反 M1-R05）。标记由 `get` 写入会话对象，只有从库里读出来的会话才有。
  - `touch`：读出期限、续期并更新，数据不变；读不到就什么都不做。`destroy`：`delete`。
  - 所有数据库错误原样交给回调，回调恰好调用一次；没有回调时不报错。
- 本步不挂到 Express 上、不做登录接口，`AuthModule` 也不提供这个类（它需要 Cookie 配置，接入时在下一步创建）。
- 验收：`apps/api/test/session-store.spec.ts` 与 `apps/api/test/integration/session-store.db.spec.ts` 通过；`test:db` 全部通过；`pnpm check` 退出码 0。

M1-S20 测试准备记录（2026-10-15）：
- 离线 `apps/api/test/session-store.spec.ts` 22 条，使用内存版假仓储和固定时钟：`get` 对未知/过期返回 `null`、有效时返回上述结构并把时钟时间传给 `findActive`；经 express-session 自带的 `load` 能还原成 `Session` 实例，`cookie` 是 `Cookie` 实例、属性来自配置、`expires` 为 `null`；`set` 新会话只存 `csrfToken`（多余字段不入库）、期限从当前时间开始；缺 `userId`、缺 `csrfToken`、`userId` 非字符串时回调错误且不写库；读出的会话续期时闲置截止从库里的期限计算；读出后被删除的会话不会重新创建；改变 `userId` 回调错误；`touch` 保留库里的数据、续期不越过绝对截止、未知或过期时不写库；`destroy` 删除，且不传回调也能执行；5 种调用在仓储失败时都把同一个错误交给回调、回调只调用一次。
- 真实库 `apps/api/test/integration/session-store.db.spec.ts` 2 条：经真实 `SessionsRepository` 和 express-session 的 `load`/`save` 完成「新建 → 6 小时后读出并续期 → 原闲置截止过后仍可读 → 删除后读不到、库里无行」；读出会话后另一请求删除它，本请求修改并 `save`，库里仍然没有这一行。
- 测试自身的核对：先在 `test/` 下放了一份临时参考实现，把两个测试文件复制一份指向它运行：离线 22 条、真实库 2 条通过；其中离线测试最初把 `cookie.expires` 断言为 `undefined`，与 express-session 实际行为（`null`）不符，已改正。再把参考实现改成「读不到就创建」，离线测试中「不会重新创建」等 3 条失败，说明测试能发现这个漏洞。临时文件均已删除。
- 实现前运行：离线 22 条、真实库 2 条均因 `session-store.ts` 不存在而失败；其余 API 测试 111 条、真实库 65 条通过；`pnpm typecheck` 通过；测试文件通过 Prettier。未修改业务代码。

M1-S20 验收证据（2026-10-15）：
- 实现：用户手写 `apps/api/src/modules/auth/session-store.ts`（`PostgresSessionStore`），并要求助手补充简要注释；助手加注释，并删掉 `write` 中一行重复的 `return`（第二个永远执行不到，删除不改变行为）。
- `pnpm --filter @ledger/api exec vitest run test/session-store.spec.ts`：22 条通过。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：9 个文件、67 条通过，连续两次相同；运行后 `ledger_it` 无残留连接。
- `pnpm check`：退出码 0；API 19 个文件、133 条，Web 1 个文件、2 条，build 完成。文件通过 Prettier。
- 编译产物：直接导入 `dist/modules/auth/session-store.js`，实例属于 `express-session` 的 `Store`，`get` 未知 ID 回调 `null, null`，说明 ESM 构建下默认导入 express-session 正常。
- M1-T05（SessionStore get/set/destroy/touch、SID 摘要、闲置/绝对期限）由 S18～S20 完成。
- 没有验证到：还没有挂到 Express 上，没有经过 HTTP 请求。

### M1-S21 详情

- 用户回复「开始 S21」。
- 来源：技术方案 §5「本地 loopback HTTP 使用 `ledger.sid`、Secure:false；HttpOnly、SameSite:Lax、Path:/、无 Domain」「SESSION_SECRET 是服务端配置，缺失拒绝认证配置启动；不能写死或从 DATABASE_URL 派生」「saveUninitialized:false」，§1「contracts 新增会话模块后仍需能离线导出 OpenAPI……不允许放宽运行时必需配置」，PRD M1-R08「数据库离线时 health 仍为 200」。这是 M1-T06（登录）之前的接线步骤。
- 计划：让应用真正带上会话中间件，但还没有任何接口往会话里写东西。
- 设计（核对后相对初稿的调整）：
  - `SESSION_SECRET` 不放进 `validateEnvironment`：它同时被 TypeORM CLI 入口、seed 和 contracts 使用，这些命令不处理 HTTP 会话，不应因为缺少会话密钥而失败。改为在安装会话中间件时检查：新建 `apps/api/src/modules/auth/session-config.ts`，导出 Cookie 名称 `ledger.sid`、Cookie 属性（`path:'/'`、`httpOnly:true`、`secure:false`、`sameSite:'lax'`，不设过期时间）、挂载路径 `['/api/v1/auth']` 和 `readSessionSecret(value)`（缺少、非字符串、只有空白时报「SESSION_SECRET is required」，少于 32 个字符时报「must be at least 32 characters」，错误信息不带传入值）。
  - `apps/api/src/configure-app.ts` 新增 `configureSession(app)`：从 `ConfigService` 读密钥并检查，用 `app.get(SessionsRepository)` 创建 `PostgresSessionStore`，再 `app.use(挂载路径, session({ name, secret, store, resave:false, saveUninitialized:false, cookie }))`。`main.ts` 在 `configureApp(app)` 之后调用它；`AppModule` 导入 `AuthModule`。
  - `generate-openapi.ts` 不调用 `configureSession`：OpenAPI 只来自控制器，与中间件无关，所以 `pnpm contracts` 不需要会话密钥，`contracts.spec.ts` 不用改。运行时（`main.ts`）仍然必须提供密钥，没有放宽。
  - 只挂在 `/api/v1/auth`：用临时测试（未改业务代码，已删除）验证过反例——会话中间件挂在所有路径上、数据库不可用时，带会话 Cookie 的 `GET /api/v1/health` 返回 500，不带 Cookie 才是 200；也就是说浏览器只要登录过，数据库一断 health 就失败，违反 M1-R08。以后需要身份的业务路径（M2 起）再加入挂载列表。
- 用户需要做的环境改动：在仓库根 `.env` 里加一行 `SESSION_SECRET=<随机值>`（例如 `openssl rand -base64 32` 的输出，44 个字符），否则 `pnpm dev` 启动时会报错。助手不改 `.env`；普通测试在 `test/setup-env.ts` 中固定了一个虚构值（用户已提交为 `1c7cf6e`）。
- 测试（助手先写，用户已提交为 `829c6be`）：
  - `apps/api/test/session-config.spec.ts` 10 条：Cookie 名称与属性完全一致、挂载路径只有 `/api/v1/auth`；恰好 32 个字符和 `openssl rand -base64 32` 形式的值原样返回；缺少、`null`、非字符串、空串、只有空白时报 required；31 个字符时报长度不足且不带出该值。
  - `apps/api/test/session-mount.spec.ts` 8 条，用真实 `AppModule` + `configureApp` + `configureSession`，`ensureConnected` 一律失败：安装过程不连库；带有效签名 Cookie 的 health 仍为 200、无 Set-Cookie、没有查会话；带 Cookie 的 ready 仍为 503 且只有就绪检查连库一次；`/api/v1/auth` 下匿名请求 404、无 Set-Cookie、不查库；用别的密钥签名的 Cookie 被当作没有会话；有效签名的 Cookie 会去查会话，失败时返回 5xx 且响应不含内部错误信息（映射成 503 留到错误映射步骤）；缺少或过短的密钥时 `configureSession` 报错且不安装中间件。
  - `apps/api/test/integration/main-session.db.spec.ts` 5 条，启动真实的 `dist/main.js`：`SESSION_SECRET` 为空时进程以非 0 退出、输出含「SESSION_SECRET is required」且不含连接串；有密钥时启动，带 Cookie 请求 health 为 200、库里的会话行不变；在 sessions 表写入一行后，带签名 Cookie 请求 `/api/v1/auth/fixture-probe` 得到 404、无 Set-Cookie，且该行 `last_seen_at`、`idle_expires_at` 被续期、`absolute_expires_at` 不变；匿名请求和伪造签名都不写库；输出不含密钥和连接串，SIGTERM 后 `ledger_it` 上没有该进程留下的连接。
- 测试自身的核对：在 `/tmp` 下建了一个临时 git worktree（共用依赖，不碰工作区），放入参考实现后运行：`session-config` 10 条、`session-mount` 8 条、原有 health/readiness/startup 4 条通过，`main-session` 5 条与 `session-store` 2 条通过且无残留进程和连接。再把参考实现改成挂在所有路径上，`session-mount` 中 health 与 ready 两条失败。worktree 已删除。
- 实现前运行（工作区）：`session-config` 10 条因 `session-config.ts` 不存在、`session-mount` 8 条因 `configureSession` 未导出而失败，其余 133 条通过；`test:db` 中 `main-session` 有 2 条失败（无密钥时进程照常启动、20 秒后被测试终止；会话没有被续期），另外 3 条在当前代码下本来就成立（作为回归保护），其余 67 条通过；无残留进程和连接；`pnpm typecheck` 通过。未修改业务代码。
- 验收：上述三个测试文件与完整 `test:db` 通过；`pnpm check` 退出码 0；`pnpm contracts` 无需 `SESSION_SECRET` 且生成契约无差异。已通过，证据见下。

M1-S21 验收证据（2026-10-19）：
- 实现：用户手写 `apps/api/src/modules/auth/session-config.ts`、`configure-app.ts` 的 `configureSession`、`main.ts` 的调用和 `AppModule` 对 `AuthModule` 的导入，并在 `.env.example` 加了 `SESSION_SECRET` 占位行（已自行提交为 `f98b161`、`1509814`、`62c0793`，提交内容与下面验收时的工作区一致）。评审中发现三处问题，用户已改正：`main.ts` 用 `configureSession` 替换了 `configureApp`，全局前缀因此丢失；`readSessionSecret` 的参数写成了 `string`，`pnpm typecheck` 报 `TS2345`；错误信息写成 `Session secret ...` 而不是变量名，导致单元测试 8 条、`main-session` 1 条失败。
- `pnpm --filter @ledger/api exec vitest run test/session-config.spec.ts test/session-mount.spec.ts`：2 个文件、18 条通过。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：10 个文件、72 条通过，其中 `main-session.db.spec.ts` 5 条：无密钥时进程以非 0 退出并提示 `SESSION_SECRET is required`；带 Cookie 的 health 为 200 且不碰会话；有效签名的 Cookie 续期了会话；匿名请求和伪造签名不写库；输出不含密钥和连接串。运行后 `ledger_it` 上连接数为 0。
- `pnpm check`：退出码 0；API 21 个文件、151 条，Web 1 个文件、2 条，build 完成。
- `env -u SESSION_SECRET pnpm contracts`：退出码 0，输出中没有 `SESSION_SECRET`；两份生成契约无 Git 差异。
- 改动的 4 个 TypeScript 文件通过 Prettier。
- 本机 `.env` 补上 `SESSION_SECRET` 后的启动核对（2026-10-19 20:5x）：只核对键名、长度和格式，不读出值。`.env` 中该值为 44 个字符、Base64 形式，没有首尾空白，能通过 `readSessionSecret`。在 `apps/api` 下用临时端口启动 `dist/main.js`，只读取 `.env`，终端没有导出这两个变量：`GET /api/v1/health` 返回 200 `{"status":"ok"}`；匿名请求 `/api/v1/auth/fixture-probe` 返回 404，没有 `Set-Cookie`；收到 SIGTERM 后进程退出；输出中不含密钥和连接串。没有请求 ready，避免连接开发库。用户曾把密钥误填进 `.env.example`，后来移到 `.env`；逐个检查 `.env.example` 的全部历史提交，`SESSION_SECRET` 都是占位值，密钥没有进入 Git。
- 没有验证到：`pnpm dev`（SWC 监听模式）本身没有启动过，上面启动的是构建产物；数据库不可用时会话查询返回的是 5xx，映射成 503 留到 M1-T08；还没有接口往会话里写东西，登录时下发的 `Set-Cookie` 留到登录接口那一步。
- 用户暂未采纳的建议（不影响验收）：`MIN_SECRET_LENGTH` 仍为导出；`configure-app.ts` 用相对路径导入，没有用 `@/` 别名。
- `.env.example`（用户同意后由助手修改）：原占位值 `<openssl rand -base64 32 的输出>` 只有 29 个字符，照抄会报「至少 32 个字符」，误导人以为生成的密钥太短。改为 `SESSION_SECRET=` 留空，上方加一行英文注释说明长度与生成命令，文件末尾补换行；漏配时报 `SESSION_SECRET is required`。没有代码读取 `.env.example`。根 README 的说明同步修改。
- 环境问题（已修复）：仓库根和 `apps/api` 下 `node_modules/.bin` 的 11 个命令脚本仍指向 S21 测试准备时用过、现已删除的临时目录 `/tmp/ledger-s21-scratch`（修改时间 2026-10-15 21:02）。其中 `prettier` 无法运行，其余 10 个只是 `NODE_PATH` 指向不存在的目录，实际仍可用（本步的 vitest、tsc、nest 均正常）。验收时改用 `node node_modules/prettier/bin/prettier.cjs` 检查格式。用户同意后，确认没有 dev 进程，执行 `rm -rf node_modules apps/api/node_modules apps/web/node_modules && pnpm install --frozen-lockfile`：520 个包全部从本地 store 复用，没有下载；`pnpm-lock.yaml` 的 SHA-256 前后一致；`.bin` 中不再有指向临时目录的脚本，`pnpm exec prettier --version` 输出 3.9.10。

### M1-S22 详情

- 来源：PRD M1-R03「错误用户名和错误密码均返回相同 401 文案，不泄露账号存在性」、§5「密码原样验证，不 trim」、技术方案 §6「用户名不存在也做等价的哈希验证路径以减少明显差异」。这是 M1-T06（登录）的第一小步：先把「这组用户名和密码对不对」做成一个不碰 HTTP 的服务方法；接口、输入 Schema、Session ID 轮换和保存留到后续步骤。
- 计划：新建 `apps/api/src/modules/auth/auth.service.ts`，`AuthService.verifyCredentials(username: string, password: string): Promise<PublicUser | null>`。
  - 先 `normalizeUsername(username)`，合法时用 `findCredentialsByUsername` 查凭据，再用 `verifyPassword` 比对；通过时返回 `{ id, username }` 普通对象，不带 `passwordHash`。
  - 用户名格式不合法、用户不存在、密码错误，三种情况都返回 `null`，调用方无从区分。
  - 每次调用恰好校验一次哈希：用户名不合法或用户不存在时，用一份「假哈希」调用 `verifyPassword` 并丢弃结果。否则「用户不存在」的请求会比「密码错误」少花约 9ms（S15 测得的单次校验耗时），别人可以凭响应快慢猜出哪些用户名存在。查库命中与未命中仍有差异，所以这只是缩小时间差，不是恒定时间。
  - 假哈希在第一次需要时用 `hashPassword(随机 32 字节)` 生成，参数与真实哈希相同，缓存这个 Promise（与 `ensureConnected` 同理：并发的首次调用只生成一次）。不写死在代码里，也不在启动时计算。
  - 密码原样传给 `verifyPassword`，不 trim。长度 12～128 的检查放在以后的输入 Schema（返回 400），本方法不重复。
  - 数据库错误原样抛出，不能当成凭据错误返回 `null`。否则数据库一断，用户看到的是「用户名或密码错误」，违反 PRD「503 显示服务不可用，不误报密码错误」；映射成 503 留到 M1-T08。
  - `AuthModule` 导入 `UsersModule`，提供 `AuthService`。
- 待用户确认：上面三点设计，即用户名不合法时也校验一次哈希、假哈希按需生成并缓存、密码长度留给 Schema。
- 测试（确认后由助手先写）：
  - 离线 `apps/api/test/auth.service.spec.ts`，用假 `UsersRepository`，`password-hasher` 用 `vi.mock` 包一层（保留真实实现，只记录调用）：正确凭据返回 `toStrictEqual({ id, username })`；`'  Demo_A '` 按 `demo_a` 查询；错误密码、首尾多空格、大小写不同返回 `null`；用户不存在返回 `null`，`verifyPassword` 恰好调用一次且用的是 `$argon2id$` 哈希；用户名不合法时不查库、仍校验一次；并发的首次「用户不存在」调用只生成一次假哈希；仓储抛错时原样抛出。
  - 真实库 `apps/api/test/integration/auth-service.db.spec.ts`：用真实的 `AuthModule` 组装，在 `ledger_it` 写入一个虚构用户后，正确密码返回该用户，错误密码和不存在的用户名返回 `null`。
  - 另外测量「用户存在但密码错误」和「用户不存在」两种调用的耗时中位数，作为证据记录，不写成断言（耗时断言在不同机器上不稳定）。
- 注意事项：不写 Controller、Schema、regenerate、Cookie，不做限流和 Origin 检查（M1-T08）。
- 验收：离线测试与 `test:db` 通过；`pnpm check` 退出码 0。

M1-S22 测试准备记录（2026-10-19）：
- 用户回复「开始 S22」，同意上面三点设计。
- 待实现（用户手写）：
  - `apps/api/src/modules/auth/auth.service.ts`：命名导出 `@Injectable()` 的 `AuthService`，构造参数注入 `UsersRepository`；`verifyCredentials(username: string, password: string): Promise<PublicUser | null>`。假哈希的 Promise 存在实例的私有字段里，不放在模块顶层变量：这样每个 Nest 容器各有一份，测试之间互不影响。
  - `auth.module.ts`：`imports` 改为 `[DatabaseModule, UsersModule]`，`providers` 加 `AuthService`。本步不必导出 `AuthService`，登录 Controller 写在同一个模块里。
- 离线 `apps/api/test/auth.service.spec.ts` 16 条。`password-hasher.js` 用 `vi.mock` 包一层，保留真实的 Argon2id 实现，只记录调用。服务由 Nest 测试容器创建，`UsersRepository` 换成内存假仓储；最后一条用真实的 `DatabaseModule` 和 `AuthModule` 组装。覆盖内容：
  - 正确凭据时 `toStrictEqual({ id, username })`，多出 `passwordHash` 也算失败，且不生成假哈希。
  - `'  Demo_A '` 按 `demo_a` 查询。
  - 错误密码、首尾多空格、大小写不同、空密码都返回 `null`，`verifyPassword` 收到的是原样的密码。
  - 用户不存在时恰好校验一次，用的是 `$argon2id$v=19$m=19456,t=2,p=1$` 形式的假哈希。
  - 4 种不合法用户名都不查库，仍然校验一次。
  - 用户不存在、用户名不合法两种情况下，都要等假哈希校验完成才返回。
  - 创建服务时不生成假哈希；5 个并发的首次调用加 1 个后续调用，只生成一次，6 次校验用的是同一个假哈希。
  - 仓储抛错时原样抛出。
  - 经真实 `AuthModule` 组装时，`ensureConnected` 失败会原样抛出，且不调用 `initialize`、不发 SQL。
- 真实库 `apps/api/test/integration/auth-service.db.spec.ts` 5 条：在 `ledger_it` 写入一个虚构用户（真实 Argon2id 哈希），用真实 `AuthModule` 组装。原写法和 `'  Fixture_Carol '` 加正确密码都返回该用户；错误密码、不存在的用户名、不合法的用户名都返回 `null`。
- 测试自身的核对：在 `apps/api/test/` 下临时放一份参考实现，把两个测试文件复制一份指向它。
  - 正确实现：离线 16 条、真实库 5 条通过；离线连跑 10 次均通过。
  - 8 种错误写法在离线测试中全部被发现：不校验假哈希（8 条失败）、不等假哈希校验完成就返回（8 条）、只缓存结果而不缓存 Promise（并发时生成多次，1 条）、创建服务时就生成假哈希（6 条）、trim 密码（1 条）、返回值带出 `passwordHash`（2 条）、不规范化用户名（5 条）、把数据库错误当成 `null`（2 条）。
  - 真实库测试另外发现了带出 `passwordHash`（2 条）和不规范化（1 条）两种写法。
  - 临时文件已全部删除。
- 实现前运行：
  - 离线 16 条全部因 `auth.service.ts` 不存在（Cannot find module）而失败。完整 API 测试 22 个文件，原有 151 条通过。
  - `test:db` 11 个文件：新文件准备阶段因同一原因失败，5 条跳过；原有 67 条通过；运行后 `ledger_it` 上没有残留连接。
  - `pnpm typecheck` 退出码 0；两个测试文件通过 Prettier（`--write` 只调整了一处换行）；生成契约无差异。
- 未修改业务代码。耗时中位数的测量放在用户实现之后。

M1-S22 实现进度（2026-10-20）：
- 用户手写 `auth.service.ts` 并注册到 `auth.module.ts`（已自行提交为 `57b98cf`、`906554f`）。
- `pnpm --filter @ledger/api exec vitest run test/auth.service.spec.ts`：16 条中 15 条通过（`verifyCredentials` 的行为全部通过）；失败的 1 条是经真实 `AuthModule` 组装，报 `Nest can't resolve dependencies of the AuthService (?) ... UsersRepository at index [0]`。原因是 `auth.module.ts` 的 `imports` 只有 `DatabaseModule`，缺 `UsersModule`。
- 由于 `AppModule` 导入了 `AuthModule`，同一个错误让整个应用无法创建：完整 API 测试 22 个文件中 8 个失败、共 17 条（health、ready、启动、关闭、会话挂载、SessionsRepository、contracts 和上面那条）。`pnpm contracts` 退出码 1 且没有错误输出（`generate-openapi.ts` 设了 `logger: false`）；另用 `abortOnError: false` 创建 `AppModule`，确认是同一条依赖错误。`pnpm typecheck` 通过（这是运行时的依赖注入错误，类型检查发现不了）。
- 未运行 `test:db`：`main-session.db.spec.ts` 启动的 `dist/main.js` 会因同一原因失败，修正后一起验收。未修改业务代码。

M1-S22 验收证据（2026-10-20）：
- 实现：用户手写 `apps/api/src/modules/auth/auth.service.ts`（`57b98cf`），在 `auth.module.ts` 中注册 `AuthService`，并按上面的报告把 `UsersModule` 加进 `imports`；`exports` 恢复为只有 `SessionsRepository`（登录 Controller 会写在同一个模块里，不需要导出）。
- `pnpm --filter @ledger/api exec vitest run test/auth.service.spec.ts`：16 条通过。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：11 个文件、77 条通过，其中 `auth-service.db.spec.ts` 5 条；`main-session.db.spec.ts` 5 条恢复通过。运行后 `ledger_it` 上连接数为 0。
- `pnpm check`：退出码 0；API 22 个文件、167 条，Web 1 个文件、2 条，build 完成；生成契约无 Git 差异。两个文件通过 Prettier。
- 耗时（Apple M4，`ledger_it`，用构建产物和真实 `AuthModule` 组装；临时脚本，已删除；写入的虚构用户已删除）。先预热连接和假哈希，再把四种调用交替各执行 60 次，取中位数，运行两次：

  | 情况 | 第一次 | 第二次 |
  |---|---|---|
  | 用户存在、密码错误 | 9.27ms | 9.16ms |
  | 用户不存在 | 9.25ms | 9.24ms |
  | 用户名格式不合法（不查库） | 8.19ms | 8.25ms |
  | 密码正确（参考） | 9.22ms | 9.32ms |

  「用户存在但密码错误」和「用户不存在」的差别不到 0.1ms，远小于单次的波动（最小约 8ms、最大 11～22ms），无法凭耗时区分账号是否存在。格式不合法的用户名快约 1ms，因为它不查库；格式规则是公开的，这个差异不泄露账号是否存在。
- 没有验证到：还没有 HTTP 接口调用它；数据库错误映射成 503 留到 M1-T08。

### M1-S23 详情

- 来源：M1 PRD §4「username/password 的规则……实施时要写入 Schema 与测试」，接口表「login：400 参数非法」；技术方案 §9「Zod Standard Schema 与当前 Nest/Swagger 锁定版本的集成先做小测试再接入，不能只写类型断言就声称运行时校验」；steering「输入校验用 Zod Standard Schema，不另选校验库」。这是 M1-T06（登录）的第二小步：登录接口收到的请求体要先检查格式，不合格直接 400，不去查库、不算哈希。
- 计划：接入 Zod，定义登录请求体的 Schema，并证明它在当前锁定的 Nest 和 Swagger 版本上同时做到两件事：运行时真的拦住不合格的请求，以及生成的 OpenAPI 里能看到这些规则。本步不写登录 Controller。
- 已核对的事实（看过本机安装的源码，还没有实际运行）：
  - Nest `@nestjs/common@12.1.2` 自带 `StandardSchemaValidationPipe`，配合 `@Body({ schema })` 使用。Pipe 是 Nest 在调用 Controller 方法之前处理参数的一层。它只检查声明了 `schema` 的参数，没有声明的原样放行；校验失败抛 400，信息形如 `password: <Zod 的提示>`；默认把 Schema 解析后的值交给 Controller。
  - `@nestjs/swagger@12.0.2` 通过 Schema 上的 `~standard.jsonSchema` 把它转成 OpenAPI。Zod 是否提供这个接口，要装上之后实测。
  - npm 上 `zod` 的最新版本为 `4.6.7`（2026-10-12 发布）。
- 设计（待用户确认）：
  - 依赖：`pnpm --filter @ledger/api add zod@4.6.7 --save-exact`，由助手安装并记录锁文件的变化。如果被 pnpm 的发布时长限制挡住，另行确认是否加例外。
  - `apps/api/src/modules/auth/schemas.ts` 导出 `LoginBodySchema`：
    - `username`：字符串，规则与 `normalizeUsername` 相同（去掉首尾空白后为 3～32 个 `A-Za-z0-9_`），不合格返回 400。通过后仍交给 `verifyCredentials` 规范化，所以 Schema 不必输出规范化后的值。
    - `password`：字符串，长度 12～128，按 Unicode 码点计数（见下方决定，原计划的「按 `.length` 计数」已放弃）；原样保留，不 trim。
    - 多余的字段（例如 `userId`）丢弃，不报错。Controller 只拿得到这两个字段，客户端无法借请求体冒充别人。
    - 用户名规则怎样写才能只维护一处、又能出现在 OpenAPI 里，装好 Zod 后由助手实测几种写法，再定具体写法。
  - Pipe 全局注册：在 `configureApp` 里加 `app.useGlobalPipes(new StandardSchemaValidationPipe())`。全局注册的好处是以后每个接口只要写 `@Body({ schema })` 就会生效。如果改成逐个参数挂 Pipe，漏挂一次，Schema 就只是摆设：类型检查照常通过，运行时却什么都不检查。没有声明 Schema 的现有接口不受影响。
- 动作：
  1. 用户确认上述设计后，助手安装 Zod，实测 Pipe、OpenAPI 转换和用户名规则的写法，把结论补进本节。
  2. 助手先写测试：在测试文件里放一个只用于测试的 Controller，用 `@Body({ schema: LoginBodySchema })` 接收，应用经 `configureApp` 配置。覆盖：合法请求通过且密码原样到达（含首尾空格）；缺字段、类型不对、用户名不合法、密码 11 个和 129 个字符都返回 400，且不调用 Controller；400 的响应里不带密码原文；多余字段被丢弃；health 仍为 200。另外用这个 Controller 生成 OpenAPI，检查请求体里有两个字段及长度限制。运行并确认因 `schemas.ts` 不存在而失败。
  3. 用户手写 `schemas.ts`、`configureApp` 中的一行注册，以及下方决定带来的两处改动（`username.ts` 导出正则、`demo-users.ts` 改用 `PasswordSchema`）。
  4. 助手运行测试和 `pnpm check`，记录证据。
- 注意事项：400 的响应体暂时是 Nest 默认的形状（`message` 数组、`error`、`statusCode`）；按技术方案统一成 `error.code/message/requestId/fields`，留到 M1-T08 的错误映射步骤。本步没有真实接口使用这个 Schema，所以 `docs/openapi.json` 不会变化。不写 Controller、regenerate、限流或 Origin 检查。
- 验收：新增测试通过；`pnpm check` 退出码 0；生成契约无差异。

M1-S23 依赖与实测记录（2026-10-20）：
- 用户回复「开始 S23」，同意上面的设计。
- 依赖：`pnpm --filter @ledger/api add zod@4.6.7 --save-exact`。`apps/api/package.json` 的 `dependencies` 新增 `"zod": "4.6.7"`；`pnpm-lock.yaml` 新增 8 行（importer 条目和该包本身）。zod 没有依赖、没有安装脚本，实际下载 1 个包；供应链检查通过，没有被发布时长限制挡住，没有修改 `pnpm-workspace.yaml`。peer 依赖警告仍只有原有的 `@nestjs/swagger` 与 TypeScript 7。
- 实测方式：在 `apps/api/test/` 下临时放一个 spec，内含测试用 Controller，用 supertest 发请求，再用 `SwaggerModule.createDocument` 生成文档。文件已删除，没有改业务代码。
- Nest Pipe（全局注册 `new StandardSchemaValidationPipe()`，`@Body({ schema })`）：
  - 不合格返回 400，响应体为 Nest 默认形状 `{ message: [...], error: 'Bad Request', statusCode: 400 }`。`message` 每项是「字段: Zod 提示」，例如 `password: Too small: expected string to have >=12 characters`，不含提交的值。
  - 没有请求体、`text/plain` 请求体都返回 400（`expected object, received undefined`），JSON 数组也返回 400。
  - 通过时 Controller 收到的是 Schema 解析后的值：多余字段（`userId`）被丢弃，密码首尾空格原样保留。
  - 没有写 `schema` 的 `@Body()` 原样放行，不受影响。
  - 不注册全局 Pipe 时，`@Body({ schema })` 完全不生效：不合格的请求返回 200，`userId` 和 `null` 请求体都直接传给 Controller。这证实了必须全局注册。
- Swagger：Zod 4.6.7 的 Schema 带 `~standard.jsonSchema`。Swagger 12.0.2 把它内联成该接口的 `requestBody`（`application/json`，必填），不生成 `components`。
- 用户名规则，比较了 4 种写法，用 7 个容易出错的输入（首尾空格、制表符和换行、不换行空格、BOM、U+2028、开尔文符号、零宽空格）和 `normalizeUsername` 对照：
  - A `z.string().trim().regex(/^[A-Za-z0-9_]{3,32}$/)`：7 个结果全部一致；OpenAPI 显示 `pattern`。
  - B `z.string().refine((v) => normalizeUsername(v) !== null)`：结果一致，但 OpenAPI 只有 `type: string`，规则不可见。
  - C `trim().min(3).max(32).regex(/^[A-Za-z0-9_]+$/)`：结果一致，OpenAPI 有长度和 `pattern`，但规则拆成三处，和 `normalizeUsername` 不再共用同一个正则。
  - D 在正则两端写 `\s*` 而不 trim：输出保留空白，OpenAPI 的 `pattern` 难读。
  - 建议 A，并让 `username.ts` 导出这个正则、`normalizeUsername` 也改用它，规则只写一处。`.trim()` 让 Controller 收到去掉空白的用户名，`verifyCredentials` 再规范化一次也没有影响。OpenAPI 里的 `pattern` 描述的是去掉空白之后的值，比服务端实际接受的更严格，客户端按它检查不会误放行。
- 发现的问题：密码长度的计数单位。Zod 4.6.7 的 `min`/`max` 按 Unicode 码点计数（`zod/v4/core/checks.js` 中用 `codePointLength`，emoji 算 1 个），而 seed 的 `readDemoAccounts` 用 `.length`（UTF-16 单元，emoji 算 2 个）。实测 6 个 emoji 组成的密码在 Zod 下是 6 个字符，被拒绝；seed 按 12 个字符接受。用这种密码 seed 出来的账号，登录永远返回 400。OpenAPI 的 `minLength`/`maxLength` 按 JSON Schema 规范也按码点计。原计划写的「按 `.length` 计数，与 seed 一致」用 Zod 内置的 `min`/`max` 做不到。待用户二选一：
  - 方案 1（建议）：统一按码点。`schemas.ts` 单独导出密码 Schema（`z.string().min(12).max(128)`），seed 改用它检查；Zod、OpenAPI、seed 三处一致。要改 `demo-users.ts`（业务代码，用户手写），助手在 `demo-users.spec.ts` 补 emoji 用例。现有 ASCII 用例不受影响。
  - 方案 2：Zod 改用 `refine` 按 `.length` 检查，seed 不改；代价是 OpenAPI 里的密码没有长度限制。

M1-S23 决定与测试准备记录（2026-10-20）：
- 用户把密码计数方式交给助手按业界做法决定。决定采用方案 1：按 Unicode 码点计数。依据如下：
  - NIST SP 800-63B-4（2025 年 8 月版，美国政府数字身份指南，业界密码规则最常引用的标准）的密码要求，原文为「Each Unicode code point SHALL be counted as a single character when evaluating password length」。助手于 2026-10-20 从 `pages.nist.gov/800-63-4/sp800-63b.html` 核对过原文。
  - Zod（`min`/`max`）和 OpenAPI/JSON Schema（`minLength`/`maxLength`）本来就按码点计数。选方案 1，登录检查、契约和 seed 三处一致，规则只写在 `PasswordSchema` 一处；选方案 2，要另写一套计数逻辑，契约里也看不到长度限制。
  - 对 ASCII 和中文密码，两种计数结果相同，只有 emoji 等 BMP 之外的字符不同，所以现有账号和测试不受影响。
- 同一节 NIST 里还有两条与本项目 PRD 不同，本步不采纳，只记录：
  - 单因素密码 SHALL 至少 15 个字符。PRD 定的是 12。
  - 接受 Unicode 时 SHOULD 先做 NFC 规范化再哈希。PRD 规定密码「原样验证」，做规范化要连 seed 和已有哈希一起改。
  - 两条都要先改 PRD，再单独开一步。
- 待用户实现（用户手写）：
  - `apps/api/src/modules/users/username.ts`：把 `USERNAME_PATTERN` 改为命名导出，不加 `g`/`y` 标志。`normalizeUsername` 继续使用它。
  - 新建 `apps/api/src/modules/auth/schemas.ts`：
    - `PasswordSchema = z.string().min(12).max(128)`。
    - `LoginBodySchema = z.object({ username: z.string().trim().regex(USERNAME_PATTERN), password: PasswordSchema })`。
    - 正则从 `username.ts` 导入，不要复制一份。用 `z.object`，不用 `strictObject`（多余字段会报 400）或 `looseObject`（多余字段会保留）。
  - `apps/api/src/configure-app.ts` 的 `configureApp`：加 `app.useGlobalPipes(new StandardSchemaValidationPipe())`（从 `@nestjs/common` 导入）。
  - `apps/api/src/scripts/demo-users.ts` 的 `readDemoAccounts`：改用 `PasswordSchema.safeParse(environment[variable])` 检查，返回 `result.data`。错误信息不变。只判断 `.success`、却仍返回原来的变量，类型检查会报 `TS2322`：TypeScript 不知道它已经不是 `undefined`。
- 新增 `apps/api/test/auth-schemas.spec.ts`，65 条，不经过 HTTP：
  - `USERNAME_PATTERN` 从 `username.ts` 导出，`source` 为 `^[A-Za-z0-9_]{3,32}$`，没有标志。
  - 28 个用户名（含各种 Unicode 空白、BOM、全角字母、零宽空格、开尔文符号），`LoginBodySchema` 的判断与 `normalizeUsername` 逐一相同。通过时输出只去掉首尾空白、不转小写。
  - 缺字段、类型不对、请求体不是对象时都拒绝。
  - 多余字段（`userId`、`isAdmin`）被丢弃。
  - 密码原样保留，包括首尾空格。
  - `PasswordSchema` 接受 12/128 个 ASCII、12 个汉字、12 个空格、12/65/128 个 emoji；拒绝空串、11/129 个 ASCII、6/11/129 个 emoji 和非字符串。
  - 7 种长度下，登录请求体的密码规则与 `PasswordSchema` 相同。
- 新增 `apps/api/test/login-body-validation.spec.ts`，22 条。用真实 `AppModule` 加一个只在测试里存在的 Controller，经 `configureApp` 配置，数据库一律不可用：
  - 合法请求为 200。Controller 收到的用户名已去掉首尾空白，`userId` 被丢弃，密码原样。整个过程不连库。
  - 5 种合法密码为 200：ASCII 12/128 个、emoji 12/128 个、中文。
  - 10 种不合格请求体返回 400，不调用 Controller、不连库，报错提到对应字段，且不包含提交的用户名或密码原文。
  - 没有请求体、`text/plain`、JSON 数组、JSON 字符串都返回 400。
  - 装上全局 Pipe 后，health 仍为 200。
  - 生成的 OpenAPI 中，`requestBody` 与预期完全一致：两个必填字段、共享正则的 `pattern`、密码 `minLength: 12`/`maxLength: 128`。
- `apps/api/test/demo-users.spec.ts` 新增 6 条，共 16 条：
  - 12/65/128 个 emoji 被接受。
  - 6 个 emoji、129 个 emoji 被拒，且报错不带密码。
  - 13 个密码逐一核对：seed 接受的正好是 `PasswordSchema` 接受的。
- 测试自身的核对：
  - 在 `/tmp` 下建了临时 git worktree，共用依赖，不碰工作区，放入上面的参考实现。
  - 正确写法：3 个新测试文件加 username、health、readiness，共 6 个文件、131 条通过。全部 API 测试（除 contracts）23 个文件、259 条通过。`tsc` 通过。`generate-openapi` 后 `docs/` 无差异。
  - 15 种错误写法全部被发现（括号内为失败条数）：
    - Pipe：不注册全局 Pipe（14）、`transform: false`（1）。
    - 用户名：用 `refine` 调 `normalizeUsername`（9）、不 trim（8）、在 Schema 里转小写（6）、复制一份正则而不是导入（1）、共享正则带 `g` 标志（18）、`username.ts` 不导出正则（2）。
    - 密码：trim 密码（3）、按 `.length` 计数（10）、上限写成 64（9）、登录用的密码规则与 `PasswordSchema` 不同（3）、seed 仍用 `.length`（4）。
    - 对象：`strictObject`（3）、`looseObject`（3）。
  - worktree 和临时脚本已删除，`node_modules/.bin` 中没有指向临时目录的脚本。
- 实现前运行（工作区）：
  - `auth-schemas` 65 条全部失败：64 条因 `schemas.ts` 不存在，1 条因 `USERNAME_PATTERN` 未导出（`expected undefined to be an instance of RegExp`）。
  - `login-body-validation` 22 条全部因 `schemas.ts` 不存在而失败。
  - `demo-users` 16 条中 4 条失败：65/128 个 emoji 被拒；6 个 emoji 被接受；一致性测试找不到 `schemas.ts`。原有 10 条和新增的 2 条（12 个 emoji 接受、129 个 emoji 拒绝，`.length` 恰好也得出同样结果）通过。
  - 完整 API 测试 24 个文件、260 条：91 条失败，都来自上述原因；其余 169 条通过。
  - `pnpm typecheck` 通过。三个测试文件通过 Prettier（`--write` 只调整了换行）。生成契约无差异。
- 另外发现（同日已按用户要求修复，见下方「格式错误 JSON 的修复」）：格式错误的 JSON 由 Express 的 body-parser 在 Pipe 之前拒绝，返回 400，消息是 `JSON.parse` 的原文。其中会带出请求体的前若干个字符，例如 `"password=f"...`、`..."assword":fixture-sec"...`。实测 4 种写法都没有带出完整密码，但已经能看到一部分。
- 未修改业务代码。

M1-S23 格式错误 JSON 的修复（2026-10-20）：
- 用户要求本步就修复，不再留到 M1-T08。按用户要求，这部分业务代码由助手编写；`schemas.ts` 等 S23 原有内容仍由用户实现。
- 原因（看过源码）：
  - body-parser `2.3.0` 解析失败时，抛出的 `SyntaxError` 带 `type: 'entity.parse.failed'`，`body` 属性里存着完整请求体。
  - Nest 的 Express 适配器 `mapException` 把所有 `SyntaxError` 换成 `new BadRequestException(error.message)`，于是 `JSON.parse` 的原文进了响应。
  - 实测请求体是一个裸词时，整段原样带出：`Unexpected token 'f', "fixture-secret-value" is not valid JSON`。如果这个裸词就是密码，密码会原样出现在响应里。
- 修复：
  - 新增 `apps/api/src/common/middleware/reject-malformed-json.ts`，是一个 Express 错误处理中间件，4 个参数。遇到 `entity.parse.failed` 时，交给下游一个固定文案的 `BadRequestException('Request body must be valid JSON')`。不挂 `cause`，以后的错误日志也碰不到原请求体。其他 body-parser 错误原样往下传，例如 413 请求体过大、415 编码不支持，它们的信息不含请求体。
  - `configureApp` 先 `app.useBodyParser('json')`，紧接着 `app.use(rejectMalformedJson)`。Express 的错误处理只接得住排在它前面的中间件，而 Nest 默认的解析器在 `init` 时才注册，排在 `configureApp` 里所有 `app.use` 之后，所以必须自己先注册解析器。Nest 在 `init` 时检测到已有名为 `jsonParser` 的中间件，就不再注册默认的那一个；解析选项与默认相同，`limit` 仍为 100kb，空请求体仍当作 `{}`。
  - `useBodyParser` 只有 Express 版的应用才有，所以 `configureApp`/`configureSession` 的参数类型从 `INestApplication` 改为 `NestExpressApplication`。`main.ts`、`generate-openapi.ts` 改成 `NestFactory.create<NestExpressApplication>(...)`；4 个测试文件（health、readiness、session-mount、login-body-validation）中 `createNestApplication` 加上同样的类型参数。只改了类型，运行行为不变。
  - 副作用：JSON 解析现在排在会话中间件之前。格式错误的请求即使带着有效的会话 Cookie，也会直接返回 400，不再先查会话、不连库。
- 测试 `apps/api/test/json-body-parsing.spec.ts`，13 条，用真实 `AppModule` 和 `configureApp`，数据库不可用：
  - 7 种格式错误的 JSON 都返回完全相同的 `{ statusCode: 400, error: 'Bad Request', message: 'Request body must be valid JSON' }`：表单格式、裸词、未加引号的值、尾逗号、单引号、截断、长前缀后的错误。都不调用 Controller、不连库，响应和日志里不出现请求体的任何片段。
  - 合法 JSON 照常解析；空请求体仍当作 `{}`。
  - 110KB 的请求体仍为 413 `request entity too large`；不支持的 charset 仍为 415。
  - Express 中只有一个 `jsonParser`。
  - 按 `main.ts` 的顺序装上会话中间件后，带有效签名 Cookie 的格式错误请求返回 400，且不查会话。
- 修复前运行：8 条失败，其中 7 条响应里是 `JSON.parse` 原文，会话路径那条返回 500；其余 5 条通过，作为回归保护。修复后 13 条通过。
- 测试的区分力（临时 worktree，已删除）：去掉错误中间件、把它放到解析器之前、不自己注册解析器、保留原消息，这 4 种写法各有 8 条失败；把所有 body-parser 错误都换成固定 400 时，有 2 条（413/415）失败。
- 其他验证：
  - `pnpm typecheck` 通过。
  - 不可达数据库地址下 `pnpm contracts` 退出码 0，生成契约无差异。
  - `test:db` 11 个文件、77 条通过，包括启动 `dist/main.js` 的 `main-session`；运行后 `ledger_it` 上连接数为 0。
  - 构建产物端到端：先确认 `127.0.0.1:1` 返回 `ECONNREFUSED`，再用它作数据库地址、用虚构的会话密钥启动 `dist/main.js`。两种格式错误的请求都得到上述固定 400，合法 JSON 发到不存在的路径为 404，health 为 200，进程输出中没有请求体内容。
  - 改动的文件都通过 Prettier。
- 完整 API 测试 25 个文件、273 条：183 条通过；90 条失败，都来自下面 S23 实现的 3 处问题。

M1-S23 实现进度（2026-10-20）：用户已提交 `username.ts` 导出正则（`4234b12`）、`schemas.ts`（`9ab4c1b`）、全局 Pipe（`6f03bc5`）。与测试对照，还差 3 处：
- `schemas.ts` 的导出名写成了 `PasswordScheme`、`LoginBodyScheme`，应为 `PasswordSchema`、`LoginBodySchema`。`auth-schemas`、`login-body-validation` 的 86 条都因找不到导出而失败（`expected undefined to be 'zod'`）。
- `PasswordScheme` 的下限写成了 `min(8)`，PRD 定的是 12。改了名字之后，长度为 8～11 的用例会失败。
- `demo-users.ts` 的 `readDemoAccounts` 仍按 `.length` 检查，没有改用 `PasswordSchema`，`demo-users` 有 4 条失败。

M1-S23 验收证据（2026-10-20）：
- 实现：用户自己改正了 `schemas.ts` 的两个导出名和密码下限（`min(12)`）。`readDemoAccounts` 第一版调用了 `PasswordSchema.safeParse(...)`，但没有使用返回结果，返回值里还引用了已经删除的 `password` 变量。按用户要求，助手改为：保存 `safeParse` 的结果，失败时抛出原来的错误信息，成功时返回 `result.data`，并补了注释。格式错误 JSON 的修复见上一节，由助手编写。
- `pnpm --filter @ledger/api exec vitest run test/demo-users.spec.ts test/auth-schemas.spec.ts test/login-body-validation.spec.ts test/json-body-parsing.spec.ts test/username.spec.ts`：5 个文件、141 条通过。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：11 个文件、77 条通过，其中 `seed-demo-users.db.spec.ts` 4 条（seed 已改用 `PasswordSchema`）。运行前后 `ledger_it` 上连接数均为 0。
- `pnpm check`：退出码 0；API 25 个文件、273 条，Web 1 个文件、2 条，build 完成。生成契约无 Git 差异：本步没有真实接口使用 `LoginBodySchema`。
- 改动的文件通过 Prettier。
- 没有验证到：
  - `LoginBodySchema` 还没有被真实接口使用，所以 `docs/openapi.json` 里还看不到它。
  - 400 的响应体仍是 Nest 默认形状，统一成 `error.code/...` 留到 M1-T08。
  - 用户暂未采纳的写法建议（不影响验收）：`readDemoAccounts` 由 `export function` 改成了箭头函数加文件末尾的 `export { readDemoAccounts }`；`schemas.ts` 用 `import z from 'zod'` 默认导入，Zod 4.6.7 同时提供默认导出和命名导出 `z`，两者等价。

### M1-S24 详情

- 来源：PRD M1-R03「正确凭据登录成功并轮换 Session ID；错误用户名和错误密码均返回相同 401 文案」、接口表「login：200 返回最小 user，设置 HttpOnly Cookie」；技术方案 §5「登录通过密码校验后 regenerate、设置 userId/随机 CSRF token、显式 save 成功才 200。失败不可发出看似有效登录 Cookie」、§6「me/login 使用 Cache-Control:no-store」；执行计划 M1-T06「正确与错误登录、存储故障、匿名会话不保存」。这是 M1-T06 的最后一小步，把 S22 的 `verifyCredentials`、S23 的 `LoginBodySchema` 和 S21 的会话中间件接成真正的接口。
- 计划：新增 `POST /api/v1/auth/login`。本步不做 Origin 检查和限流：PRD 要求「先校验 Origin」，但它与 CSRF、限流同属 M1-T08，M1-R03 在那之前只算部分完成，不标通过。也不做 `me`、`logout`。
- 建议设计（待用户确认）：
  - `apps/api/src/modules/auth/auth.controller.ts`：`@Controller('auth')`，`@Post('login')`、`@HttpCode(200)`、`@Header('Cache-Control', 'no-store')`。参数为 `@Body({ schema: LoginBodySchema })` 和 Express 的 `@Req()`。在 `AuthModule` 的 `controllers` 中注册。
  - 顺序：先 `verifyCredentials`。失败时抛 `UnauthorizedException`，文案固定（例如 `Invalid username or password`），并且不碰会话，所以不会下发 Cookie。成功后才 `regenerate`。
  - `regenerate`：express-session 先删除旧会话 ID 对应的行，再生成新 ID。这就是「轮换 Session ID」：如果攻击者事先让浏览器带上一个他知道的会话 ID（会话固定攻击），登录后这个 ID 也就作废了。
  - 写入 `userId` 和随机的 `csrfToken`（`randomBytes(32)`，base64url），然后显式 `save`，等它成功后才返回 200 `{ user: { id, username } }`。`save` 会经 S20 的 Store 调用 `create` 写库。
  - `regenerate`/`save` 是回调风格，要包成 Promise 再 `await`。
  - 存储失败（数据库断开）时不能下发 Cookie。源码核对结果：express-session 在响应头发出时，只要 `req.session` 存在、而且被改过，就会写 `Set-Cookie`，哪怕是错误响应。所以 `save` 失败时要先把 `req.session` 置为 `null` 再抛错，否则浏览器会拿到一个库里不存在的会话 Cookie。错误暂时是 5xx，映射成 503 留到 M1-T08。
  - OpenAPI：响应用 Zod Schema 描述（`@nestjs/swagger@12.0.2` 的 `@ApiOkResponse` 支持 `standardSchema`，实测后确定写法），同时声明 400、401。本步 `pnpm contracts` 会生成新路径，`docs/openapi.json` 和 Web 类型按预期变化，差异只应包含 login。
- 测试（确认后助手先写）：
  - 离线 HTTP：用真实的 `AppModule`、`configureApp`、`configureSession`，`AuthService` 和 `SessionsRepository` 换成替身。覆盖：
    - 成功：200，响应恰好 `{ user: { id, username } }`；`Set-Cookie` 为 `ledger.sid`，带 `HttpOnly`、`SameSite=Lax`、`Path=/`；`Cache-Control: no-store`；库里写入的 `userId` 来自 `verifyCredentials`，与请求体无关。
    - 失败：用户名不存在、密码错误两种情况的 401 响应体逐字相同，没有 `Set-Cookie`，不写库；400 时不调用 `verifyCredentials`。
    - 存储失败：没有 `Set-Cookie`，响应里没有内部错误信息。
  - `ledger_it` 真实库：seed 两个虚构账号后启动真实应用。
    - 登录成功后 sessions 表恰好多一行，主键是 Cookie 里会话 ID 的摘要，`user_id` 正确，`csrf_token` 非空。
    - 带着 A 的 Cookie 再以 B 登录：拿到不同的会话 ID，A 那一行被删除，库里只剩 B。
    - 错误登录不增加行。
- 验收：离线测试与 `test:db` 通过；`pnpm check` 退出码 0；生成契约的差异只包含 login 接口。

M1-S24 实测与测试准备记录（2026-10-20）：
- 用户回复「开始 S24」，同意上面的设计。
- 实测方式：在 `apps/api/test/` 下临时放一个 spec，用真实 `AppModule`、`configureApp`、`configureSession`，挂一个测试用 Controller，`SessionsRepository` 换成会记录调用的内存替身。另用临时 `.ts` 文件核对类型写法。两个文件都已删除。
- 实测发现一，设计需要补一处：按设计写的 `regenerate → 赋值 → 显式 save`，Store 的 `create` 会被调用两次，同一个会话 ID。
  - 原因（核对 express-session 1.19.0 源码）：`regenerate` 生成的新会话对象，没有经过 express-session 内部记录「已保存」的那层包装。显式 `save` 之后它仍认为会话未保存，响应结束时会再 `set` 一次。
  - S20 的 Store 对没有 `loadedFromStore` 标记的会话一律 `INSERT`，在真实库上第二次就是主键冲突 23505。这个错误发生在响应发出之后，客户端照样拿到 200，只在服务端留下一条错误日志。
  - express-session 对 Store 的约定是 `set` 可以重复调用（插入或更新）。所以改 Store：`create` 成功后给会话对象打上 `loadedFromStore = true`，第二次 `set` 就按「已有会话」续期（`findActive` + `update`）。如果两次 `set` 之间会话被删除（例如被退出），第二次什么都不做，不会把它重新建出来。这一行属于业务代码，由用户写在 `session-store.ts` 的 `write` 里。
  - 不采用「先查一下有没有，再决定 create 还是 update」：这样两次 `set` 之间被删除的会话会被重新建出来，违反 M1-R05。
- 实测发现二：只靠响应结束时的自动保存、不显式 `save`，保存失败时客户端仍拿到 200。所以必须显式 `save`，等它成功后再返回。
- 实测发现三：保存失败，或者 `regenerate` 删除旧会话失败时，如果不去掉 `req.session`，返回的 500 里会带 `Set-Cookie`；去掉之后不带。
  - `regenerate` 删除失败时，express-session 照样生成了新会话。所以 `regenerate` 也要放进同一个 `try` 里。
  - 类型上，`req.session = null` 报 `TS2322`，`delete req.session` 报 `TS2790`，因为类型包把它声明为必有字段。可以编译的写法是 `Reflect.deleteProperty(request, 'session')`。
- 实测发现四：`@Header('Cache-Control', 'no-store')` 对 handler 抛出的 401 也生效。401 的响应体为 `{ message, error: 'Unauthorized', statusCode: 401 }`。
- 实测发现五：`@ApiOkResponse({ description, standardSchema: <Zod Schema> })` 能生成 200 的响应结构，Zod 对象会带上 `additionalProperties: false`，`z.uuid()` 会带上 `format: uuid`。
- 实测发现六：`import type { Request } from 'express'` 报 `TS2307`，因为 `express` 不是 `apps/api` 的直接依赖。改用类型包提供的全局 `Express.Request`，它已经带有 `session`、`sessionID` 的类型。
- 实测发现七：带着旧会话 Cookie 登录时，先删除旧 ID 的行（`delete`），再写入新 ID（`create`），库里只剩新的一行。
- 待用户实现（用户手写）：
  - `apps/api/src/modules/auth/session-store.ts`：`write` 中 `create` 成功后加一行 `sess.loadedFromStore = true`。
  - `apps/api/src/modules/auth/schemas.ts`：导出 `LoginResponseSchema = z.object({ user: z.object({ id: z.uuid(), username: z.string() }) })`。
  - 新建 `apps/api/src/modules/auth/auth.controller.ts`，命名导出 `AuthController`：
    - 类上 `@Controller('auth')`，构造参数注入 `AuthService`。
    - `login` 方法：`@Post('login')`、`@HttpCode(200)`、`@Header('Cache-Control', 'no-store')`、`@ApiOkResponse({ description, standardSchema: LoginResponseSchema })`、`@ApiBadRequestResponse(...)`、`@ApiUnauthorizedResponse(...)`。
    - 参数：`@Body({ schema: LoginBodySchema }) body`、`@Req() request: Express.Request`。
    - 顺序：先 `verifyCredentials(body.username, body.password)`，返回 `null` 时抛 `UnauthorizedException('Invalid username or password')`。然后在同一个 `try` 里依次执行 `regenerate`、写 `request.session.userId` 和 `request.session.csrfToken`（`randomBytes(32).toString('base64url')`）、`save`；`catch` 里先 `Reflect.deleteProperty(request, 'session')` 再重新抛出。最后返回 `{ user: { id, username } }`，不返回 `csrfToken`。
    - `regenerate`/`save` 是回调风格，各包一层 Promise。写 `userId` 时要用 `regenerate` 之后的 `request.session`：它是一个新对象，提前存下来的旧引用写进去不会被保存。
  - `auth.module.ts`：`controllers: [AuthController]`。
- 测试：
  - `apps/api/test/session-store.spec.ts` 新增 2 条，共 24 条：
    - 同一个新会话对象被 `set` 两次，只 `create` 一次，第二次按续期处理，绝对截止不变。
    - 两次 `set` 之间被删除时，第二次不会重新建出来。
  - 新增 `apps/api/test/auth-login.spec.ts`，13 条。用真实 `AppModule`、`configureApp`、`configureSession`，会话中间件和 Store 都是真的；`AuthService`、`SessionsRepository` 换成内存替身，后者与真实库一样不接受同一 ID 再次 `create`。
    - 成功：响应恰好是 `{ user }`；`Cache-Control: no-store`；只有一个签名正确的 `ledger.sid`，属性恰好是 `HttpOnly`、`Path=/`、`SameSite=Lax`，没有 Secure、Expires、Max-Age、Domain。
    - 请求体去掉首尾空白后的用户名和原样的密码传给 `verifyCredentials`。
    - 只存一行，行的键就是 Cookie 里的会话 ID；`userId` 来自校验结果，请求体里混进来的 `userId` 无效；`csrfToken` 为 43 个字符的 base64url，且不出现在响应里；期限为 7 天和 12 小时；响应结束后没有错误日志。
    - 每次登录都换新的会话 ID 和新的 CSRF token。
    - 带着 alice 的 Cookie 以 bob 登录：alice 的行被删除，只剩 bob 的。
    - 用户不存在、密码错误：401 响应逐字相同，带 `no-store`，没有 Cookie，不碰会话。
    - 3 种不合格请求体返回 400，不校验凭据。
    - 3 种依赖失败都没有 Cookie、响应里不带内部错误信息：写入新会话失败、删除旧会话失败、校验凭据时数据库出错。
    - OpenAPI：`operationId` 为 `AuthController_login`，有请求体，响应恰好有 200/400/401；200 的结构只有 `user.id`（uuid）和 `user.username`。
  - `apps/api/test/contracts.spec.ts` 新增 3 个断言：真实 `pnpm contracts` 生成的 OpenAPI 和 Web 类型中有 login 接口和 `AuthController_login`。
  - 新增 `apps/api/test/integration/support/api-process.ts`（`startApi`/`stopApi`，启动和关闭 `dist/main.js`），以及 `apps/api/test/integration/auth-login.db.spec.ts`，5 条，在 `ledger_it` 写入两个虚构用户（真实 Argon2id 哈希）后启动真实应用：
    - alice 登录（用户名带大写和空格）：200，sessions 表恰好一行，主键是 Cookie 里会话 ID 的摘要，明文 ID 不在库里，`data` 只有 43 个字符的 `csrfToken`，期限正确，进程输出中没有错误和 `duplicate key`。
    - 带着 alice 的 Cookie 以 bob 登录：拿到不同的 ID，alice 的行被删除，库里只剩 bob 的。
    - 密码错误、用户不存在：401 响应体相同，没有 Cookie，带 `no-store`，库不变。
    - 不合格请求体：400，库不变。
    - 进程输出中没有错误、两个密码、会话密钥和连接串；收到 SIGTERM 后 `ledger_it` 上没有它留下的连接。
- 测试自身的核对：
  - 在 `/tmp` 下建临时 git worktree 放入上面的参考实现。离线 `auth-login` 13 条、`session-store` 24 条通过，`tsc` 通过。手动执行构建、`generate-openapi`、`openapi-typescript` 后，`docs/openapi.json` 增加 76 行、Web 类型增加 63 行，只有 `/api/v1/auth/login`。真实库 `auth-login` 5 条、`main-session` 5 条、`session-store` 2 条通过。
  - 16 种错误写法全部被发现（括号内为失败条数）：
    - Store：`create` 后不打标记（离线 4、真实库 2）；改成「库里已有就跳过」（2）。
    - 会话：不 `regenerate`（1）；不显式 `save`（1）；失败时不去掉 `req.session`（2）；`regenerate` 放在 `try` 外面（1）；先 `regenerate` 再校验凭据（3）；写进 `regenerate` 之前存下的旧会话对象（4）。
    - 响应：不设 `no-store`（2）；401 用 Nest 默认文案（1）；响应里带出 `csrfToken`（3）。
    - token：只有 16 个字节（1）；写死一个固定值（1）。
    - Schema 与契约：请求体不用 Schema（5）；200 不描述响应结构（1）；不声明 400（1）。
  - 核对中的环境问题：
    - worktree 里的 `node_modules` 是软链。worktree 中的 contracts 测试和完整 `test:db` 后半段，因为 pnpm 拒绝在这种目录下执行脚本而失败（`ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH`、`workspace hoist directory is not a real directory`），与实现无关。所以改为手动执行生成步骤，真实库测试只跑与本步相关的 3 个文件。
    - worktree 里的 pnpm 经软链改写了主工作区 `node_modules/.bin` 下 15 个命令脚本的 `NODE_PATH` 和注释，让它们指向临时目录。实际执行的路径是相对路径，所以这些命令仍然可用。
    - 修复：删除 worktree，移走 `node_modules/.pnpm-workspace-state-v1.json`，执行 `pnpm install --frozen-lockfile --offline`（只用本地 store，没有下载）。之后指向临时目录的脚本为 0 个，`pnpm-lock.yaml` 的 SHA-256 前后相同，`prettier` 正常。
  - 临时文件和脚本都已删除。
- 实现前运行（工作区）：
  - `pnpm --filter @ledger/api test`：26 个文件、288 条，16 条失败，都来自待实现的部分：
    - `auth-login` 13 条，因 `auth.controller.ts` 不存在。
    - `session-store` 新增的 2 条：第二次 `set` 报 `duplicate session id`；`create` 被调用了 2 次。
    - `contracts` 1 条，生成的 OpenAPI 中没有 login 路径。
  - 其余 272 条通过；生成契约无 Git 差异。
  - `test:db`：12 个文件、82 条。新文件 `auth-login.db.spec.ts` 中 4 条失败：登录、错误凭据、400 三种请求都得到 404，因为还没有这个接口；轮换那条因前一条没有登录成功而失败。最后一条（没有错误日志、释放连接）在当前代码下就成立，作为回归保护。其余 78 条通过。运行前后 `ledger_it` 上连接数均为 0。
  - 运行 `test:db` 时发现一个 21:27 起就在运行的 `dist/main.js`，监听 39123 端口，环境里是不可达的数据库地址。它是 S23 构建产物端到端验证时启动的，当时 `kill` 后没有确认退出，属于助手遗留。已用 SIGTERM 关闭，确认退出。它连的是不可达地址，没有连接过任何真实库。
  - `pnpm typecheck` 通过；5 个测试文件通过 Prettier（`--write` 只调整了一处换行）。
- 未修改业务代码。

M1-S24 验收证据（2026-10-21）：
- 实现：
  - 用户手写：`session-store.ts` 的 `write` 在 `create` 成功后加上 `sess.loadedFromStore = true`，并给 `SessionData.csrfToken` 加了注释；`schemas.ts` 导出 `LoginResponseSchema`。
  - 按用户要求，助手编写：`apps/api/src/modules/auth/auth.controller.ts` 的 `AuthController.login`，以及把回调包成 Promise 的 `regenerateSession`、`saveSession`；`auth.module.ts` 加 `controllers: [AuthController]` 并更新注释。写法与测试准备时的参考实现一致。
- `pnpm --filter @ledger/api exec vitest run test/auth-login.spec.ts test/session-store.spec.ts`：2 个文件、37 条通过。
- `pnpm typecheck` 通过；`modules/auth` 通过 Prettier。
- `pnpm check`：退出码 0；API 26 个文件、288 条，Web 1 个文件、2 条，build 完成。
- 生成契约：`docs/openapi.json` 增加 76 行、`apps/web/src/generated/api-types.ts` 增加 63 行，只有新增、没有删改，内容只有 `/api/v1/auth/login` 和 `AuthController_login`，行数与测试准备时的参考实现相同。Swagger 按 Controller 名自动加了 `tags: ["Auth"]`。这两份文件要随本步一起提交。
- `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db`：12 个文件、82 条通过，其中 `auth-login.db.spec.ts` 5 条。运行前后 `ledger_it` 上连接数均为 0，没有残留的 `dist/main.js` 进程。
- 没有验证到：
  - 登录前的 Origin 检查和限流（M1-T08），所以 M1-R03 只标「部分」。
  - 依赖失败时返回的是 5xx，映射成 503 留到 M1-T08；400/401 的响应体仍是 Nest 默认形状。
  - `pnpm dev` 没有启动过；Web 还没有调用登录接口（M1-T09）。

### M1-S25 详情

- 来源：
  - PRD M1-R04「me 从会话取得身份；未登录、已退出、闲置/绝对过期均 401；客户端 userId 不改变返回用户」。
  - PRD 接口表「GET /api/v1/auth/me：Cookie；200 返回 user{id,username} 和 csrfToken；响应不缓存；401 未登录/过期；503 数据库」。
  - 技术方案「AuthGuard 只从有效 session 取得 userId。me 查询该 ID，用户不存在视为无效会话；不接受 body/query 的 userId 或客户端 Header 作身份」「GET me 不要求 CSRF」「me/login 使用 Cache-Control:no-store」。
  - M1-T07（me/logout 与 AuthGuard，1.5h）拆成两步：本步做 me 与 AuthGuard，退出留到下一步。
- 计划：新增 `GET /api/v1/auth/me` 和 AuthGuard。Guard 是 Nest 在调用 Controller 方法之前执行的一道检查，要么放行，要么抛错。把「这个请求登录了没有」放进 Guard，以后每个需要身份的接口都复用这一份判断，不用在每个方法里各写一遍。
- 设计（用户选 A，具体写法见下方「待用户实现」）：
  - `apps/api/src/common/guards/auth.guard.ts`，`AuthGuard implements CanActivate`：
    - 只看 `request.session?.userId` 是不是字符串，不查库。会话过期由 Store 的 `get` 判断：过期返回 `null`，express-session 换成一个没有 `userId` 的空会话，Guard 自然拒绝，不必再算一遍期限。
    - 拒绝时自己抛 `UnauthorizedException`，文案固定（例如 `Authentication required`）。如果只是返回 `false`，Nest 回的是 403 `Forbidden resource`（已核对 `@nestjs/core@12.1.2` 源码），与 PRD 的 401 不符。
  - Guard 的挂法，两种方案（用户选 A）：
    - A（建议）：全局注册（`APP_GUARD`），默认所有接口都要登录；health、ready、login 用 `@Public()` 标记放行，Guard 用 `Reflector` 读这个标记。理由与 S23 全局注册 Pipe 相同：M2 起新增的业务接口如果忘了处理，得到的是 401，立刻能发现；而不是对匿名请求开放。不在 `SESSION_PATHS` 下的接口没有 `req.session`，同样得到 401，也会提醒把路径加进去。代价：health、internal 两个 Controller 各加一行 `@Public()`；现有测试里只在测试中存在的 Controller（`login-body-validation`、`json-body-parsing` 等）也要加，这部分由助手改。
    - B：只在需要身份的方法上写 `@UseGuards(AuthGuard)`。改动最少，但漏写一次就多一个不需要登录的接口，类型检查和现有测试都发现不了。
  - me：
    - `AuthController` 新增 `@Get('me')`、`@Header('Cache-Control', 'no-store')`。从 `request.session.userId` 取 ID，经 `AuthService.findSessionUser` 调用 S14 的 `findPublicById`，返回 `{ user: { id, username }, csrfToken }`。
    - query、Header、body 里的 userId 一律不读。
    - 用户不存在（会话还在、用户已删除）视为无效会话，返回 401。sessions 表的外键带 `ON DELETE CASCADE`，删用户时会话一起删，这里只防两者之间的极短窗口。
  - 为什么 me 要返回 csrfToken：Cookie 是 HttpOnly，页面脚本读不到会话内容。以后退出等写请求要在 `X-CSRF-Token` 头里带上这个值（M1-T08 校验），页面只能从 me 拿到它，放在内存里。
  - 续期：me 不修改会话，express-session 在响应结束时调用 Store 的 `touch`，闲置截止往后推到 12 小时后（不超过绝对截止）。所以页面每次打开调用 me，就算一次活动。
  - Schema：`schemas.ts` 抽出 `PublicUserSchema`（login 和 me 共用），新增 `MeResponseSchema`；OpenAPI 声明 200、401。
  - 数据库离线：会话中间件读会话时就会失败，返回 5xx；映射成 503 留到 M1-T08。
- 测试：离线 Guard 单元与 HTTP 测试、`ledger_it` 真实库测试，助手先写，内容见下方测试准备记录。
- 注意事项：不做退出（下一步）；不做 Origin/CSRF 校验和限流（M1-T08）；GET 请求不要求 CSRF。
- 验收：离线测试与 `test:db` 通过；`pnpm check` 退出码 0；生成契约的差异只包含 me。

M1-S25 决定与测试准备记录（2026-10-22）：
- 用户回复「按照你的建议，进行下一步」，选 A：全局注册 AuthGuard，用 `@Public()` 放行。
- 待用户实现（用户手写）：
  - 新建 `apps/api/src/common/guards/auth.guard.ts`：
    - 导出 `IS_PUBLIC_KEY`（字符串常量），以及 `Public = () => SetMetadata(IS_PUBLIC_KEY, true)`。`SetMetadata` 来自 `@nestjs/common`，作用是在类或方法上记下一个标记，Guard 运行时再读出来。
    - 导出 `@Injectable()` 的 `AuthGuard implements CanActivate`，构造参数为 `private readonly reflector: Reflector`（从 `@nestjs/core` 值导入）。
    - `canActivate(context)`：
      - 先用 `this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])` 读标记，为 `true` 就放行。这样标在方法上和标在类上都能生效。
      - 再取 `context.switchToHttp().getRequest<Express.Request>()`，`typeof request.session?.userId === 'string'` 才放行。要写 `?.`：不在 `SESSION_PATHS` 下的接口没有会话中间件，`request.session` 是 `undefined`。
      - 否则抛 `UnauthorizedException('Authentication required')`。
  - `app.module.ts`：`providers: [{ provide: APP_GUARD, useClass: AuthGuard }]`，`APP_GUARD` 来自 `@nestjs/core`。用 `useClass` 由 Nest 创建 Guard，它才能注入 `Reflector`。注册在模块里，而不是在 `configureApp` 里 `useGlobalGuards`：这样任何组装 `AppModule` 的方式（`main.ts`、测试、以后的脚本）都自动带上 Guard。
  - `health.controller.ts`、`internal.controller.ts`：类上加 `@Public()`。
  - `auth.controller.ts`：
    - 只在 `login` 方法上加 `@Public()`，不要加在整个 `AuthController` 上。加在类上的话，me 和以后的退出都会对匿名请求开放。
    - 新增 `me` 方法：`@Get('me')`、`@Header('Cache-Control', 'no-store')`、`@ApiOkResponse({ description, standardSchema: MeResponseSchema })`、`@ApiUnauthorizedResponse(...)`。参数只有 `@Req() request: Express.Request`。
      - 从 `request.session` 取 `userId`、`csrfToken`。它们的类型是 `string | undefined`，要先判断是字符串，否则抛同样的 401。正常情况下 Guard 已经保证有 `userId`，Store 只保存两个字段都有的会话。
      - 调用 `this.authService.findSessionUser(userId)`。返回 `null` 时抛 `UnauthorizedException('Authentication required')`。
      - 返回 `{ user: { id, username }, csrfToken }`。不写 `try/catch`，数据库错误原样抛出。
  - `schemas.ts`：抽出 `PublicUserSchema = z.object({ id: z.uuid(), username: z.string() })`。`LoginResponseSchema` 改为 `z.object({ user: PublicUserSchema })`，生成的 OpenAPI 不变。新增 `MeResponseSchema = z.object({ user: PublicUserSchema, csrfToken: z.string() })`。
  - `auth.service.ts`：新增 `findSessionUser(userId: string): Promise<PublicUser | null>`，直接返回 `this.users.findPublicById(userId)`。不捕获错误：当成 `null` 的话，数据库一断，已登录的人就被当成「没登录」。
    - 为什么不让 Controller 直接调用 `UsersRepository`：`AuthModule` 没有导出 `UsersRepository`，Controller 只依赖 `AuthService`，测试也只需要替换这一个服务。
- 测试：
  - 新增共用的 `apps/api/test/support/auth-app.ts`：按 `main.ts` 的方式组装真实应用，`AuthService`、`SessionsRepository` 换成内存替身，数据库一律不可用。还提供签名 Cookie、构造会话行和 401 期望值。
  - 新增 `apps/api/test/auth-guard.spec.ts`，21 条：
    - 单元：会话里有字符串 `userId` 时放行；没有会话、会话为 `null`、没有 `userId`、`userId` 是数字或对象，都抛 `UnauthorizedException`，响应体为 `{ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' }`。
    - 单元：query、Header、body、`request.user`、`request.userId` 里的身份都无效。
    - 单元：方法上的 `@Public()` 放行且不读请求，同一个类的其他方法仍要登录；类上的 `@Public()` 对所有方法生效。
    - 单元：`AuthController` 的 `login` 放行、`me` 拒绝。
    - HTTP，用只在测试里存在的 Controller，确认 Guard 是全局的：
      - 匿名请求为 401（不是 403），不进入 Controller，没有 Cookie。
      - 有效会话放行，`userId` 来自会话。
      - 未知会话、闲置过期、绝对过期都是 401。
      - 用别的密钥签名的 Cookie 为 401，且不查会话。
      - 不在会话路径下的接口，带有效 Cookie 也是 401，且不查会话。
      - 匿名请求带不合格的请求体，返回 401 而不是 400，因为 Guard 在 Pipe 之前执行。
      - 类上标了 `@Public()` 的测试 Controller 可以匿名访问。
      - health 200、ready 503（数据库不可用）、login 200，都不需要登录。
      - 不存在的路径仍是 404。
  - 新增 `apps/api/test/auth-me.spec.ts`，14 条：
    - 有效会话：响应恰好 `{ user, csrfToken }`，带 `no-store`，不重新下发 Cookie，`findSessionUser` 收到会话里的 `userId`。
    - 调 me 后闲置截止续到 12 小时后，绝对截止不变，`csrfToken` 和归属不变，不新建会话，没有错误日志。
    - `?userId=`、`X-User-Id` 头、JSON 请求体里的 `userId` 都不改变返回的用户。
    - alice、bob 各自拿到自己的身份和 token。
    - 先真实登录，再用拿到的 Cookie 调 me 两次：返回登录时存下的 token，两次相同。
    - 无 Cookie、未知会话、闲置过期、绝对过期、别的密钥签名：都是同一个 401，没有 Cookie，不查用户，不续期、不新建会话。
    - 会话还在、用户已删除：同一个 401，带 `no-store`。
    - 查会话失败、查用户失败：5xx 而不是 401，响应里没有内部错误信息。
    - OpenAPI：`operationId` 为 `AuthController_me`，没有请求体和参数，响应恰好 200/401，200 的结构只有 `user.id`（uuid）、`user.username` 和 `csrfToken`。
  - `apps/api/test/auth.service.spec.ts` 新增 3 条 `findSessionUser`：返回普通对象且不碰密码哈希；用户不存在返回 `null`；仓储错误原样抛出。
  - `apps/api/test/contracts.spec.ts` 新增 3 个断言：生成的 OpenAPI 和 Web 类型中有 me 接口和 `AuthController_me`。
  - `login-body-validation.spec.ts`、`json-body-parsing.spec.ts`：只在测试里存在的 Controller 加上 `@Public()`。这两个文件只测请求体，不测登录。
  - 新增 `apps/api/test/integration/auth-me.db.spec.ts`，9 条，在 `ledger_it` 写入三个虚构用户后启动真实的 `dist/main.js`，先真实登录再调 me：
    - 返回登录的用户和 sessions 表里存的 token，带 `no-store`，不重新下发 Cookie。
    - 把会话退回一小时前，调 me 后库里的闲置截止被续期，绝对截止和 `data` 不变。
    - alice、bob 各自拿到自己的身份和 token，query 和 Header 里的 `userId` 无效。
    - 无 Cookie 为 401。
    - 闲置截止已过、绝对截止已过、会话行被删除：都是 401，库里那一行不被续期，也不被重新建出来。
    - 会话还在、用户已删除：401。外键带 `ON DELETE CASCADE`，所以测试先临时删掉外键 `fk_sessions_user_id`，结束时在 `finally` 中清掉这一行会话并按原定义加回外键。用的是单独的用户 carol，不影响其他用例。
    - health 仍为 200；进程输出中没有错误、三个密码、token、会话 ID、会话密钥和连接串；SIGTERM 后 `ledger_it` 上没有它留下的连接。
- 测试自身的核对：
  - 在 `/tmp` 下建临时 git worktree，这次在其中单独执行 `pnpm install --frozen-lockfile --offline`（只用本地 store），不再用软链共用依赖。前后核对：主工作区三个 `node_modules/.bin` 的文件摘要不变，没有指向 `/tmp` 的脚本，`pnpm-lock.yaml` 的 SHA-256 不变。
  - 放入上面的参考实现：
    - `tsc` 通过。
    - 完整 API 测试 28 个文件、326 条通过，包括真实的 contracts 命令。worktree 有自己的 `node_modules`，S24 时 pnpm 拒绝执行脚本的问题没有再出现。
    - 生成契约：`docs/openapi.json` 增加 52 行、Web 类型增加 50 行，没有删改，只有 `/api/v1/auth/me`。login 的部分不变，说明抽出 `PublicUserSchema` 不影响契约。
    - `test:db` 13 个文件、91 条通过，运行后 `ledger_it` 上连接数为 0。
  - 18 种错误写法在离线测试中全部被发现（括号内为失败条数）：
    - Guard：拒绝时返回 `false`（20）；只判断 `userId` 为真值而不是字符串（2）；有会话就放行（10）；401 不带文案（16）；不全局注册（7）。
    - `@Public()`：health 不标（4）；internal 不标（4）；login 不标（13）；标在整个 `AuthController` 上（1）。
    - me：读 `?userId=`（1）；不检查用户是否存在（1）；不设 `no-store`（2）；每次调用都换新 token（4）；不返回 `csrfToken`（3）；把数据库错误当成 401（1）；200 不描述响应结构（1）。
    - `findSessionUser`：吞掉数据库错误（1，只有 `auth.service.spec.ts` 能发现）；查错了方法（3）。
  - 其中 5 种另外在真实库测试中运行：读 `?userId=`（1）、不检查用户是否存在（2）、每次换新 token（1）、查错了方法（3）都被发现；「有会话就放行」在真实库测试中没有被发现，因为 me 自己还会检查 `userId`，这一种由离线的 Guard 测试负责。
  - 用参考实现的构建产物，以确认连不上的 `127.0.0.1:1` 作数据库地址启动 `dist/main.js`，匿名请求 me：401，响应体为上面的固定文案，没有 `Set-Cookie`，也没有 `Cache-Control: no-store`。原因：Guard 在 Nest 设置 `@Header` 之前就抛错了（已核对 `@nestjs/core@12.1.2` 的 `router-execution-context.js`：先执行 Guard，再设置状态码和响应头）。401 响应体不含身份信息，浏览器默认也不缓存 401；技术方案要求的「错误响应也带 no-store」归在 M1-T08 统一处理，本步不要求，测试只对 me 方法内抛出的 401 断言 `no-store`。
  - 环境：这个探测进程第一次 SIGTERM 发给了错误的 PID（shell 里 `$!` 指向的不是它），发现后再次 SIGTERM，确认已退出、端口不再监听。它只连过不可达地址。
  - worktree、参考实现和临时脚本都已删除。
- 实现前运行（工作区）：
  - `pnpm --filter @ledger/api test`：28 个文件、326 条，73 条失败，都来自待实现的部分：
    - `auth-guard` 21 条，因 `auth.guard.ts` 不存在（Cannot find module）。
    - `login-body-validation` 22 条、`json-body-parsing` 13 条，同样因为 `auth.guard.ts` 不存在（导入 `Public` 失败）。
    - `auth-me` 14 条中 13 条失败：me 返回 404，OpenAPI 中没有 me。通过的 1 条是「查会话失败时返回 5xx」，在当前代码下就成立，作为回归保护。
    - `auth.service` 新增的 3 条：`findSessionUser is not a function`。
    - `contracts` 1 条：生成的 OpenAPI 中没有 me 路径。
  - 其余 253 条通过；生成契约无 Git 差异。
  - `test:db`：13 个文件、91 条。`auth-me.db.spec.ts` 9 条中 8 条失败，都因为 me 返回 404；最后一条（health、日志、释放连接）在当前代码下就成立。其余 83 条通过。运行前后 `ledger_it` 上连接数均为 0；`fk_sessions_user_id` 已按原定义加回（`FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`）。
  - `pnpm typecheck` 通过；测试文件通过 Prettier（`--write` 只调整了 `auth-me.spec.ts` 的一处换行）。
- 未修改业务代码。

## 实际执行记录

2026-10-12 开始实施。2026-10-13 完成 M1-S01 到 M1-S09。S09 针对性测试 16 条通过，完整 API 测试 10 个文件、27 条通过，API/Web 类型检查通过，包含启动及实际 contracts 的离线回归。2026-10-15 确认并建立专用测试库 `ledger_it`，新增 `test:db`，完成 M1-S10：users migration 在真实 PostgreSQL 上首次执行建表、重复执行不再建表，约束与计划一致（21 条通过，两次运行可重复）。sessions 尚未建表，阶段验收 M1-R01 仍未验证。同日完成 M1-S11：sessions 的 Entity 与 migration 在 `ledger_it` 上验证通过（API 测试 12 个文件 33 条，`test:db` 4 个文件 40 条，连续两次可重复），M1-R01 通过。随后完成 M1-S12：根 `pnpm test` 先跑 API 再跑 Web，`pnpm check` 因此包含 API 测试，并验证 API 测试失败会让 check 失败。之后在此维护：实际日期与工时、应用/迁移/fixture版本、专用测试库名（不写连接串）、运行命令、通过/失败摘要、测试位置或报告链接、未完成项与阶段阻塞。

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
