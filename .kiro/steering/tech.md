# 技术约束与命令实情

现状核对于 2026-10-14（M1-S10）。命令和版本以各 `package.json` 与代码为准；README、计划文档里的命令可能滞后，或只是目标。

## 硬约束

- NestJS 单体（Express 适配器）+ React/Vite + 本机 PostgreSQL + TypeORM/`pg`。不引入 Docker/Docker Compose、Redis、第二套 ORM、GraphQL、微服务或第二套 Node 框架。输入校验按技术方案用 Zod Standard Schema（尚未接入），不另选校验库。
- 数据库只认一个 `DATABASE_URL`，必须带库名（`validateEnvironment` 校验），不拆成 host/port/user/password。
- `synchronize: false`、`migrationsRun: false`、`manualInitialization: true`：应用启动不连库、不建表、不迁移。表结构只能通过版本化 migration 的显式命令修改。
- Node 26.11.1、pnpm 12.10.1 精确锁定（engines + volta），应用依赖写精确版本。安装策略在 `pnpm-workspace.yaml`（allowBuilds、minimumReleaseAgeExclude、packageExtensions、patchedDependencies）和 `.pnpmfile.cjs`。
- 项目用 TypeScript 7.0.2；`openapi-typescript` 被固定使用 TypeScript 6.0.3；`@nestjs/cli` 打了补丁，不再优先从项目目录解析 TypeScript（`patches/`）。升级这三者任一个时，一并核对上述配置。

## 命令实情

- 根目录 `pnpm test` 先跑 API 测试（`pnpm --filter @ledger/api test`），通过后再跑 Web；`pnpm check` 因此包含 API 测试（M1-S12）。`test:db` 不在其中，真实数据库验收要另外运行。
- `test:db`（`pnpm --filter @ledger/api run test:db`）跑 `vitest.integration.config.ts`，只包含 `apps/api/test/integration/`，不加载 `setup-env.ts`。运行时必须注入 `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it` 和 `ALLOW_DATABASE_RESET=ledger_it`：测试会经维护库 `postgres` 删除并重建 `ledger_it`（不加 FORCE，有其他连接时失败），然后构建 API，在 `apps/api` 下运行 `pnpm exec typeorm migration:run -d dist/database/cli-data-source.js`。主机不是本机回环、带查询参数、库名不是 `ledger_it` 或缺确认变量时，在连库前报错。默认 `vitest.config.ts` 排除 `test/integration/**`。
- 还没有给开发库用的 migration 脚本和 seed 脚本。
- API 的 `dev` 用 SWC 且带 `--no-type-check`，类型错误只在 `pnpm typecheck` 或 `build` 时暴露。
- `pnpm contracts`：构建 API → 运行 `dist/generate-openapi.js` 写 `docs/openapi.json` → 生成 `apps/web/src/generated/api-types.ts`。不需要数据库在线，但需要格式合法的 `DATABASE_URL`。
- `apps/api/test/contracts.spec.ts` 会执行真实的 `pnpm contracts`，重写上面两份生成文件；跑完用 `git status` 确认没有意外差异。
- 普通 API 测试由 `apps/api/test/setup-env.ts` 把 `DATABASE_URL` 固定为 `127.0.0.1:1/ledger_unit_offline`（该端口连接被拒绝，`ECONNREFUSED`）。它会覆盖终端导出的值；`@nestjs/config` 以进程变量优先，`.env` 里的连接串也不生效。漏拦截时只会连接失败，不会连上真实库；但不该连库的测试仍要拦截 `DataSource.prototype.initialize` 和 `ConnectionLifecycleService.prototype.ensureConnected`，不靠连接失败兜底。真实数据库测试不能加载这个 setup 文件。

## 运行时约定

- 全局前缀 `/api/v1`。`GET /internal/ready` 不带前缀，Vite 只代理 `/api`，ready 不对公网。
- health 不查库；ready 执行 `SELECT 1`，失败返回 503 `{ "status": "not_ready" }`。
- 当前的连接入口是 `ConnectionLifecycleService.ensureConnected()`：并发只连一次，失败后可重试。
- `.env` 在仓库根，API 的 `ConfigModule` 以 `../../.env` 读取。
- 日志不写连接串、密码、Session Cookie、AI 原始问题、完整请求/响应或账本备注。

## 业务不变量（来自技术方案，做到对应阶段时遵守）

- 金额是「分」的十进制整数字符串 `amountMinor`，全程不经 `Number`，不用浮点乘 100；`BIGINT`/`SUM` 保持字符串或用 `BigInt`。币种 MVP 固定 CNY。
- 月份边界按 `Asia/Shanghai` 算 `[月初, 次月初)` 再转 UTC；`occurredAt` 带时区偏移，存 `timestamptz`。
- 身份只来自服务端会话；body、query、AI 传入的 `userId` 不能用于授权。别人的对象返回 404；列表和报表 SQL 先约束 `user_id`。
- 事务内所有查询共用同一个 `EntityManager` 或 `QueryRunner`，不回退到全局 Repository 或 `DataSource`。
- 错误响应形状为 `error.code/message/requestId/fields`。改 API 契约时同步更新 Controller/Schema、生成的 OpenAPI 和 Web 类型。
