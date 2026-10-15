# 目录与代码约定

## 现有结构（2026-10-14 核对）

- `apps/api/src/`：`main.ts`（监听 `127.0.0.1:PORT`，默认 3000）、`app.module.ts`、`configure-app.ts`（全局前缀）、`generate-openapi.ts`（导出契约）、`config/`（环境校验）、`database/`（共享连接配置、连接生命周期、就绪检查、CLI DataSource 工厂与入口、`migrations/`）、`modules/users/`（User 实体）、`health/`、`internal/`。
- `apps/web/src/`：`App.tsx`、`main.tsx`；`src/generated/` 是生成物。
- 测试只放各应用自己的 `test/`：API 为 `apps/api/test/*.spec.ts`，Web 为 `apps/web/test/*.test.tsx`；不放进 `src/` 或仓库根目录。真实数据库测试放 `apps/api/test/integration/`（辅助代码在其 `support/`），只由 `test:db` 运行。
- `docs/openapi.json` 和 `apps/web/src/generated/api-types.ts` 只由 `pnpm contracts` 生成，不手改。
- `docs/superpowers/` 是早期 PostgreSQL 接入的设计与计划，属历史记录；`.cursor/rules/` 是给 Cursor 用的同类规则。

## 目标位置（技术方案 §3；`modules/users/` 与 `database/migrations/` 已有，其余尚未创建）

- 业务模块放 `apps/api/src/modules/<模块>/`：`<模块>.module.ts`、`.controller.ts`、`.service.ts`、`<实体>.entity.ts`、`.repository.ts`、`schemas.ts`。
- 横切逻辑放 `apps/api/src/common/{middleware,guards,filters,interceptors}/`；migration 放 `apps/api/src/database/migrations/`。
- Web 页面与接口客户端放 `apps/web/src/{pages,features,api}/`。DB/HTTP 集成测试与 AI 评测按需放 `apps/api/test/{integration,ai-eval}/`，Web E2E 放 `apps/web/test/e2e/`。

## 代码约定

- 导入路径：两端 `src/` 内用 `@/` 别名指向本应用的 `src/`。别名配置在 `tsconfig.json` 的 `paths` 和 `vitest.config.ts`／`vite.config.ts` 的 `resolve.alias`，两处要一致；API 构建时由 `tsc-alias` 把别名改回相对路径。测试沿用相对路径 `../src/xxx`。
- API 是 ESM + `NodeNext`：本地导入必须写 `.js` 后缀，别名也一样（如 `@/database/data-source.js`），测试里写成 `../src/xxx.js`。Web 用 `Bundler` 解析，导入不写后缀。
- 两端 TypeScript 都是 `strict`。用到 Nest 的测试先 `import 'reflect-metadata'`。
- 格式按 `.prettierrc.json`：无分号、单引号、行宽 100。Markdown 不做自动格式化。
- 现有代码的注释用中文白话说明「为什么」。
- 测试从 `vitest` 显式导入 `describe/it/expect/vi`，用例名用英文，`afterEach` 里恢复 mock。
- 提交信息格式为 `type: 英文描述`（feat、fix、test、docs、chore）。
