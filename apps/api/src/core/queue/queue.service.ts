import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type JobHandler<T = any> = (payload: T) => Promise<void>;

export const QUEUES = {
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  IMPORTS: 'imports',
  REMINDERS: 'reminders',
  MEDIA: 'media',
  WEBHOOKS: 'webhooks',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Background work abstraction.
 *
 * With `REDIS_ENABLED=true` jobs go to BullMQ and are processed by the worker
 * process. Otherwise they run in-process right after the request, so a single
 * node deployment (or a developer machine without Redis) keeps working with no
 * configuration. See docs/DECISIONS.md (ADR-0005).
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly queues = new Map<string, any>();
  private readonly workers: any[] = [];
  private readonly enabled: boolean;
  private connection: any = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = Boolean(this.config.get<boolean>('env.REDIS_ENABLED'));
  }

  get usesRedis(): boolean {
    return this.enabled;
  }

  register<T>(queue: QueueName, jobName: string, handler: JobHandler<T>): void {
    this.handlers.set(`${queue}:${jobName}`, handler as JobHandler);
  }

  async add<T>(queue: QueueName, jobName: string, payload: T, options?: { delayMs?: number }): Promise<void> {
    if (!this.enabled) {
      await this.runInline(queue, jobName, payload, options?.delayMs);
      return;
    }
    try {
      const q = await this.getQueue(queue);
      await q.add(jobName, payload, {
        delay: options?.delayMs ?? 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } catch (error) {
      this.logger.error(`No se pudo encolar ${queue}:${jobName}: ${(error as Error).message}`);
      await this.runInline(queue, jobName, payload, 0);
    }
  }

  private async runInline<T>(queue: string, jobName: string, payload: T, delayMs = 0): Promise<void> {
    const handler = this.handlers.get(`${queue}:${jobName}`);
    if (!handler) {
      this.logger.debug(`Sin manejador para ${queue}:${jobName}; se omite`);
      return;
    }
    const run = async () => {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error(`Job ${queue}:${jobName} fallo: ${(error as Error).message}`);
      }
    };
    if (delayMs > 0) {
      setTimeout(() => void run(), Math.min(delayMs, 2_147_483_000)).unref?.();
      return;
    }
    // Detach so a slow job never delays the HTTP response.
    setImmediate(() => void run());
  }

  private async getConnection(): Promise<any> {
    if (this.connection) return this.connection;
    const { default: IORedis } = await import('ioredis');
    this.connection = new IORedis(this.config.get<string>('env.REDIS_URL') as string, {
      maxRetriesPerRequest: null,
    });
    return this.connection;
  }

  private async getQueue(name: string): Promise<any> {
    const existing = this.queues.get(name);
    if (existing) return existing;
    const { Queue } = await import('bullmq');
    const queue = new Queue(name, { connection: await this.getConnection() });
    this.queues.set(name, queue);
    return queue;
  }

  /** Starts BullMQ workers for every registered handler (worker process). */
  async startWorkers(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Redis deshabilitado: los trabajos se ejecutan en proceso');
      return;
    }
    const { Worker } = await import('bullmq');
    const connection = await this.getConnection();
    const queueNames = new Set([...this.handlers.keys()].map((key) => key.split(':')[0]));
    for (const name of queueNames) {
      const worker = new Worker(
        name,
        async (job: any) => {
          const handler = this.handlers.get(`${name}:${job.name}`);
          if (!handler) return;
          await handler(job.data);
        },
        { connection, concurrency: 5 },
      );
      worker.on('failed', (job: any, error: Error) =>
        this.logger.error(`Job ${name}:${job?.name} fallo: ${error.message}`),
      );
      this.workers.push(worker);
      this.logger.log(`Worker activo para la cola "${name}"`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close?.()));
    await Promise.all([...this.queues.values()].map((q) => q.close?.()));
    await this.connection?.quit?.();
  }
}
