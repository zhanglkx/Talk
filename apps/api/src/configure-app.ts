import { RequestMethod, type INestApplication } from '@nestjs/common'

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'internal/ready', method: RequestMethod.GET }],
  })
}
