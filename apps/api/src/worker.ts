import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { QueueService } from './core/queue/queue.service';

/**
 * Queue consumer without an HTTP listener. Use it when the API replicas run
 * with QUEUE_WORKERS=false and jobs are processed by separate containers:
 *
 *   node dist/worker.js
 *
 * With REDIS_ENABLED=false there is nothing to consume and it exits.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  const queue = app.get(QueueService);
  if (!queue.usesRedis) {
    logger.warn('REDIS_ENABLED=false: jobs run inside the API process; nothing to do');
    await app.close();
    return;
  }
  await queue.startWorkers();
  logger.log('Worker ready');
}

void bootstrap();
