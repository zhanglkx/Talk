# 技术约束

核对于 2026-10-30（W01-S6）。命令和版本以各 `package.json` 为准。

## 命令实情

- `pnpm dev`：并行启动 API（`nest start --watch`，只监听 `127.0.0.1:3000`，接口前缀 `/api/v1`，健康检查 `GET /api/v1/health`）和 Web（Vite，端口 5173，监听 `[::1]`，把 `/api` 开头的请求转发到 `http://127.0.0.1:3000`）。按 Ctrl+C 会两端一起停；要单独停一端，就分两个终端运行 `pnpm --filter @xinghe/api dev`、`pnpm --filter @xinghe/web dev`。
- API 只监听 127.0.0.1 写死在 `main.ts`。W10 放进 Docker 后，容器外访问不到只监听 127.0.0.1 的服务，要改成从配置读取监听地址（容器里用 0.0.0.0）。
- `pnpm build`：两端构建；`pnpm test`：API 单元测试；`pnpm --filter @xinghe/api run test:e2e`：API 端到端测试；`pnpm typecheck`：两端完整类型检查。API 的 `nest build` 跳过测试文件，Vitest 运行时也不检查类型，所以测试文件里的类型错误只有 `pnpm typecheck` 能发现。
- 数据库配置：API 从当前目录的 `.env` 读取 `DATABASE_URL`（用 pnpm 脚本启动时就是 `apps/api/.env`，照 `apps/api/.env.example` 复制，不提交），已有的环境变量优先；`src/config/environment.ts` 在启动时校验，缺少、为空都会立刻报错退出。API 启动时要连上数据库：PostgreSQL 没开时 `@nestjs/typeorm` 默认重试 10 次、每次隔 3 秒，大约 30 秒后才放弃，这期间健康检查也访问不了。
- migration 脚本（在仓库根目录运行）：`pnpm --filter @xinghe/api run migration:generate src/database/migrations/<名称>`（按实体和数据库的差异生成）、`migration:create src/database/migrations/<名称>`（生成空文件，手写 TypeORM 比较不出来的改动，例如约束改名）、`migration:run`、`migration:revert`（回滚最近执行的一个）、`migration:show`。除 `migration:create` 外都会先构建，再加载 `dist/database/data-source.js`。TypeORM 命令行工具本身不读 `.env`，脚本用 `node --env-file-if-exists=.env` 读取；数据源缺少 `DATABASE_URL` 时直接报错，不会连到别的库。
- e2e 测试 `test/health.e2e-spec.ts` 只导入 `HealthModule`，不连数据库，也不需要 `.env`。
- Web 打包后的 JS 约 540 kB（gzip 后约 180 kB，主要是 Ant Design），Vite 会提示单个文件超过 500 kB。这是预期的，W10 做路由懒加载和拆包时处理。
- `pnpm lint`：两端 oxlint（两端都禁止 `any`）；`pnpm format` / `pnpm format:check`：用根目录 Prettier 格式化 / 检查整个仓库。
- 提交钩子（husky，`core.hooksPath=.husky/_`）：`pre-commit` 跑 lint-staged（Prettier 只改暂存的文件；暂存了某一端的 TS 文件就对那一端跑一次完整的 oxlint）；`commit-msg` 跑 commitlint；`prepare-commit-msg` 删除 Cursor 自动加的 `Co-authored-by` 行。
- 根 `package.json` 的 `prepare` 脚本会在 `pnpm install` 时运行 `husky`。W10 做 Docker 生产镜像时不装开发依赖，要用 `HUSKY=0` 或 `--ignore-scripts` 跳过它，否则安装会失败。
- 本机的 `git` 命令经过 git-ai 代理：它会给每个提交写 AI 记录（`refs/notes/ai`），推送时同步到 GitHub。公司定制版不允许排除仓库，作者已接受这些记录留在远程。钩子照常执行（S3 已验证）。
- 依赖从 npm 官方源安装（项目 `.npmrc`）；本机全局的 npm/pnpm 源是公司内部镜像，不要让项目依赖它。
- 全局的 `nest` 命令是 Volta 装的 11.0.12，版本不对，不要用；用项目里的 CLI：`pnpm --filter @xinghe/api exec nest ...`。

