# 个人账本与 AI 分析助手

个人学习项目：用虚构账单练习「浏览器 → NestJS API → PostgreSQL → 测试与契约」这条链路。不是支付系统、理财建议产品或生产财务系统，仓库里只使用虚构数据。

当前基线是应用骨架，不是完整账本。已接入：

- pnpm 工作区：`apps/api`（NestJS）与 `apps/web`（React + Vite）
- 本机 PostgreSQL，经单一 `DATABASE_URL` 连接；`synchronize: false`、`migrationsRun: false`，启动不自动建表或迁移
- `GET /api/v1/health` 存活检查（不查库），`GET /internal/ready` 就绪检查（`SELECT 1`，失败返回 503）
- OpenAPI 产物 `docs/openapi.json`，以及由它生成的 Web 类型

已有 users 表的实体、第一个 migration 和给 TypeORM CLI 用的连接入口。这份 migration 已在专用测试库 `ledger_it` 上由 `test:db` 真实执行并验证；开发库还没有执行过，也还没有给开发库用的迁移脚本。认证、分类、流水、月报、CI、部署和 AI 问答尚未实现。阶段进度与验收见 [学习计划](docs/plan/README.md)。

## 技术栈

| 层 | 选择 |
|---|---|
| Web | React 19、TypeScript、Vite |
| API | Node.js 26.11.1、NestJS 12、Express 适配器 |
| 数据 | 本机 PostgreSQL、`@nestjs/typeorm`、TypeORM、`pg` |
| 包管理 | pnpm 12.10.1 |

不使用 Docker、Redis，也不引入第二套 ORM 或业务框架。

## 本地运行

需要本机已安装 Node.js `26.11.1`、pnpm `12.10.1` 和 PostgreSQL。可用 Volta 对齐 `package.json` 里锁定的版本。

```bash
pnpm install
cp .env.example .env
```

`.env` 只需要一个连接串，且必须带数据库名：

```bash
DATABASE_URL=postgresql://127.0.0.1:5432/postgres
```

```bash
pnpm dev
```

- API 监听 `http://127.0.0.1:3000`（可用 `PORT` 覆盖）
- Web 开发服务器默认 `http://127.0.0.1:5173`，并把 `/api` 代理到 API

打开 Web 后应看到「API 已连接」。直接检查：

```bash
curl http://127.0.0.1:3000/api/v1/health
curl http://127.0.0.1:3000/internal/ready
```

## 常用命令

在仓库根目录执行：

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 并行启动 API 与 Web |
| `pnpm contracts` | 重新生成 OpenAPI，并据此生成 Web 类型 |
| `pnpm typecheck` | API 与 Web 类型检查 |
| `pnpm test` | Web 单元测试（目前不含 API） |
| `pnpm --filter @ledger/api test` | API 单元与 HTTP 测试；其中契约测试会真的跑 `pnpm contracts`，重建 `apps/api/dist`（正在运行的 `pnpm dev` 会因此重启 API）并重写两份生成文件 |
| `DATABASE_URL=postgresql://127.0.0.1:5432/ledger_it ALLOW_DATABASE_RESET=ledger_it pnpm --filter @ledger/api run test:db` | 真实 PostgreSQL 集成测试：先删除并重建 `ledger_it`，再构建 API、执行 migration 并检查表结构；只接受本机的 `ledger_it`，运行时不能有其他连接占用该库 |
| `pnpm build` | 构建 API 与 Web |
| `pnpm check` | 依次跑 contracts、typecheck、`pnpm test`、build；不含 API 测试 |

`pnpm test` 和 API 测试都不连接数据库；API 测试固定使用一个连不上的本机地址，不使用 `.env` 里的连接串。真实数据库测试只走 `test:db`，第一次运行前要先建好测试库：`createdb ledger_it`。进度与证据见 [M1 进度](docs/plan/M1/README.md)。

## 目录

```text
apps/api/     NestJS API
apps/web/     React Web
docs/         PRD、技术方案、OpenAPI、分阶段学习计划
patches/      依赖补丁
```

## 文档

- [产品需求](docs/PRD-fullstack-ai-ledger.md)
- [技术方案](docs/TECH-PLAN-fullstack-ai-ledger.md)
- [七阶段学习计划（M1–M7）](docs/plan/README.md)

学习计划从 2026-10-12 起，按 M1 认证与数据库、M2 分类与流水、M3 生命周期与月报、M4 质量门、M5 交付与观测、M6 只读 AI、M7 评测与交付推进。前置阶段未通过时不跳到下一阶段。文档里的目标接口和命令是计划，不表示已经实现。
