import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS, percent } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { paged, parsePage } from '../../common/utils/pagination';
import { NotificationsService } from '../../core/notifications/notifications.service';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Audience filter of the caller: company wide, their location, area or role. */
  private async audienceFilter(ctx: RequestContext) {
    const employee = ctx.employeeId
      ? await this.prisma.employee.findFirst({
          where: { id: ctx.employeeId },
          select: { locationId: true, departmentId: true, positionId: true },
        })
      : null;

    const targets: Array<{ targetType: string; targetId: string | null }> = [
      { targetType: 'all', targetId: null },
    ];
    if (employee?.locationId)
      targets.push({ targetType: 'location', targetId: employee.locationId });
    if (employee?.departmentId)
      targets.push({ targetType: 'department', targetId: employee.departmentId });
    if (employee?.positionId)
      targets.push({ targetType: 'position', targetId: employee.positionId });

    return targets;
  }

  async feedFor(ctx: RequestContext, query: { page?: string; limit?: string }) {
    const { page, limit, skip, take } = parsePage(query);
    const targets = await this.audienceFilter(ctx);

    const where = {
      companyId: ctx.companyId,
      deletedAt: null,
      status: 'published' as const,
      OR: [
        { audiences: { none: {} } },
        {
          audiences: {
            some: {
              OR: targets.map((target) => ({
                targetType: target.targetType,
                targetId: target.targetId,
              })),
            },
          },
        },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          _count: { select: { comments: true, reactions: true, reads: true } },
          reactions: { where: { userId: ctx.userId }, select: { emoji: true } },
          reads: { where: { userId: ctx.userId }, select: { readAt: true, acknowledgedAt: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.post.count({ where }),
    ]);

    return paged(
      rows.map((post) => ({
        ...post,
        myReactions: post.reactions.map((r) => r.emoji),
        readAt: post.reads[0]?.readAt ?? null,
        acknowledgedAt: post.reads[0]?.acknowledgedAt ?? null,
        reactions: undefined,
        reads: undefined,
      })),
      total,
      page,
      limit,
    );
  }

  async createPost(ctx: RequestContext, input: Record<string, any>) {
    const db = this.prisma.forCompany(ctx.companyId);
    const post = await db.post.create({
      data: {
        title: input.title,
        kind: input.kind,
        blocks: input.blocks as object,
        excerpt: input.excerpt ?? null,
        coverFileId: input.coverFileId ?? null,
        isPinned: input.isPinned,
        requiresAck: input.requiresAck,
        allowComments: input.allowComments,
        allowReactions: input.allowReactions,
        surveyId: input.surveyId ?? null,
        publishAt: input.publishAt ? new Date(input.publishAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: input.publishAt ? 'scheduled' : 'draft',
        authorUserId: ctx.userId,
      },
    });

    if (input.audiences?.length) {
      await db.postAudience.createMany({
        data: input.audiences.map((audience: { targetType: string; targetId?: string | null }) => ({
          postId: post.id,
          targetType: audience.targetType,
          targetId: audience.targetId ?? null,
        })),
      });
    }

    return db.post.findFirst({ where: { id: post.id }, include: { audiences: true } });
  }

  async publishPost(ctx: RequestContext, postId: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const post = await db.post.findFirst({ where: { id: postId }, include: { audiences: true } });
    if (!post) throw BusinessException.notFound('Publicacion');

    const updated = await db.post.update({
      where: { id: postId },
      data: { status: 'published', publishedAt: new Date() },
    });

    const employees = await this.recipientsFor(ctx.companyId, post.audiences);
    if (employees.length) {
      await this.notifications.notify({
        companyId: ctx.companyId,
        employeeIds: employees,
        eventKey: DOMAIN_EVENTS.POST_PUBLISHED,
        title: post.requiresAck ? `Comunicado importante: ${post.title}` : post.title,
        body: post.excerpt ?? undefined,
        url: `/communication/posts/${post.id}`,
        entityType: 'post',
        entityId: post.id,
        force: post.requiresAck,
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.POST_PUBLISHED, {
      companyId: ctx.companyId,
      postId: post.id,
      recipients: employees.length,
    });

    return updated;
  }

  private async recipientsFor(
    companyId: string,
    audiences: Array<{ targetType: string; targetId: string | null }>,
  ): Promise<string[]> {
    if (!audiences.length || audiences.some((a) => a.targetType === 'all')) {
      const all = await this.prisma.employee.findMany({
        where: { companyId, deletedAt: null, status: { in: ['active', 'on_leave'] } },
        select: { id: true },
      });
      return all.map((employee) => employee.id);
    }

    const locationIds = audiences
      .filter((a) => a.targetType === 'location')
      .map((a) => a.targetId!);
    const departmentIds = audiences
      .filter((a) => a.targetType === 'department')
      .map((a) => a.targetId!);
    const positionIds = audiences
      .filter((a) => a.targetType === 'position')
      .map((a) => a.targetId!);

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['active', 'on_leave'] },
        OR: [
          ...(locationIds.length ? [{ locationId: { in: locationIds } }] : []),
          ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
          ...(positionIds.length ? [{ positionId: { in: positionIds } }] : []),
        ],
      },
      select: { id: true },
    });
    return employees.map((employee) => employee.id);
  }

  async markRead(ctx: RequestContext, postId: string, acknowledge: boolean) {
    const db = this.prisma.forCompany(ctx.companyId);
    return db.postRead.upsert({
      where: { postId_userId: { postId, userId: ctx.userId } },
      create: {
        postId,
        userId: ctx.userId,
        readAt: new Date(),
        acknowledgedAt: acknowledge ? new Date() : null,
      },
      update: acknowledge ? { acknowledgedAt: new Date() } : {},
    });
  }

  async readReport(ctx: RequestContext, postId: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const post = await db.post.findFirst({ where: { id: postId }, include: { audiences: true } });
    if (!post) throw BusinessException.notFound('Publicacion');

    const recipients = await this.recipientsFor(ctx.companyId, post.audiences);
    const reads = await db.postRead.findMany({ where: { postId } });
    const acknowledged = reads.filter((read) => read.acknowledgedAt).length;

    return {
      recipients: recipients.length,
      reads: reads.length,
      acknowledged,
      readRate: percent(reads.length, recipients.length),
      acknowledgeRate: percent(acknowledged, recipients.length),
      requiresAck: post.requiresAck,
    };
  }

  /** Birthdays and work anniversaries of a month, honouring the opt-out. */
  async celebrations(ctx: RequestContext, month: number) {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: 'active',
        hideCelebrations: false,
      },
      select: { id: true, fullName: true, birthDate: true, hiredAt: true, photoFileId: true },
    });

    const birthdays = employees
      .filter((employee) => employee.birthDate && employee.birthDate.getUTCMonth() + 1 === month)
      .map((employee) => ({
        employeeId: employee.id,
        fullName: employee.fullName,
        day: employee.birthDate!.getUTCDate(),
      }))
      .sort((a, b) => a.day - b.day);

    const currentYear = new Date().getUTCFullYear();
    const anniversaries = employees
      .filter(
        (employee) =>
          employee.hiredAt.getUTCMonth() + 1 === month &&
          employee.hiredAt.getUTCFullYear() < currentYear,
      )
      .map((employee) => ({
        employeeId: employee.id,
        fullName: employee.fullName,
        day: employee.hiredAt.getUTCDate(),
        years: currentYear - employee.hiredAt.getUTCFullYear(),
      }))
      .sort((a, b) => a.day - b.day);

    return { month, birthdays, anniversaries };
  }
}
