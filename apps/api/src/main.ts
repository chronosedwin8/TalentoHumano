import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { QueueService } from './core/queue/queue.service';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule, { bufferLogs: false }));
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const prefix = config.get<string>('env.API_PREFIX') ?? 'api';
  const port = config.get<number>('env.API_PORT') ?? 3000;
  const isProduction = config.get<string>('env.NODE_ENV') === 'production';

  if (!isProduction || config.get<boolean>('env.SWAGGER_ENABLED')) {
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

  // With Redis enabled the jobs only run if some process consumes the
  // queues. By default the API consumes them itself; QUEUE_WORKERS=false
  // leaves that to dedicated worker processes (node dist/worker.js).
  if (config.get<boolean>('env.QUEUE_WORKERS')) {
    await app.get(QueueService).startWorkers();
  }
  logger.log(`TALENTO API listening on http://localhost:${port}/${prefix}/v1`);
}

void bootstrap();
