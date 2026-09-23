import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
}

/** Fields never written to the audit trail. */
const REDACTED = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'twoFactorSecret',
  'twoFactorRecovery',
  'refreshTokenHash',
  'accessKeyHash',
  'tokenHash',
  'keyHash',
  'secret',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Computes a shallow `{ field: { from, to } }` diff, skipping secrets. */
  static diff(before: unknown, after: unknown): Record<string, { from: unknown; to: unknown }> {
    const out: Record<string, { from: unknown; to: unknown }> = {};
    const a = (before ?? {}) as Record<string, unknown>;
    const b = (after ?? {}) as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (REDACTED.has(key)) continue;
      const from = AuditService.normalize(a[key]);
      const to = AuditService.normalize(b[key]);
      if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
    }
    return out;
  }

  private static normalize(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && 'toNumber' in (value as object)) {
      return Number((value as { toNumber(): number }).toNumber());
    }
    return value;
  }

  async record(ctx: Partial<RequestContext> | null, entry: AuditEntry): Promise<void> {
    try {
      const diff =
        entry.diff ??
        (entry.before !== undefined || entry.after !== undefined
          ? AuditService.diff(entry.before, entry.after)
          : null);

      await this.prisma.auditLog.create({
        data: {
          companyId: ctx?.companyId ?? null,
          actorId: ctx?.userId ?? null,
          actorEmail: ctx?.email ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          summary: entry.summary ?? null,
          diff: diff && Object.keys(diff).length ? (diff as object) : undefined,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent?.slice(0, 400) ?? null,
        },
      });
    } catch (error) {
      // Auditing must never break the business operation.
      this.logger.error(`Could not write the audit entry: ${(error as Error).message}`);
    }
  }

  /** Records access to sensitive data (salary, health, disciplinary, ethics). */
  async recordSensitiveAccess(
    ctx: Partial<RequestContext>,
    permission: string,
    entityType: string,
    entityId?: string | null,
    reason?: string,
  ): Promise<void> {
    if (!ctx.companyId) return;
    try {
      await this.prisma.sensitiveAccessLog.create({
        data: {
          companyId: ctx.companyId,
          actorId: ctx.userId ?? null,
          permission,
          entityType,
          entityId: entityId ?? null,
          reason: reason ?? null,
          ip: ctx.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Could not write the sensitive access entry: ${(error as Error).message}`);
    }
  }

  async list(
    companyId: string,
    filters: {
      page: number;
      limit: number;
      entityType?: string;
      entityId?: string;
      actorId?: string;
      action?: AuditAction;
      from?: Date;
      to?: Date;
    },
  ) {
    const where = {
      companyId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { rows, total };
  }
}
