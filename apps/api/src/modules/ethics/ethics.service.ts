import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS, ERROR_CODES, addDays, randomTrackingCode } from '@talento/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';

/**
 * Ethics hotline.
 *
 * Anonymity is structural, not a setting: for anonymous reports no IP, no user
 * agent and no reporter identity is ever written, and the only way back to the
 * reporter is the tracking code plus access key that they keep. Content is
 * encrypted at rest and every read of a case is logged.
 */
@Injectable()
export class EthicsService {
  private readonly logger = new Logger(EthicsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly events: EventEmitter2,
  ) {}

  async submitReport(companySlug: string, input: Record<string, any>) {
    const company = await this.prisma.company.findFirst({
      where: { slug: companySlug, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!company) throw BusinessException.notFound('Empresa');

    const category = input.categoryId
      ? await this.prisma.ethicsCategory.findFirst({
          where: { id: input.categoryId, companyId: company.id },
        })
      : null;

    const trackingCode = randomTrackingCode();
    const accessKey = this.encryption.randomToken(9).slice(0, 12).toUpperCase();

    const report = await this.prisma.ethicsReport.create({
      data: {
        companyId: company.id,
        trackingCode,
        accessKeyHash: this.encryption.hash(accessKey),
        categoryId: category?.id ?? null,
        isAnonymous: input.isAnonymous ?? true,
        // Identity is only stored when the reporter chose to identify.
        reporterName: input.isAnonymous
          ? null
          : this.encryption.encrypt(input.reporterName ?? null),
        reporterEmail: input.isAnonymous
          ? null
          : this.encryption.encrypt(input.reporterEmail ?? null),
        reporterPhone: input.isAnonymous
          ? null
          : this.encryption.encrypt(input.reporterPhone ?? null),
        relationship: input.relationship ?? 'employee',
        subject: this.encryption.encrypt(input.subject) as string,
        description: this.encryption.encrypt(input.description) as string,
        involvedPersons: this.encryption.encrypt(input.involvedPersons ?? null),
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
        severity: category?.defaultSeverity ?? 'medium',
        dueAt: addDays(new Date(), category?.slaDays ?? 15),
      },
    });

    if (input.fileIds?.length) {
      await this.prisma.fileLink.createMany({
        data: input.fileIds.map((fileId: string) => ({
          companyId: company.id,
          fileId,
          entityType: 'ethics_report',
          entityId: report.id,
        })),
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.ETHICS_REPORT_CREATED, {
      companyId: company.id,
      reportId: report.id,
      severity: report.severity,
    });

    // The key is returned once; it is stored only as a hash.
    return { trackingCode, accessKey, dueAt: report.dueAt };
  }

  /** Reporter side: status and conversation, without revealing identity. */
  async followUp(trackingCode: string, accessKey: string) {
    const report = await this.prisma.ethicsReport.findFirst({
      where: { trackingCode: trackingCode.trim().toUpperCase() },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        category: { select: { name: true } },
        ethicsCase: { select: { caseNumber: true, status: true, closedAt: true } },
      },
    });
    if (
      !report ||
      !this.encryption.safeEqual(report.accessKeyHash, this.encryption.hash(accessKey))
    ) {
      throw new BusinessException(
        ERROR_CODES.ETHICS_CODE_INVALID,
        'El codigo de seguimiento o la clave no son validos',
        404,
      );
    }

    return {
      trackingCode: report.trackingCode,
      status: report.status,
      category: report.category?.name ?? null,
      subject: this.encryption.decrypt(report.subject),
      description: this.encryption.decrypt(report.description),
      createdAt: report.createdAt,
      dueAt: report.dueAt,
      case: report.ethicsCase,
      messages: report.messages.map((message) => ({
        id: message.id,
        authorKind: message.authorKind,
        body: this.encryption.decrypt(message.body),
        createdAt: message.createdAt,
      })),
    };
  }

  async addReporterMessage(trackingCode: string, accessKey: string, body: string) {
    const report = await this.prisma.ethicsReport.findFirst({
      where: { trackingCode: trackingCode.trim().toUpperCase() },
    });
    if (
      !report ||
      !this.encryption.safeEqual(report.accessKeyHash, this.encryption.hash(accessKey))
    ) {
      throw new BusinessException(
        ERROR_CODES.ETHICS_CODE_INVALID,
        'El codigo de seguimiento o la clave no son validos',
        404,
      );
    }
    await this.prisma.ethicsReportMessage.create({
      data: {
        companyId: report.companyId,
        reportId: report.id,
        authorKind: 'reporter',
        body: this.encryption.encrypt(body) as string,
      },
    });
    return { sent: true };
  }

  /* --------------------------- officer side ----------------------------- */

  private async logAccess(
    ctx: RequestContext,
    action: string,
    ids: { caseId?: string | null; reportId?: string | null },
  ) {
    await this.prisma.ethicsAccessLog.create({
      data: {
        companyId: ctx.companyId,
        caseId: ids.caseId ?? null,
        reportId: ids.reportId ?? null,
        userId: ctx.userId,
        action,
      },
    });
  }

  /** Reports the officer may see; cases where they are involved are excluded. */
  async listReports(ctx: RequestContext, params: { page: number; limit: number; status?: string }) {
    const where = {
      companyId: ctx.companyId,
      ...(params.status ? { status: params.status as never } : {}),
      OR: [{ ethicsCase: null }, { ethicsCase: { NOT: { excludedUserIds: { has: ctx.userId } } } }],
    };

    const [rows, total] = await Promise.all([
      this.prisma.ethicsReport.findMany({
        where,
        include: {
          category: { select: { name: true } },
          ethicsCase: { select: { id: true, caseNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.ethicsReport.count({ where }),
    ]);

    await this.logAccess(ctx, 'list', {});

    return {
      rows: rows.map((report) => ({
        id: report.id,
        trackingCode: report.trackingCode,
        subject: this.encryption.decrypt(report.subject),
        category: report.category?.name ?? null,
        status: report.status,
        severity: report.severity,
        isAnonymous: report.isAnonymous,
        createdAt: report.createdAt,
        dueAt: report.dueAt,
        case: report.ethicsCase,
      })),
      total,
    };
  }

  async readReport(ctx: RequestContext, reportId: string) {
    const report = await this.prisma.ethicsReport.findFirst({
      where: { id: reportId, companyId: ctx.companyId },
      include: {
        category: true,
        messages: { orderBy: { createdAt: 'asc' } },
        ethicsCase: { include: { members: true, actions: true, evidence: true } },
      },
    });
    if (!report) throw BusinessException.notFound('Denuncia');

    if (report.ethicsCase?.excludedUserIds.includes(ctx.userId)) {
      throw new BusinessException(
        ERROR_CODES.ETHICS_CONFLICT_OF_INTEREST,
        'No puede acceder a un caso en el que esta implicado',
        403,
      );
    }

    await this.logAccess(ctx, 'read', { reportId, caseId: report.ethicsCase?.id });

    return {
      ...report,
      subject: this.encryption.decrypt(report.subject),
      description: this.encryption.decrypt(report.description),
      involvedPersons: this.encryption.decrypt(report.involvedPersons),
      reporterName: report.isAnonymous ? null : this.encryption.decrypt(report.reporterName),
      reporterEmail: report.isAnonymous ? null : this.encryption.decrypt(report.reporterEmail),
      reporterPhone: report.isAnonymous ? null : this.encryption.decrypt(report.reporterPhone),
      messages: report.messages.map((message) => ({
        ...message,
        body: this.encryption.decrypt(message.body),
      })),
      ethicsCase: report.ethicsCase
        ? {
            ...report.ethicsCase,
            investigationPlan: this.encryption.decrypt(report.ethicsCase.investigationPlan),
            conclusions: this.encryption.decrypt(report.ethicsCase.conclusions),
            measures: this.encryption.decrypt(report.ethicsCase.measures),
            actions: report.ethicsCase.actions.map((action) => ({
              ...action,
              detail: this.encryption.decrypt(action.detail),
            })),
            evidence: report.ethicsCase.evidence.map((evidence) => ({
              ...evidence,
              description: this.encryption.decrypt(evidence.description),
            })),
          }
        : null,
    };
  }

  async openCase(
    ctx: RequestContext,
    reportId: string,
    input: {
      severity?: string;
      leadUserId?: string | null;
      excludedUserIds?: string[];
      investigationPlan?: string | null;
    },
  ) {
    const report = await this.prisma.ethicsReport.findFirst({
      where: { id: reportId, companyId: ctx.companyId },
      include: { category: true },
    });
    if (!report) throw BusinessException.notFound('Denuncia');

    const count = await this.prisma.ethicsCase.count({ where: { companyId: ctx.companyId } });
    const ethicsCase = await this.prisma.ethicsCase.upsert({
      where: { reportId },
      create: {
        companyId: ctx.companyId,
        reportId,
        caseNumber: `ETH-${String(count + 1).padStart(5, '0')}`,
        status: 'in_investigation',
        severity: (input.severity as never) ?? report.severity,
        leadUserId: input.leadUserId ?? ctx.userId,
        excludedUserIds: input.excludedUserIds ?? [],
        investigationPlan: this.encryption.encrypt(input.investigationPlan ?? null),
        dueAt: report.dueAt,
      },
      update: {
        severity: (input.severity as never) ?? undefined,
        leadUserId: input.leadUserId ?? undefined,
        excludedUserIds: input.excludedUserIds ?? undefined,
        investigationPlan: this.encryption.encrypt(input.investigationPlan ?? null),
      },
    });

    await this.prisma.ethicsReport.update({
      where: { id: reportId },
      data: { status: 'in_investigation' },
    });
    await this.logAccess(ctx, 'open_case', { reportId, caseId: ethicsCase.id });

    return ethicsCase;
  }

  async closeCase(
    ctx: RequestContext,
    caseId: string,
    input: { conclusions: string; measures?: string | null; dismissed?: boolean },
  ) {
    const ethicsCase = await this.prisma.ethicsCase.findFirst({
      where: { id: caseId, companyId: ctx.companyId },
    });
    if (!ethicsCase) throw BusinessException.notFound('Caso');

    const updated = await this.prisma.ethicsCase.update({
      where: { id: caseId },
      data: {
        status: input.dismissed ? 'dismissed' : 'closed',
        conclusions: this.encryption.encrypt(input.conclusions),
        measures: this.encryption.encrypt(input.measures ?? null),
        closedAt: new Date(),
      },
    });
    await this.prisma.ethicsReport.update({
      where: { id: ethicsCase.reportId },
      data: { status: input.dismissed ? 'dismissed' : 'closed' },
    });
    await this.logAccess(ctx, 'close_case', { caseId });

    await this.events.emitAsync(DOMAIN_EVENTS.ETHICS_CASE_CLOSED, {
      companyId: ctx.companyId,
      caseId,
    });

    return updated;
  }

  async replyToReporter(ctx: RequestContext, reportId: string, body: string) {
    const report = await this.prisma.ethicsReport.findFirst({
      where: { id: reportId, companyId: ctx.companyId },
    });
    if (!report) throw BusinessException.notFound('Denuncia');
    await this.logAccess(ctx, 'reply', { reportId });
    return this.prisma.ethicsReportMessage.create({
      data: {
        companyId: ctx.companyId,
        reportId,
        authorKind: 'officer',
        authorUserId: ctx.userId,
        body: this.encryption.encrypt(body) as string,
      },
    });
  }

  /** Aggregated statistics only; never the detail of a report. */
  async statistics(ctx: RequestContext) {
    const companyId = ctx.companyId;
    const [byCategory, byStatus, bySeverity, anonymous, total, closed] = await Promise.all([
      this.prisma.ethicsReport.groupBy({
        by: ['categoryId'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.ethicsReport.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.ethicsReport.groupBy({
        by: ['severity'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.ethicsReport.count({ where: { companyId, isAnonymous: true } }),
      this.prisma.ethicsReport.count({ where: { companyId } }),
      this.prisma.ethicsCase.findMany({
        where: { companyId, closedAt: { not: null } },
        select: { openedAt: true, closedAt: true },
      }),
    ]);

    const categories = await this.prisma.ethicsCategory.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const avgClosureDays = closed.length
      ? Number(
          (
            closed.reduce(
              (acc, row) => acc + (row.closedAt!.getTime() - row.openedAt.getTime()) / 86_400_000,
              0,
            ) / closed.length
          ).toFixed(1),
        )
      : 0;

    return {
      total,
      anonymousRate: total ? Number(((anonymous / total) * 100).toFixed(1)) : 0,
      averageClosureDays: avgClosureDays,
      byCategory: byCategory.map((row) => ({
        label: row.categoryId
          ? (categoryName.get(row.categoryId) ?? 'Sin categoria')
          : 'Sin categoria',
        value: row._count._all,
      })),
      byStatus: byStatus.map((row) => ({ label: row.status, value: row._count._all })),
      bySeverity: bySeverity.map((row) => ({ label: row.severity, value: row._count._all })),
    };
  }

  /** Public categories for the hotline portal. */
  async publicCategories(companySlug: string) {
    const company = await this.prisma.company.findFirst({
      where: { slug: companySlug, isActive: true, deletedAt: null },
      select: { id: true, name: true, logoUrl: true, primaryColor: true, privacyPolicy: true },
    });
    if (!company) throw BusinessException.notFound('Empresa');
    const categories = await this.prisma.ethicsCategory.findMany({
      where: { companyId: company.id, isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { position: 'asc' },
    });
    return { company, categories };
  }
}
