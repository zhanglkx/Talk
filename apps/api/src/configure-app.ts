import { RequestMethod, StandardSchemaValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { rejectMalformedJson } from '@/common/middleware/reject-malformed-json.js'
import {
  readSessionSecret,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_PATHS,
} from '@/modules/auth/session-config.js'
import { PostgresSessionStore } from '@/modules/auth/session-store.js'
import { SessionsRepository } from '@/modules/auth/sessions.repository.js'
import session from 'express-session'

// 参数类型是 Express 版的应用：useBodyParser 只有它才有。
export function configureApp(app: NestExpressApplication): void {
  // 自己注册 JSON 解析器，紧跟着装上它的错误处理（Express 的错误处理只接得住排在它前面的中间件）。
  // Nest 在 init 时发现已有 jsonParser，就不再注册默认的那一个；解析选项与默认相同。
  app.useBodyParser('json')
  app.use(rejectMalformedJson)
  app.useGlobalPipes(new StandardSchemaValidationPipe())
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'internal/ready', method: RequestMethod.GET }],
  })
}
export function configureSession(app: NestExpressApplication): void {
  // 先检查密钥再安装：密钥不合格时直接报错，一个中间件都不装。
  const secret = readSessionSecret(app.get(ConfigService).get<unknown>('SESSION_SECRET'))

  // 复用容器里的 SessionsRepository，也就复用了同一份 DataSource 和 ensureConnected。
  const store = new PostgresSessionStore(app.get(SessionsRepository), SESSION_COOKIE_OPTIONS)

  app.use(
    SESSION_PATHS,
    session({
      name: SESSION_COOKIE_NAME,
      secret,
      store,
      // 没改动的会话不整份重写，只调用 store.touch 续期。
      resave: false,
      // 匿名请求不建会话、不写库、不下发 Cookie；登录成功写入 userId 后才保存。
      saveUninitialized: false,
      cookie: SESSION_COOKIE_OPTIONS,
    }),
  )
}
