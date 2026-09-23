import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { TicketPriority } from '@prisma/client';
import { DOMAIN_EVENTS, percent, round } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { NotificationsGateway } from '../../core/notifications/notifications.gateway';

/**
 * Inbound/outbound abstraction so email, WhatsApp and social channels can be
 * plugged in later without touching the ticket logic (spec 5.13, phase 2).
 */
export interface ChannelAdapter {
  kind: string;
  inbound(
    payload: unknown,
  ): Promise<{ externalId: string; from: string; subject: string; body: string }>;
  outbound(message: { to: string; subject: string; body: string }): Promise<void>;
}

@Injectable()
export class HelpdeskService {
  private readonly logger = new Logger(HelpdeskService.name);
  private readonly adapters = new Map<string, ChannelAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly events: EventEmitter2,
  ) {}

  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  async createTicket(
    ctx: RequestContext,
    input: {
      subject: string;
      description: string;
      categoryId?: string | null;
      priority?: TicketPriority;
      requesterEmployeeId?: string | null;
      fileIds?: string[];
    },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const last = await db.ticket.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const category = input.categoryId
      ? await db.ticketCategory.findFirst({
          where: { id: input.categoryId },
          include: { slaPolicy: true },
        })
      : null;

    const sla =
      category?.slaPolicy ?? (await db.slaPolicy.findFirst({ where: { isDefault: true } })) ?? null;

    const now = Date.now();
    const ticket = await db.ticket.create({
      data: {
        number: (last?.number ?? 0) + 1,
        subject: input.subject,
        description: input.description,
        categoryId: input.categoryId ?? null,
        priority: input.priority ?? 'normal',
        requesterEmployeeId: input.requesterEmployeeId ?? ctx.employeeId,
        requesterUserId: ctx.userId,
        requesterEmail: ctx.email,
        assigneeEmployeeId: category?.defaultAssigneeEmployeeId ?? null,
        firstResponseDueAt: sla ? new Date(now + sla.firstResponseMinutes * 60_000) : null,
        resolutionDueAt: sla ? new Date(now + sla.resolutionMinutes * 60_000) : null,
      },
    });

    if (input.fileIds?.length) {
      await this.prisma.fileLink.createMany({
        data: input.fileIds.map((fileId) => ({
          companyId: ctx.companyId,
          fileId,
          entityType: 'ticket',
          entityId: ticket.id,
        })),
      });
    }

    if (ticket.assigneeEmployeeId) {
      const agent = await this.prisma.employee.findFirst({
        where: { id: ticket.assigneeEmployeeId },
        select: { userId: true },
      });
      if (agent?.userId) {
        await this.notifications.notify({
          companyId: ctx.companyId,
          userIds: [agent.userId],
          eventKey: DOMAIN_EVENTS.TICKET_ASSIGNED,
          title: `Ticket #${ticket.number}: ${ticket.subject}`,
          url: `/helpdesk/tickets/${ticket.id}`,
          entityType: 'ticket',
          entityId: ticket.id,
        });
      }
    }

    this.gateway.emitToCompany(ctx.companyId, 'ticket.created', {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
    });

    await this.events.emitAsync(DOMAIN_EVENTS.TICKET_CREATED, {
      companyId: ctx.companyId,
      ticketId: ticket.id,
      number: ticket.number,
    });

    return ticket;
  }

  async addMessage(
    ctx: RequestContext,
    ticketId: string,
    input: { body: string; isInternal: boolean; fileIds?: string[] },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const ticket = await db.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
    if (!ticket) throw BusinessException.notFound('Ticket');

    const message = await db.ticketMessage.create({
      data: {
        ticketId,
        authorUserId: ctx.userId,
        authorName: ctx.email,
        body: input.body,
        isInternal: input.isInternal,
      },
    });

    const isAgentReply = !input.isInternal && ctx.userId !== ticket.requesterUserId;
    await db.ticket.update({
      where: { id: ticketId },
      data: {
        status: isAgentReply
          ? 'pending_requester'
          : ticket.status === 'new'
            ? 'open'
            : ticket.status,
        firstResponseAt:
          isAgentReply && !ticket.firstResponseAt ? new Date() : ticket.firstResponseAt,
      },
    });

    if (input.fileIds?.length) {
      await this.prisma.fileLink.createMany({
        data: input.fileIds.map((fileId) => ({
          companyId: ctx.companyId,
          fileId,
          entityType: 'ticket_message',
          entityId: message.id,
        })),
      });
    }

    if (!input.isInternal) {
      const notifyUserId = isAgentReply ? ticket.requesterUserId : null;
      if (notifyUserId) {
        await this.notifications.notify({
          companyId: ctx.companyId,
          userIds: [notifyUserId],
          eventKey: 'ticket.replied',
          title: `Respuesta en el ticket #${ticket.number}`,
          body: input.body.slice(0, 200),
          url: `/portal/tickets/${ticket.id}`,
          entityType: 'ticket',
          entityId: ticket.id,
        });
      }
      this.gateway.emitToRoom(`ticket:${ticketId}`, 'ticket.message', {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
      });
    }

    return message;
  }

  async closeTicket(ctx: RequestContext, ticketId: string, resolutionNote?: string | null) {
    const db = this.prisma.forCompany(ctx.companyId);
    const ticket = await db.ticket.findFirst({ where: { id: ticketId } });
    if (!ticket) throw BusinessException.notFound('Ticket');

    if (resolutionNote) {
      await this.addMessage(ctx, ticketId, { body: resolutionNote, isInternal: false });
    }

    const now = new Date();
    const breached = Boolean(ticket.resolutionDueAt && now > ticket.resolutionDueAt);

    const updated = await db.ticket.update({
      where: { id: ticketId },
      data: { status: 'resolved', resolvedAt: now, closedAt: now, slaBreached: breached },
    });

    if (ticket.requesterUserId) {
      await this.notifications.notify({
        companyId: ctx.companyId,
        userIds: [ticket.requesterUserId],
        eventKey: DOMAIN_EVENTS.TICKET_CLOSED,
        title: `Su ticket #${ticket.number} fue resuelto`,
        body: 'Cuentenos que tal fue la atencion.',
        url: `/portal/tickets/${ticket.id}`,
        entityType: 'ticket',
        entityId: ticket.id,
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.TICKET_CLOSED, {
      companyId: ctx.companyId,
      ticketId,
      slaBreached: breached,
    });

    return updated;
  }

  async metrics(ctx: RequestContext) {
    const companyId = ctx.companyId;
    const [byStatus, byCategory, resolved, csat, backlog] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { companyId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: { companyId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.ticket.findMany({
        where: { companyId, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true, firstResponseAt: true, slaBreached: true },
        take: 500,
        orderBy: { resolvedAt: 'desc' },
      }),
      this.prisma.csatResponse.aggregate({
        where: { companyId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.ticket.count({
        where: { companyId, deletedAt: null, status: { in: ['new', 'open', 'on_hold'] } },
      }),
    ]);

    const categories = await this.prisma.ticketCategory.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const avg = (values: number[]) =>
      values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 1) : 0;

    return {
      backlog,
      byStatus: byStatus.map((row) => ({ label: row.status, value: row._count._all })),
      byCategory: byCategory.map((row) => ({
        label: row.categoryId
          ? (categoryName.get(row.categoryId) ?? 'Sin categoria')
          : 'Sin categoria',
        value: row._count._all,
      })),
      firstResponseHours: avg(
        resolved
          .filter((t) => t.firstResponseAt)
          .map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 3_600_000),
      ),
      resolutionHours: avg(
        resolved.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000),
      ),
      slaCompliance: resolved.length
        ? percent(resolved.filter((t) => !t.slaBreached).length, resolved.length)
        : 100,
      csat: round(Number(csat._avg.rating ?? 0), 2),
      csatResponses: csat._count._all,
    };
  }

  /** Suggests knowledge base articles before opening a ticket. */
  async suggestArticles(companyId: string, query: string) {
    if (!query?.trim()) return [];
    return this.prisma.kbArticle.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'published',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
          { tags: { has: query.toLowerCase() } },
        ],
      },
      select: { id: true, title: true, slug: true, summary: true },
      take: 5,
    });
  }
}
