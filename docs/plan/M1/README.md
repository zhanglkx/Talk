# M1｜业务数据库与认证最小闭环

- 目标窗口：2026-10-12 ～ 2026-11-08。
- 状态：**进行中**（当前步骤 M1-S04）。
- 基线：`49410c2`；文档制定日期：2026-10-09。
- 核心任务：10 张卡，建议工时合计 15 小时；不含所有环境阻塞。

## 前置门与产出

已有 NestJS/React、TypeORM/PostgreSQL、环境校验、health/ready 和 OpenAPI 类型生成；业务 migration、Entity、账号与认证尚未实现。基线为 49410c2，历史测试记录不代表本阶段通过。

可复现 migration、两个虚构账号、会话登录/退出/me、受保护请求、最小登录页面与可核对的测试证据。分类写入为可选项，完整流水留给 M2/M3。

## 阅读顺序

| 顺序 | 文件 | 用途 |
|---|---|---|
| 1 | [PRD](01-PRD.docx) | 定义用户、范围、接口行为、错误反馈与产品验收。 |
| 2 | [技术方案](02-%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88.docx) | 定义模块、数据库、事务/信任边界、前端契约与测试方法。 |
| 3 | [学习与执行计划](03-%E5%AD%A6%E4%B9%A0%E4%B8%8E%E6%89%A7%E8%A1%8C%E8%AE%A1%E5%88%92.docx) | 按四周目标窗口拆解任务、学习重点、建议工时、证据与顺延规则。 |

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

| 编号 | 内容 | 状态 |
|---|---|---|
| M1-S01 | 共享连接生命周期 `ensureConnected`：并发只连接一次，失败后可重试，成功后不重复初始化，不执行 migration。 | done |
| M1-S02 | 应用关闭时销毁这一份 `DataSource`，只销毁一次；关闭过程不再连接。 | done |
| M1-S03 | 抽出无副作用的数据库配置，供 Nest 和以后的 CLI 共用。本步不创建 CLI 进程。 | done |
| M1-S04 | CLI 用的 `DataSource` 复用这份配置：创建时不连接，未连接时关闭不调用 `destroy`。 | 进行中 |

M1-S01 验收证据（2026-10-13）：`pnpm --filter @ledger/api test` 为 3 个文件、6 个测试通过；`pnpm typecheck` 通过。测试在 `apps/api/test/connection-lifecycle.service.spec.ts`、`health.spec.ts`、`readiness.spec.ts`。临时拿掉「进行中的连接只等一次」后，并发测试失败（第二个调用提前返回）；恢复后全套再次通过。仓库根的 `pnpm test` 仍只跑 Web。

M1-S02 验收证据（2026-10-13）：`pnpm --filter @ledger/api test` 为 4 个文件、7 个测试通过；`pnpm typecheck` 通过。关闭测试在 `apps/api/test/database-shutdown.spec.ts`。未改业务代码，未连接真实数据库。

M1-S03 验收证据（2026-10-13）：先用空函数看到两条断言失败（没有返回传入的 URL；连接池错误没有记下固定日志）。实现后 `pnpm --filter @ledger/api test` 为 5 个文件、9 个测试通过；`pnpm typecheck` 通过。测试在 `apps/api/test/database-options.spec.ts`。未连接真实数据库，未创建 CLI 进程。

### M1-S04 详情

- 来源：任务卡 M1-T02 的 CLI `DataSource`。真正执行 migration 的命令留到建表那一步。M1-T01 基线回归再往后拆。
- 计划：新增一个给命令行用的连接对象。它调用 `createDatabaseOptions`，所以和 Nest 用同一份配置。创建时不连接。Nest 模块里不注册它，避免运行中的应用再多出一套连接池。不建表，不加 npm 脚本。
- 动作：
  1. 新增 `apps/api/src/database/data-source.ts`，导出 `createCliDataSource(databaseUrl: string)`。内部 `new DataSource(createDatabaseOptions(databaseUrl))`，不调用 `initialize`。
  2. 同文件导出 `closeCliDataSource(dataSource)`。只有 `isInitialized` 为真才 `destroy()`；没连上就直接返回。
  3. 文件顶层不要 `new DataSource()`。`DatabaseModule` 不导入这个文件。
  4. 用假 URL 写测试：返回对象的 `options.url` 是传入的地址，`synchronize` 和 `migrationsRun` 为 false，`isInitialized` 为 false，且没有调用 `initialize`。未连接时 `closeCliDataSource` 不调用 `destroy`。
- 注意事项：
  - TypeORM 的 `destroy()` 在还没连上时会抛 `CannotExecuteNotConnectedError`。关闭函数如果无条件 destroy，会把「没连上」盖成另一个错误。
  - 构造函数会准备驱动对象，但不会打开连接。测试不要调用 `initialize`，否则会去连假地址。
  - 这是另一个进程里用的对象。不要把它放进 `DatabaseModule` 的 providers。
- 验收：`pnpm --filter @ledger/api test` 和 `pnpm typecheck` 通过，且测试包含：假 URL 出现在 CLI `DataSource` 的 options 里；创建后 `isInitialized` 为 false 且没有 `initialize`；未连接时关闭不调用 `destroy`。

## 实际执行记录

2026-10-12 开始实施。2026-10-13 完成 M1-S01（3 文件 / 6 测试）、M1-S02（4 文件 / 7 测试）和 M1-S03（5 文件 / 9 测试）。每次都跑了 `pnpm --filter @ledger/api test` 与 `pnpm typecheck`，未连接真实数据库。之后在此维护：实际日期与工时、应用/迁移/fixture版本、专用测试库名（不写连接串）、运行命令、通过/失败摘要、测试位置或报告链接、未完成项与阶段阻塞。

- [ ] 前置门已核对。
- [ ] PRD 各编号已有实际测试证据。
- [ ] 真实 PostgreSQL／HTTP／Web 或本阶段评测通过。
- [ ] 生成契约与运行行为一致。
- [ ] 未解决阻塞已清楚记录，未虚报完成。

## 依据与导航

[总阅读索引](../README.md) · [总学习计划](../2026-10-09-%E4%B8%AA%E4%BA%BA%E8%B4%A6%E6%9C%AC%E5%85%A8%E6%A0%88%E5%AD%A6%E4%B9%A0%E8%AE%A1%E5%88%92.docx)

[产品需求](../../docs/PRD-fullstack-ai-ledger.md) · [总技术方案](../../docs/TECH-PLAN-fullstack-ai-ledger.md)

重点依据：PRD §4～§6、§8；技术方案 §2～§5、§9；数据库与 AppModule 当前代码。

通用约束：只有虚构数据；NestJS/React 单体、本机 PostgreSQL、TypeORM、单一 DATABASE_URL；synchronize:false、migrationsRun:false；无 Docker、Redis 或新业务框架。金额分字符串，月份固定上海时区。文档中的目标文件、命令与验收不是已有实现。
