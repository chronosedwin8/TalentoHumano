import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const prefix = config.get<string>('env.API_PREFIX') ?? 'api';
  const port = config.get<number>('env.API_PORT') ?? 3000;
  const isProduction = config.get<string>('env.NODE_ENV') === 'production';

  app.setGlobalPrefix(prefix, { exclude: ['health', 'metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser(config.get<string>('env.COOKIE_SECRET')));
  // Raw uploads go through the local storage driver, which streams the request.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const origins = (config.get<string>('env.CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
  });

  if (!isProduction || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TALENTO API')
      .setDescription(
        'Plataforma de gestion de recursos humanos: HRIS, ATS, LMS, desempeno, cultura, SST y analitica. ' +
          'La plataforma no gestiona nomina ni contabilidad.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Documentacion OpenAPI en /${prefix}/docs`);
  }

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  logger.log(`TALENTO API escuchando en http://localhost:${port}/${prefix}/v1`);
}

void bootstrap();
