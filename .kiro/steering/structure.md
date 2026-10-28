# 目录与代码约定

## 现有结构（2026-10-28 核对，W01-S2 之后）

- 根目录：`package.json`（`dev`、`build`、`test` 三个脚本，`packageManager`、`engines`、`volta`）、`pnpm-workspace.yaml`（`apps/*`，`saveExact: true`）、`pnpm-lock.yaml`（全仓库唯一一份）、`.npmrc`（固定 npm 官方源）、`.gitattributes`（统一 LF 换行）。
- `apps/api`（包名 `@xinghe/api`）：Nest CLI 12 脚手架，ESM；`src/` 里只有脚手架自带的 `AppModule`、`AppController`、`AppService`；单元测试 `src/*.spec.ts`，端到端测试 `test/*.e2e-spec.ts`。
- `apps/web`（包名 `@xinghe/web`）：create-vite 9 的 `react-ts` 模板，页面还是模板自带的示例页。
- 文档：`docs/PRD.md`（业务需求）、`docs/plan/`（`README.md` 总计划、`templates.md` 模板与 Review 清单、`WNN-主题.md` 每周迭代文档）、`docs/adr/`（架构决策记录）。每周验收后按实际结构更新本节。

## 目标结构（W01 之后按实际调整）

- `apps/api/`：业务模块放 `src/modules/<模块>/`（module、controller、service、entity、请求与响应的 schema）；横切逻辑放 `src/common/`；配置放 `src/config/`；migration 放 `src/database/migrations/`。
- `apps/web/`：页面放 `src/pages/`，按业务拆 `src/features/`，请求层放 `src/api/`，自动生成的接口类型放 `src/generated/`（只由生成命令写入，不手改）。
- 测试文件的位置、导入别名、格式化规则由作者在 W01 确定，助手在验收后写进本节。

## 约定

- 提交信息用中文，格式 `类型: 说明`，类型用约定式提交的类型（feat、fix、docs、refactor、test、chore、ci 等），说明写"为什么"；W01-S3 起由 commitlint 检查。
- 个人项目，直接在 main 上开发并推送，不用功能分支和 PR；每完成一小步提交一次。
- 代码注释用中文，说明"为什么"，不复述代码做了什么。