## 技术栈

- 前端：React 19 + TypeScript + Vite；Ant Design 6；React Router（单页应用用法，不用 framework 模式）；TanStack Query；Zustand；axios；ECharts（W9）；接口类型由 OpenAPI 生成（W2 起）。
- 后端：NestJS 12（Express 适配器，脚手架默认 ESM）+ TypeORM + PostgreSQL；Zod 校验（W2）；@nestjs/jwt + Argon2id（W3）；Swagger 生成 OpenAPI。
- 工程：pnpm monorepo（`apps/web`、`apps/api`）；oxlint + Prettier（两个官方脚手架的默认）；husky + lint-staged + commitlint；Vitest + Supertest；Playwright（W11）。

## 版本

- Node 26.12.1：根 `package.json` 的 `engines` 声明，本机用 Volta 的 `volta.node` 固定。按 Node 发布计划，26.x 的首个 LTS 版本 2026-10-28 发布；发布满一天后升级到它（改 `engines` 和 `volta.node` 两处），之后只用 LTS 版本。
- pnpm 12.15.0：写在根 `package.json` 的 `packageManager`，pnpm 自动下载并切换。不要 `volta pin pnpm`：Volta 已于 2025-11 停止维护，2.0.2 启动不了 pnpm 12.15.0（缺 `bin/pnpm.cjs`）。
- TypeScript 两端统一 6.0.3：Nest CLI 依赖 6.0.x，openapi-typescript 不支持 7.x，create-vite 模板默认带的 7.x 要改掉。openapi-typescript 7.13.0 声明的 peer 是 `typescript ^5`，配 6.0.3 能正常生成类型，只有 peer 依赖警告。升级 TypeScript 前先核对这两个工具。
- 依赖写精确版本（不带 `^`、`~`），取最新稳定版；不绕过 pnpm 默认一天的发布冷却期（`minimumReleaseAge`），`pnpm-workspace.yaml` 里不留 `minimumReleaseAgeExclude`。确实要立刻装新版本（例如紧急安全修复）时才显式加例外，并在提交信息里写明原因。
- 以上组合 2026-10-27 已在临时目录验证：两端构建、lint 和 Nest 自带的测试通过。

## 按周引入，不提前

- 本机已有：PostgreSQL 18.6、Redis 8.10.2（Homebrew）；Node 26.12.1 已用 `volta fetch` 下载（全局默认仍是 26.11.1）。开发库 `expense_dev`（UTF8）。
- W8 起：Redis 接入、Nginx（Homebrew 安装）、两个 API 实例。W9 起：BullMQ 与独立 worker 进程。W10 起：Docker（OrbStack 或 Colima）+ compose、对象存储。W11 起：GitHub Actions。W12 起：pgvector 与模型 API。
- 要提前用到这些时，先说明原因并经作者同意。

## 硬约束

- 单体：一个 NestJS API（W9 起可另有一个共用代码的 worker 进程）+ 一个 React Web。不拆微服务，不引入 GraphQL、Kafka/RabbitMQ、第二套 ORM、SSR。
- 一个 PostgreSQL 数据库；表结构只通过 migration 修改，`synchronize: false`，应用启动时不自动执行 migration。已提交、推送的 migration 不再修改，要改就新写一个往前改。
- 配置从环境变量读取并在启动时校验；`.env` 不提交，提供 `.env.example`。
- 金额以分为单位的整数存储，计算不用浮点数。时间点（如提交、打款时间）存 `timestamptz`；只有日期的字段（如费用发生日期）存 `date`，不要存成 `timestamptz`，否则按另一个时区显示时会差一天。按天、按月的边界一律按 Asia/Shanghai 计算。
- 身份只来自服务端校验过的 token；前端传来的用户 ID、角色、总金额都不可信。权限在后端校验，前端只控制显示。
- 统一接口前缀 `/api/v1`；开发时由 Vite 转发、上线后由 Nginx 转发，不开 CORS。开发时服务只监听 `127.0.0.1`。
- 日志不记录密码、token、Cookie、发票内容和完整请求体。
