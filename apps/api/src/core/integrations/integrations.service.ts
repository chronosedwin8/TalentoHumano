import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac, randomBytes } from 'node:crypto';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUES, QueueService } from '../queue/queue.service';

interface WebhookJob {
  deliveryId: string;
}

/**
 * Outbound integrations: signed webhooks per domain event and API keys scoped
 * to a permission list, for biometric clocks, external payroll and BI tools.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly encryption: EncryptionService,
  ) {
    this.queue.register<WebhookJob>(QUEUES.WEBHOOKS, 'send', (job) => this.sendDelivery(job.deliveryId));
  }

  /** Fans a domain event out to every webhook subscribed to it. */
  @OnEvent('**', { async: true })
  async onDomainEvent(payload: unknown, eventName?: string): Promise<void> {
    const event = eventName ?? (payload as { __event?: string })?.__event;
    if (!event || event.startsWith('workflow.')) return;
    const companyId = (payload as { companyId?: string })?.companyId;
    if (!companyId) return;

    const webhooks = await this.prisma.webhook.findMany({
      where: { companyId, isActive: true, deletedAt: null, events: { has: event } },
    });
    for (const webhook of webhooks) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          companyId,
          webhookId: webhook.id,
          event,
          payload: payload as object,
          status: 'queued',
        },
      });
      await this.queue.add(QUEUES.WEBHOOKS, 'send', { deliveryId: delivery.id });
    }
  }

  private async sendDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId },
      include: { webhook: true },
    });
    if (!delivery || delivery.status === 'sent') return;

    const body = JSON.stringify({
      event: delivery.event,
      data: delivery.payload,
      deliveredAt: new Date().toISOString(),
    });
    const signature = createHmac('sha256', delivery.webhook.secret).update(body).digest('hex');

    try {
      const response = await fetch(delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Talento-Event': delivery.event,
          'X-Talento-Signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? 'sent' : 'failed',
          statusCode: response.status,
          attempts: { increment: 1 },
          sentAt: new Date(),
          error: response.ok ? null : `HTTP ${response.status}`,
        },
      });
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          error: (error as Error).message.slice(0, 1000),
        },
      });
    }
  }

  /* ------------------------------ api keys ------------------------------ */

  async createApiKey(
    companyId: string,
    userId: string,
    input: { name: string; permissions: string[]; expiresAt?: string | null },
  ) {
    const raw = `tal_${randomBytes(24).toString('base64url')}`;
    const key = await this.prisma.apiKey.create({
      data: {
        companyId,
        name: input.name,
        keyPrefix: raw.slice(0, 12),
        keyHash: this.encryption.hash(raw),
        permissions: input.permissions,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: userId,
      },
    });
    // The raw key is shown once and never stored.
    return { ...key, key: raw };
  }

  async verifyApiKey(raw: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: this.encryption.hash(raw),
        isActive: true,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (key) {
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
    }
    return key;
  }

  async createWebhook(
    companyId: string,
    input: { name: string; url: string; events: string[] },
  ) {
    return this.prisma.webhook.create({
      data: {
        companyId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret: randomBytes(24).toString('base64url'),
      },
    });
  }
}
