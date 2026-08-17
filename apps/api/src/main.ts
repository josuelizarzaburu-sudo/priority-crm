import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] })
  const config = app.get(ConfigService)

  // Express acepta 12 MB por defecto... pero en JSON son solo 100 KB, y los
  // adjuntos de los correos viajan como base64 DENTRO del JSON. Un PDF de 211 KB
  // se convierte en ~281 KB de texto y la peticion se rechazaba con
  // 'request entity too large' antes de llegar al codigo.
  //
  // 12 MB deja sitio para el tope real de 8 MB de adjuntos: base64 los engorda
  // un 33% (8 MB -> ~10,6 MB) y ademas viaja el texto del correo. El limite util
  // sigue siendo el de 8 MB, que se valida en el servicio con un mensaje claro;
  // esto solo evita que Express corte antes de poder darlo.
  app.use(json({ limit: '12mb' }))
  app.use(urlencoded({ limit: '12mb', extended: true }))

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
  console.log('BUILD_MARKER v-operaciones-seed-2')
  console.log(`API running on http://localhost:${port}`)
  console.log(`Swagger docs: http://localhost:${port}/docs`)
}

bootstrap()
