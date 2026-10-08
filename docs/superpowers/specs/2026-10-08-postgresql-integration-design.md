# PostgreSQL 最小接入设计

- 日期：2026-10-08
- 状态：已批准
- 适用仓库：`ledger-workspace`

## 1. 目标

在不使用 Docker 的前提下，为现有 NestJS/Vite monorepo 完成以下改造：

1. 将 Node.js、pnpm 及仓库全部 npm 依赖升级到实施时可获得的最新稳定版，不使用 beta、rc、canary 等预发布版本。
2. 在根 `package.json` 的 `volta` 字段精确固定 Node.js 和 pnpm，并使 `engines`、`packageManager` 与固定版本一致。
3. 使用 `@nestjs/typeorm`、`typeorm` 和 `pg` 将 NestJS API 接入本机 PostgreSQL。
4. 保留 `GET /api/v1/health` 作为纯进程存活检查，新增 `GET /internal/ready` 作为数据库就绪检查。
5. `DATABASE_URL` 缺失或格式错误时拒绝启动；URL 已配置但数据库不可达时允许 API 启动，由 readiness 返回 503。

## 2. 非目标

本次不创建业务 Entity、业务表、migration、Repository 或种子数据，不实现用户、分类、流水和报表功能，不引入 Docker/Docker Compose，也不启用 TypeORM 自动同步 Schema。

## 3. 技术决策

### 3.1 依赖与工具链

升级分成两个连续阶段：

1. 先升级 Node.js、pnpm 和全部现有依赖，更新 lockfile，修复兼容性问题并通过原有检查。
2. 再加入 PostgreSQL/TypeORM 依赖和最小数据库模块，避免混淆依赖升级回归与数据库接入问题。

所有版本使用精确版本。版本选择以实施时官方发布页或 npm registry 的 `latest` 稳定标签为准。若最新稳定依赖之间出现实际兼容性错误，不静默降级；先确认错误证据，再调整实现或明确记录阻塞。

### 3.2 配置

新增 `@nestjs/config`，从单个 `DATABASE_URL` 读取连接信息。配置校验只接受 `postgres://` 或 `postgresql://` URL。缺失或非法时在 HTTP 监听前失败，错误消息不得回显连接串。

仓库提供 `.env.example`，只包含无真实凭据的示例。`.env` 和 `.env.*` 继续由 `.gitignore` 排除。

### 3.3 TypeORM 初始化

`TypeOrmModule.forRootAsync()` 创建默认且唯一的 `DataSource`：

- `type: 'postgres'`
- `url: DATABASE_URL`
- `manualInitialization: true`
- `synchronize: false`
- `migrationsRun: false`
- 不配置 Entity
- 连接和探测采用有界超时，目标为 3 秒

使用 `manualInitialization: true`，使 Nest 能在 PostgreSQL 离线时完成启动。当前 NestJS TypeORM 实现会返回未初始化的 `DataSource`，而不是在模块加载阶段调用 `initialize()`。

### 3.4 Readiness

`DatabaseReadinessService` 负责：

1. 如果 `DataSource` 尚未初始化，调用 `initialize()`。
2. 用共享初始化 Promise 合并并发请求，防止重复连接竞态。
3. 初始化成功后执行固定查询 `SELECT 1`。
4. 初始化失败时清除共享 Promise，允许下次 readiness 请求重试。
5. 将结果映射为简单布尔状态，不向 Controller 暴露连接串或底层异常。

`GET /internal/ready`：

- 数据库可连接且探测成功：`200 {"status":"ready"}`。
- 初始化、认证、网络或查询失败：`503 {"status":"not_ready"}`。

现有 `GET /api/v1/health` 不访问数据库，并在数据库不可用时继续返回 `200 {"status":"ok"}`。

`configureApp()` 将 `internal/ready` 排除在全局 `api/v1` 前缀之外。应用启用 shutdown hooks；关闭时由 Nest TypeORM 集成销毁已初始化的 `DataSource`。

## 4. 组件与文件边界

预计新增或修改：

- 根 `package.json`：Volta、engines、packageManager 和脚本/版本调整。
- `apps/api/package.json`、`apps/web/package.json`、`pnpm-lock.yaml`：全部稳定依赖升级和数据库依赖。
- `.env.example`：本机 PostgreSQL URL 示例。
- `apps/api/src/config/*`：环境变量解析和校验。
- `apps/api/src/database/database.module.ts`：TypeORM 组装。
- `apps/api/src/database/database-readiness.service.ts`：惰性初始化、并发去重和探测。
- `apps/api/src/internal/*`：内部 readiness Controller/Module。
- `apps/api/src/app.module.ts`：注册配置、数据库和内部模块。
- `apps/api/src/configure-app.ts`：全局前缀排除规则。
- `apps/api/src/main.ts`：优雅关闭。
- API 测试文件：配置、服务、HTTP 和真实数据库 smoke test。
- `docs/PRD-fullstack-ai-ledger.md`、`docs/TECH-PLAN-fullstack-ai-ledger.md`：将原生 `pg`、无 ORM 和 Docker Compose 的旧决定改为 TypeORM、本机 PostgreSQL 与 `DATABASE_URL`。

模块保持单一职责：配置模块只验证输入；数据库模块只管理 `DataSource`；readiness 服务只检测依赖；Controller 只映射 HTTP 状态和响应体。

## 5. 错误与安全

- URL 缺失或协议非法：配置错误，启动失败。
- URL 合法但 PostgreSQL 离线、认证失败或超时：API 继续运行，readiness 返回 503。
- HTTP 响应不得包含主机、端口、数据库名、用户名、密码、堆栈或驱动错误。
- 日志只记录稳定的错误类别或非敏感错误码，不打印完整异常对象或 `DATABASE_URL`。
- `synchronize` 始终为 `false`，避免自动修改本机数据库。
- readiness 查询是固定常量，不接受用户输入。

## 6. 测试与验收

### 6.1 自动测试

1. 配置测试覆盖 URL 缺失、协议错误和合法 PostgreSQL URL。
2. Readiness 服务测试覆盖首次初始化、已初始化探测、初始化失败、查询失败、并发去重和失败后重试。
3. HTTP 测试验证：
   - `/api/v1/health` 不依赖数据库；
   - `/internal/ready` 成功时返回 200；
   - 数据库失败时返回 503；
   - `/api/v1/internal/ready` 返回 404。
4. OpenAPI 生成、TypeScript 类型检查、Vitest 和生产构建全部通过。

普通自动测试使用 Provider 替身，不要求本机数据库在线。测试进程提供合法但不含真实凭据的测试 URL，以满足启动配置校验。

### 6.2 真实 PostgreSQL smoke test

单独脚本读取本机 `.env` 的 `DATABASE_URL`，仅连接并执行 `SELECT 1`，不创建、修改或删除任何数据库对象。该测试不用 Docker，也不依赖业务 Schema。

### 6.3 验收场景

- 未设置 `DATABASE_URL`：API 启动失败。
- 配置合法 URL 但停止本机 PostgreSQL：API 能启动；health 为 200；readiness 为 503。
- 启动本机 PostgreSQL：无需重启 API，下一次 readiness 变为 200。
- 正常退出 API：已建立的连接池被关闭。
- `pnpm check` 和真实 PostgreSQL smoke test 均通过。

## 7. 后续演进

最小原型通过后，再单独设计并逐步加入 migration、首个 Entity、Repository、事务和业务模块。后续仍应保留数据库约束、显式事务、参数化查询、索引验证和真实 PostgreSQL 集成测试；采用 TypeORM 不代表可以依赖 `synchronize` 或忽略 SQL 行为。
