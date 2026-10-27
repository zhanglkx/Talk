# 目录与代码约定

## 现有结构（2026-10-27 核对）

- 仓库目前只有文档：`docs/PRD.md`（业务需求）、`docs/plan/`（`README.md` 总计划、`templates.md` 模板与 Review 清单、`WNN-主题.md` 每周迭代文档）、`docs/adr/`（架构决策记录）。
- 代码从 W01 开始由作者在 `apps/api`、`apps/web` 从零搭建；每周验收后按实际结构更新本节。

## 目标结构（W01 之后按实际调整）

- `apps/api/`：业务模块放 `src/modules/<模块>/`（module、controller、service、entity、请求与响应的 schema）；横切逻辑放 `src/common/`；配置放 `src/config/`；migration 放 `src/database/migrations/`。
- `apps/web/`：页面放 `src/pages/`，按业务拆 `src/features/`，请求层放 `src/api/`，自动生成的接口类型放 `src/generated/`（只由生成命令写入，不手改）。
- 测试文件的位置、导入别名、格式化规则由作者在 W01 确定后写进本节。

## 约定

- 提交信息用中文，格式 `类型: 说明`（feat、fix、docs、chore、refactor、test），说明写"为什么"；W01 起由 commitlint 检查。
- 每个功能一个分支，经 PR 合并到 main；不在 main 上直接写功能代码。
- 代码注释用中文，说明"为什么"，不复述代码做了什么。
