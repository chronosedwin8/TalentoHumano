import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannel } from '@prisma/client';
import { renderTemplate } from '@talento/shared';
import Handlebars from 'handlebars';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUES, QueueService } from '../queue/queue.service';
import { MailService } from './mail.service';
import { NotificationsGateway } from './notifications.gateway';

export interface NotifyInput {
  companyId: string;
  /** Recipients by user id. Employees are resolved to their user account. */
  userIds?: string[];
  employeeIds?: string[];
  eventKey: string;
  title: string;
  body?: string;
  url?: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  /** Skips the per-user preference check (legal or security notices). */
  force?: boolean;
}

const DEFAULT_CHANNELS: NotificationChannel[] = ['in_app', 'email'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly gateway: NotificationsGateway,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {
    this.queue.register(QUEUES.NOTIFICATIONS, 'deliver', (payload: NotifyInput) =>
      this.deliver(payload),
    );
  }

  /** Queues a notification; delivery happens in the background. */
  async notify(input: NotifyInput): Promise<void> {
    await this.queue.add(QUEUES.NOTIFICATIONS, 'deliver', input);
  }

  async deliver(input: NotifyInput): Promise<void> {
    const userIds = new Set(input.userIds ?? []);

    if (input.employeeIds?.length) {
      const employees = await this.prisma.employee.findMany({
        where: { companyId: input.companyId, id: { in: input.employeeIds }, userId: { not: null } },
        select: { userId: true },
      });
      for (const e of employees) if (e.userId) userIds.add(e.userId);
    }
    if (!userIds.size) return;

    const channels = input.channels ?? DEFAULT_CHANNELS;
    const company = await this.prisma.company.findFirst({
      where: { id: input.companyId },
      select: { name: true, primaryColor: true },
    });

    for (const userId of userIds) {
      try {
        const notification = await this.prisma.notification.create({
          data: {
            companyId: input.companyId,
            userId,
            eventKey: input.eventKey,
            title: input.title,
            body: input.body ?? null,
            url: input.url ?? null,
            entityType: input.entityType ?? null,
            entityId: input.entityId ?? null,
            data: (input.data ?? {}) as object,
          },
        });

        if (channels.includes('in_app')) {
          this.gateway.emitToUser(userId, 'notification', {
            id: notification.id,
            title: notification.title,
            body: notification.body,
            url: notification.url,
            eventKey: notification.eventKey,
            createdAt: notification.createdAt,
          });
        }

        if (channels.includes('email')) {
          const allowed =
            input.force || (await this.isEnabled(input.companyId, userId, input.eventKey, 'email'));
          if (allowed) await this.sendEmail(notification.id, userId, input, company);
        }
      } catch (error) {
        this.logger.error(`Could not notify user ${userId}: ${(error as Error).message}`);
      }
    }
  }

  private async isEnabled(
    companyId: string,
    userId: string,
    eventKey: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findFirst({
      where: { companyId, userId, eventKey, channel },
      select: { isEnabled: true },
    });
    return preference?.isEnabled ?? true;
  }

  private async sendEmail(
    notificationId: string,
    userId: string,
    input: NotifyInput,
    company: { name: string; primaryColor: string | null } | null,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true, firstName: true, status: true },
    });
    if (!user || user.status === 'inactive') return;

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        eventKey: input.eventKey,
        channel: 'email',
        isActive: true,
        OR: [{ companyId: input.companyId }, { companyId: null }],
      },
      orderBy: { companyId: 'desc' },
    });

    const variables = {
      ...input.data,
      title: input.title,
      body: input.body ?? '',
      firstName: user.firstName,
      companyName: company?.name ?? 'TALENTO',
      url: input.url ? this.absoluteUrl(input.url) : '',
    };

    const subject = template?.subject ? renderTemplate(template.subject, variables) : input.title;
    const bodyHtml = template?.body
      ? Handlebars.compile(template.body)(variables)
      : `<p>Hola ${user.firstName},</p><p>${input.body ?? input.title}</p>`;

    const html = this.mail.render({
      title: subject,
      body: bodyHtml,
      actionUrl: input.url ? this.absoluteUrl(input.url) : undefined,
      companyName: company?.name,
      primaryColor: company?.primaryColor ?? undefined,
    });

    const delivery = await this.prisma.notificationDelivery.create({
      data: { notificationId, channel: 'email', status: 'queued', target: user.email },
    });

    try {
      await this.mail.send({ to: user.email, subject, html });
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', error: (error as Error).message.slice(0, 1000) },
      });
    }
  }

  private absoluteUrl(url: string): string {
    if (url.startsWith('http')) return url;
    const base = (this.config.get<string>('env.WEB_URL') ?? '').replace(/\/$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /* ------------------------------- queries ------------------------------- */

  async listForUser(
    companyId: string,
    userId: string,
    params: { page: number; limit: number; unreadOnly?: boolean },
  ) {
    const where = {
      companyId,
      userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { companyId, userId, readAt: null } }),
    ]);
    return { rows, total, unread };
  }

  async markRead(companyId: string, userId: string, ids?: string[]): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
