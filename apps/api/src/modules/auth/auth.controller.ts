import { randomBytes } from 'node:crypto'
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiBadRequestResponse, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import type { z } from 'zod'
import { AuthService } from '@/modules/auth/auth.service.js'
import { LoginBodySchema, LoginResponseSchema, MeResponseSchema } from '@/modules/auth/schemas.js'
import { Public } from '@/common/guards/auth.guard.js'

type LoginBody = z.infer<typeof LoginBodySchema>
type LoginResponse = z.infer<typeof LoginResponseSchema>

@Controller('auth')
export class AuthController {
  // AuthService 必须是值导入：Nest 靠编译时记下的参数类型决定注入什么。
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // 响应里有身份信息，浏览器和中间代理都不能缓存；对 401 也生效。
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description: 'Logged in; the session cookie is set',
    standardSchema: LoginResponseSchema,
  })
  @ApiBadRequestResponse({ description: 'The request body is invalid' })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  async login(
    // 全局 StandardSchemaValidationPipe 按这个 Schema 检查：不合格直接 400，不会走到这里。
    @Body({ schema: LoginBodySchema }) body: LoginBody,
    @Req() request: Express.Request,
  ): Promise<LoginResponse> {
    // 先校验凭据，失败时不碰会话：不下发 Cookie，也不删掉浏览器已有的会话。
    const user = await this.authService.verifyCredentials(body.username, body.password)
    if (user === null) {
      // 用户不存在和密码错误用同一句话，不泄露账号是否存在。
      throw new UnauthorizedException('Invalid username or password')
    }

    try {
      // 轮换会话 ID：删掉旧 ID 的会话再生成新 ID，登录前被别人塞进来的 ID 随之作废（防会话固定）。
      await regenerateSession(request)
      // regenerate 之后 request.session 是一个新对象，必须写在这里，不能写进之前存下的旧引用。
      request.session.userId = user.id
      request.session.csrfToken = randomBytes(32).toString('base64url')
      // 显式保存，确认写进数据库后才返回 200。只靠响应结束时的自动保存，存失败了客户端照样拿到 200。
      await saveSession(request)
    } catch (error) {
      // 只要 request.session 还在且被改过，express-session 会在错误响应里也带上 Set-Cookie，
      // 浏览器就会拿到一个库里不存在的会话。去掉它，错误响应就不带 Cookie。
      Reflect.deleteProperty(request, 'session')
      throw error
    }

    // 只挑公开字段；csrfToken 不放进响应。
    return { user: { id: user.id, username: user.username } }
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description: 'The current user and CSRF token',
    standardSchema: MeResponseSchema,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async me(@Req() request: Express.Request) {
    const { userId, csrfToken } = request.session
    if (typeof userId !== 'string' || typeof csrfToken !== 'string') {
      throw new UnauthorizedException('Authentication required')
    }
    const user = await this.authService.findSessionUser(userId)
    if (user === null) {
      throw new UnauthorizedException('Authentication required')
    }
    return { user: { id: user.id, username: user.username }, csrfToken }
  }
}

// express-session 的 regenerate/save 是回调风格，包成 Promise 才能 await。
function regenerateSession(request: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error: unknown) => (error ? reject(error) : resolve()))
  })
}

function saveSession(request: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error: unknown) => (error ? reject(error) : resolve()))
  })
}
