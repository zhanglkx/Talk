import { RequestMethod, type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  readSessionSecret,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_PATHS,
} from '@/modules/auth/session-config.js'
import { PostgresSessionStore } from '@/modules/auth/session-store.js'
import { SessionsRepository } from '@/modules/auth/sessions.repository.js'
import session from 'express-session'

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new StandardSchemaValidationPipe())
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'internal/ready', method: RequestMethod.GET }],
  })
}
export function configureSession(app: INestApplication): void {
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
