# 前端请求模块

调用方向：页面 / 业务 Hook → `@/api/index.ts` → 业务 API → `http/client.ts` → Axios。

- `http/client.ts`：唯一的公共 HTTP 客户端，统一 `/api/v1` 前缀、10 秒默认超时、JSON 请求与响应、204 空响应和 AbortSignal；每次调用发送一次请求，重试由调用层按业务语义决定。
- `http/errors.ts`：将错误转为 `ApiError`，保留 `kind`、HTTP `status`、服务端提供的 `code` 和 `requestId`。兼容当前 Nest 错误和校验提示数组；5xx 使用统一提示。错误对象不保存原始请求体和认证配置。
- `health/`、`expense-types/`：按业务集中维护接口方法和类型；内部通过具体路径导入 HTTP 客户端，避免公共入口的循环依赖。
- `index.ts`：页面与业务 Hook 的公共入口，显式导出业务 API、类型和公共错误，不导出 HTTP 实例。

## 调用

```ts
import { expenseTypesApi } from '@/api/index.ts'

const rows = await expenseTypesApi.list()
const created = await expenseTypesApi.create({ name: '差旅', description: '虚构出差费用' })
```

接入 TanStack Query 时，将它提供的 `signal` 透传给 `expenseTypesApi.list({ signal })`，组件卸载或查询取消时即可终止请求。

请求选项支持 `signal`、`timeout`、`params`、`headers`；这些选项不能覆盖统一地址、HTTP 方法和响应解析方式。JSON 请求头由 Axios 按请求体设置，传入 FormData 时自动生成 multipart boundary。

## 错误处理

从公共入口导入 `ApiError` 和 `isRequestCanceled`。捕获后通过 `error instanceof ApiError` 收窄类型：

- `kind === 'http'`：按 `status` 判断；例如 409 在名称字段显示重名反馈，其他错误根据页面需要展示。
- `kind === 'timeout'` 或 `network`：展示提示，并提供用户主动重试。
- `isRequestCanceled(error)`：属于主动取消，结束对应操作即可。
- `kind === 'invalid-response'`：服务端成功响应不是合法 JSON。

请求层只返回数据或抛出错误。表单反馈、通知、登录跳转等行为由 UI 或认证业务模块处理。

## 新增接口

在 `src/api/<业务>/` 中定义接口方法与类型，复用公共客户端，再从 `src/api/index.ts` 显式导出。当前类型手写，W2 接入 OpenAPI 时由业务模块引用生成类型，页面调用入口保持稳定。

`pnpm --filter @xinghe/web test` 运行本机虚构 HTTP 服务上的契约测试，不依赖真实 API、数据库或 `.env`；`pnpm typecheck` 同时检查测试类型。`pnpm lint` 检查直接使用请求库和页面越过业务 API 的行为。
