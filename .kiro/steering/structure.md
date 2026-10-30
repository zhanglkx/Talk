# 目录与代码约定

## 现有结构（2026-10-30 核对，W01-S6 之后）

- 根目录：`package.json`（`dev`、`build`、`test`、`lint`、`typecheck`、`format`、`format:check`、`prepare` 脚本，`packageManager`、`engines`、`volta`）、`pnpm-workspace.yaml`（`apps/*`，`saveExact: true`）、`pnpm-lock.yaml`（全仓库唯一一份）、`.npmrc`（固定 npm 官方源）、`.gitattributes`（统一 LF 换行）、`.prettierrc.json` 与 `.prettierignore`、`lint-staged.config.mjs`、`commitlint.config.mjs`、`.husky/`（`pre-commit`、`commit-msg`、`prepare-commit-msg` 三个钩子）。
- `apps/api`（包名 `@xinghe/api`）：Nest 12，ESM。
  - `src/main.ts`（启动，只监听 127.0.0.1）、`src/configure-app.ts`（`configureApp`：全局前缀 `api/v1`，启动和测试共用）、`src/app.module.ts`（根模块：`ConfigModule`、`TypeOrmModule`、各业务模块）。
  - `src/config/environment.ts`（`readDatabaseUrl`、`validateEnvironment`：环境变量的读取和校验，API 和命令行工具共用）。
  - `src/database/data-source.ts`（只给 TypeORM 命令行工具用的数据源）、`src/database/migrations/`（`CreateExpenseTypes`、`NameExpenseTypesPrimaryKey`）。
  - `src/health/`（`HealthModule`、`HealthController`：`GET /api/v1/health`）。
  - `src/modules/expense-types/`：`expense-type.entity.ts`（`ExpenseTypeEntity`，映射 `expense_types`）、module、controller（5 个接口的路由）、service（目前是写死的假数据，S7 改为读写数据库）、`dto/create-expense-type.dto.ts`（新增、修改的请求体类型）。
  - 单元测试和被测文件放在一起（`src/health/health.controller.spec.ts`），端到端测试放 `test/*.e2e-spec.ts`（`health.e2e-spec.ts`）；`.env.example`；lint 配置 `.oxlintrc.json`（类型感知，禁止 `any`）。
- `apps/web`（包名 `@xinghe/web`）：React 19 + Vite 8 + Ant Design 6。`src/main.tsx`（入口，引入 Ant Design 的重置样式）、`src/App.tsx`（`ConfigProvider` 中文）、`src/layouts/`（`AppLayout` 页面框架：顶栏、侧边栏、内容区；`ApiStatus` 连接状态）、`src/api/health.ts`（健康检查请求，类型暂时手写）。`vite.config.ts` 配了 `@` 别名和 `/api` 代理；lint 配置 `.oxlintrc.json`（禁止 `any`）。
- 文档：`docs/PRD.md`（业务需求）、`docs/plan/`（`README.md` 总计划、`templates.md` 模板与 Review 清单、`WNN-主题.md` 每周迭代文档）、`docs/adr/`（架构决策记录）。每周验收后按实际结构更新本节。

## 目标结构（W01 之后按实际调整）

- `apps/api/`：业务模块放 `src/modules/<模块>/`（module、controller、service、entity、请求与响应的 schema）；横切逻辑放 `src/common/`；配置放 `src/config/`；migration 放 `src/database/migrations/`。
- `apps/web/`：页面放 `src/pages/`，按业务拆 `src/features/`，页面框架放 `src/layouts/`，请求层放 `src/api/`，自动生成的接口类型放 `src/generated/`（只由生成命令写入，不手改）。
- 测试位置沿用 Nest 模板的做法（单元测试放在被测文件旁边，e2e 放 `test/`），作者想改可以在 W02 写测试前提出；导入别名见下面「约定」。

## 约定

- 导入：两端的代码（包括测试）一律用 `@/` 别名导入本应用 `src/` 下的文件，不写 `./`、`../`。
  - API 是 ESM + NodeNext，别名也要带 `.js` 后缀，例如 `@/app.module.js`；Web 沿用模板写法，写真实扩展名，例如 `@/App.tsx`、`@/App.css`。
  - `public/` 里的文件按网址引用（例如 `/icons.svg`），不走别名；`index.html` 里的 `/src/main.tsx` 同理。
  - 别名配置在两处：API 在 `tsconfig.json` 的 `paths`（Node 运行时不认识别名，由 Nest CLI 构建时改写成相对路径；Vitest 用 `resolve.tsconfigPaths` 读取）；Web 在 `tsconfig.app.json` 的 `paths`（类型检查和编辑器用）和 `vite.config.ts` 的 `resolve.alias`（打包用），这两处要一致。
  - `nest g` 生成的代码（包括它往已有模块里加的导入）用相对路径，生成后要改成 `@/`。作者在 `36f7335` 去掉了 VS Code 自动导入优先用别名的设置，编辑器自动补全的导入可能是相对路径，提交前改成 `@/`（这条约定是否调整，待作者确认）。
- 格式：根目录一份 Prettier 配置，两端共用：不带分号、单引号、行宽 100；Markdown 不自动格式化（`.prettierignore`）。提交前自动格式化暂存的文件。
- 提交信息用中文，格式 `类型: 说明`，类型用约定式提交的类型（feat、fix、docs、style、refactor、test、chore、ci 等），说明写"为什么"；由 commitlint 检查（正文不限行宽）。只改格式的提交用 `style:`，和改逻辑的提交分开。
- 个人项目，直接在 main 上开发并推送，不用功能分支和 PR；每完成一小步提交一次。
- 代码注释用中文，说明"为什么"，不复述代码做了什么。
