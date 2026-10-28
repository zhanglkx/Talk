# 技术约束

核对于 2026-10-27。W01 完成前仓库里还没有代码；之后命令和版本以各 `package.json` 为准，并在本文件补充「命令实情」。

## 技术栈

- 前端：React 19 + TypeScript + Vite；Ant Design 6；React Router（单页应用用法，不用 framework 模式）；TanStack Query；Zustand；axios；ECharts（W9）；接口类型由 OpenAPI 生成（W2 起）。
- 后端：NestJS 12（Express 适配器，脚手架默认 ESM）+ TypeORM + PostgreSQL；Zod 校验（W2）；@nestjs/jwt + Argon2id（W3）；Swagger 生成 OpenAPI。
- 工程：pnpm monorepo（`apps/web`、`apps/api`）；oxlint + Prettier（两个官方脚手架的默认）；husky + lint-staged + commitlint；Vitest + Supertest；Playwright（W11）。

## 版本

- Node 26.12.1：根 `package.json` 的 `engines` 声明，本机用 Volta 的 `volta.node` 固定；26.x 于 2026-10-28 进入 LTS。
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
- 一个 PostgreSQL 数据库；表结构只通过 migration 修改，`synchronize: false`，应用启动时不自动执行 migration。
- 配置从环境变量读取并在启动时校验；`.env` 不提交，提供 `.env.example`。
- 金额以分为单位的整数存储，计算不用浮点数；时间存 `timestamptz`，按月统计用 Asia/Shanghai。
- 身份只来自服务端校验过的 token；前端传来的用户 ID、角色、总金额都不可信。权限在后端校验，前端只控制显示。
- 统一接口前缀 `/api/v1`；开发时由 Vite 转发、上线后由 Nginx 转发，不开 CORS。开发时服务只监听 `127.0.0.1`。
- 日志不记录密码、token、Cookie、发票内容和完整请求体。
