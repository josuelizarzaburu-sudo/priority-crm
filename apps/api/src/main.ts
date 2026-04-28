import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] })
  const config = app.get(ConfigService)

  const isDev = config.get('NODE_ENV', 'development') !== 'production'
  const allowedOrigins = [
    'https://priority-health-production.up.railway.app',
    ...config.get('CORS_ORIGINS', '').split(',').filter(Boolean),
  ]
  app.enableCors({
    origin: isDev
      ? (_origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, true)
      : allowedOrigins,
    credentials: true,
  })

  app.setGlobalPrefix(config.get('API_PREFIX', 'api/v1'))

  app.enableVersioning({ type: VersioningType.URI })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Priority CRM API')
    .setDescription('Omnichannel CRM with AI-powered pipeline management')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document)

  const port = config.get<number>('PORT', 3001)
  await app.listen(port)
  console.log(`API running on http://localhost:${port}`)
  console.log(`Swagger docs: http://localhost:${port}/docs`)
}

bootstrap()
