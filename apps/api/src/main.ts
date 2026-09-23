import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule, { bufferLogs: false }));
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const prefix = config.get<string>('env.API_PREFIX') ?? 'api';
  const port = config.get<number>('env.API_PORT') ?? 3000;
  const isProduction = config.get<string>('env.NODE_ENV') === 'production';

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
    logger.log(`OpenAPI documentation at /${prefix}/docs`);
  }

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  logger.log(`TALENTO API listening on http://localhost:${port}/${prefix}/v1`);
}

void bootstrap();
