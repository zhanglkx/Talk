# 目录与代码约定

## 现有结构（2026-10-30 核对，W01-S7 之后）

- 根目录：`package.json`（`dev`、`build`、`test`、`lint`、`typecheck`、`format`、`format:check`、`prepare` 脚本，`packageManager`、`engines`、`volta`）、`pnpm-workspace.yaml`（`apps/*`，`saveExact: true`）、`pnpm-lock.yaml`（全仓库唯一一份）、`.npmrc`（固定 npm 官方源）、`.gitattributes`（统一 LF 换行）、`.prettierrc.json` 与 `.prettierignore`、`lint-staged.config.mjs`、`commitlint.config.mjs`、`.husky/`（`pre-commit`、`commit-msg`、`prepare-commit-msg` 三个钩子）。两个应用的 `package.json` 都有 `"volta": { "extends": "../../package.json" }`，Node 版本跟根目录一致。
- `apps/api`（包名 `@xinghe/api`）：Nest 12，ESM。
  - `src/main.ts`（启动，只监听 127.0.0.1）、`src/configure-app.ts`（`configureApp`：全局前缀 `api/v1`，启动和测试共用）、`src/app.module.ts`（根模块：`ConfigModule`、`TypeOrmModule`、各业务模块）。
  - `src/config/environment.ts`（`readDatabaseUrl`、`validateEnvironment`：环境变量的读取和校验，API 和命令行工具共用）。
  - `src/database/data-source.ts`（只给 TypeORM 命令行工具用的数据源）、`src/database/migrations/`（`CreateExpenseTypes`、`NameExpenseTypesPrimaryKey`）。
  - `src/health/`（`HealthModule`、`HealthController`：`GET /api/v1/health`）。
  - `src/modules/expense-types/`：`expense-type.entity.ts`（`ExpenseTypeEntity`，映射 `expense_types`）、module（`TypeOrmModule.forFeature` 注册实体）、controller（5 个接口的路由，路径里的 id 经过 `ParseUUIDPipe`）、service（业务规则，通过注入的 Repository 读写数据库）、`dto/create-expense-type.dto.ts`、`dto/update-expense-type.dto.ts`（新增、修改的请求体类型，本周只是 TypeScript 类型）。
  - 单元测试和被测文件放在一起（`src/health/health.controller.spec.ts`），端到端测试放 `test/*.e2e-spec.ts`（`health.e2e-spec.ts`）；`.env.example`；lint 配置 `.oxlintrc.json`（类型感知，禁止 `any`）。
- `apps/web`（包名 `@xinghe/web`，11-03 更新）：React 19 + Vite 8 + Ant Design 6 + React Router 8。`src/main.tsx`（入口、BrowserRouter 和重置样式）、`src/App.tsx`（中文 ConfigProvider、嵌套路由和 404）、`src/layouts/`（页面框架、Outlet 和 API 连接状态）、`src/pages/ExpenseTypesPage.tsx`（待接列表）。`src/api/index.ts` 是请求模块公共入口，`http/` 统一 Axios、超时、取消和错误，`health/` 与 `expense-types/` 各自维护 API 和类型，使用方法见 `src/api/README.md`。`test/http.spec.ts` 是无需业务数据库的 HTTP 契约测试，Vitest 配置复用 Vite 别名，`tsconfig.test.json` 纳入测试类型检查。`vite.config.ts` 配了 `@` 别名和 `/api` 代理；oxlint 禁止 `any` 并检查请求模块边界。
- 文档：`docs/PRD.md`（业务需求）、`docs/plan/`（`README.md` 总计划、`templates.md` 模板与 Review 清单、`WNN-主题.md` 每周迭代文档）、`docs/adr/`（架构决策记录）。每周验收后按实际结构更新本节。

## 目标结构（W01 之后按实际调整）

- `apps/api/`：业务模块放 `src/modules/<模块>/`（module、controller、service、entity、请求与响应的 schema）；横切逻辑放 `src/common/`；配置放 `src/config/`；migration 放 `src/database/migrations/`。
- `apps/web/`：页面放 `src/pages/`，按业务拆 `src/features/`，页面框架放 `src/layouts/`，请求层放 `src/api/`，自动生成的接口类型放 `src/generated/`（只由生成命令写入，不手改）。
- 测试位置沿用 Nest 模板的做法（单元测试放在被测文件旁边，e2e 放 `test/`），作者想改可以在 W02 写测试前提出；导入别名见下面「约定」。

## 约定

- 全部新增与修改代码遵守根目录 `AGENTS.md` 的「模块化」约定。前端调用链固定为页面 / Hook → `@/api/index.ts` 的业务 API → `src/api/http/` 公共 HTTP 客户端，接口路径、请求与响应类型按业务目录集中维护；公共层不依赖 UI 或路由。前端请求边界已纳入 oxlint 检查。

- 导入：两端的代码（包括测试）一律用 `@/` 别名导入本应用 `src/` 下的文件，不写 `./`、`../`。
  - API 是 ESM + NodeNext，别名也要带 `.js` 后缀，例如 `@/app.module.js`；Web 沿用模板写法，写真实扩展名，例如 `@/App.tsx`、`@/App.css`。
  - `public/` 里的文件按网址引用（例如 `/icons.svg`），不走别名；`index.html` 里的 `/src/main.tsx` 同理。
  - 别名配置在两处：API 在 `tsconfig.json` 的 `paths`（Node 运行时不认识别名，由 Nest CLI 构建时改写成相对路径；Vitest 用 `resolve.tsconfigPaths` 读取）；Web 在 `tsconfig.app.json` 的 `paths`（类型检查和编辑器用）和 `vite.config.ts` 的 `resolve.alias`（打包用），这两处要一致。
  - `nest g` 生成的代码（包括它往已有模块里加的导入）用相对路径，生成后要改成 `@/`。VS Code 的自动导入设为优先用别名（`.vscode/settings.json`，作者 10-30 确认继续使用）。
- 接口：路径参数里的 UUID 一律经过 Nest 自带的 `ParseUUIDPipe`，格式不对返回 400，不把非法值传给数据库（否则 `uuid` 列解析失败，接口返回 500）。
- 格式：根目录一份 Prettier 配置，两端共用：不带分号、单引号、行宽 100；Markdown 不自动格式化（`.prettierignore`）。提交前自动格式化暂存的文件。
- 提交信息用中文，格式 `类型: 说明`，类型用约定式提交的类型（feat、fix、docs、style、refactor、test、chore、ci 等），说明写"为什么"；由 commitlint 检查（正文不限行宽）。只改格式的提交用 `style:`，和改逻辑的提交分开。
- 个人项目，直接在 main 上开发并推送，不用功能分支和 PR；每完成一小步提交一次。
- 代码注释用中文，说明"为什么"，不复述代码做了什么。
