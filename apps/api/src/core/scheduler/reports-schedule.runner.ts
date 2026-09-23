import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { AnalyticsService } from '../../modules/analytics/analytics.service';
import { MailService } from '../notifications/mail.service';

/**
 * Executes `report_schedules` whose `next_run_at` has passed: runs the
 * definition with the permissions of the user who scheduled it, renders a
 * CSV and mails it to the recipients. The cron expression is interpreted
 * with a small reader (minute, hour, day of month, month, day of week) so no
 * extra dependency is needed.
 */
@Injectable()
export class ReportsScheduleRunner {
  private readonly logger = new Logger(ReportsScheduleRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly mail: MailService,
  ) {}

  async runDue(now = new Date()): Promise<number> {
    const due = await this.prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
        definition: { deletedAt: null },
      },
      include: { definition: true },
      take: 100,
    });

    let sent = 0;
    for (const schedule of due) {
      const next = nextOccurrence(schedule.cron, now);
      // A schedule created without nextRunAt only gets its first date here.
      if (!schedule.nextRunAt) {
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { nextRunAt: next },
        });
        continue;
      }
      try {
        await this.deliver(schedule.definition, schedule.recipients);
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Scheduled report ${schedule.definition.name} failed: ${(error as Error).message}`,
        );
      }
      await this.prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now, nextRunAt: next },
      });
    }
    return sent;
  }

  private async deliver(
    definition: {
      id: string;
      companyId: string;
      name: string;
      dataset: string;
      columns: string[];
      filters: unknown;
      groupBy: string[];
      createdById: string | null;
    },
    recipients: string[],
  ): Promise<void> {
    if (!recipients.length) return;
    const ctx = await this.contextFor(definition.companyId, definition.createdById);
    const result = await this.analytics.runReport(ctx, {
      dataset: definition.dataset,
      columns: definition.columns,
      filters: (definition.filters ?? {}) as Record<string, unknown>,
      groupBy: definition.groupBy,
    });
    const csv = [
      result.columns.join(';'),
      ...result.rows.map((row) =>
        result.columns.map((column) => String(row[column] ?? '').replace(/;/g, ',')).join(';'),
      ),
    ].join('\n');
    const company = await this.prisma.company.findFirst({
      where: { id: definition.companyId },
      select: { name: true, primaryColor: true },
    });
    const subject = `Reporte programado: ${definition.name}`;
    const body = `<p>Adjuntamos el reporte <strong>${definition.name}</strong> con ${result.rows.length} filas, generado automaticamente.</p>`;
    await this.mail.send({
      to: recipients,
      subject,
      text: `Reporte ${definition.name}: ${result.rows.length} filas.`,
      html: this.mail.render({
        title: subject,
        body,
        companyName: company?.name ?? 'TALENTO',
        primaryColor: company?.primaryColor ?? undefined,
      }),
      attachments: [
        {
          filename: `${definition.name.replace(/[^\w.-]+/g, '_')}.csv`,
          // The BOM makes Excel open the CSV as UTF-8.
          content: `\uFEFF${csv}`,
          contentType: 'text/csv; charset=utf-8',
        },
      ],
    });
  }

  /**
   * The report runs as the person who scheduled it, so the dataset permission
   * and the data scope are theirs, not the server's.
   */
  private async contextFor(companyId: string, userId: string | null): Promise<RequestContext> {
    const membership = userId
      ? await this.prisma.companyUser.findFirst({
          where: { companyId, userId, deletedAt: null },
          include: {
            user: { select: { email: true } },
            roles: {
              include: {
                role: { include: { permissions: { include: { permission: true } } } },
              },
            },
          },
        })
      : null;
    if (!membership) {
      throw new Error('El usuario que programo el reporte ya no pertenece a la empresa');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId: membership.userId, deletedAt: null },
      select: { id: true },
    });
    const permissions = new Map<string, 'own' | 'team' | 'area' | 'company'>();
    for (const assignment of membership.roles) {
      for (const rp of assignment.role.permissions) {
        permissions.set(rp.permission.code, rp.scope as 'own' | 'team' | 'area' | 'company');
      }
    }
    return {
      userId: membership.userId,
      email: membership.user.email,
      companyId,
      companyUserId: membership.id,
      employeeId: employee?.id ?? null,
      roles: membership.roles.map((assignment) => assignment.role.key),
      permissions: [...permissions].map(([code, scope]) => ({ code, scope })),
      modules: [],
      isSuperadmin: false,
      sessionId: 'scheduler',
      impersonatedBy: null,
    };
  }
}

/**
 * Next date matching a five-field cron expression, searched minute by minute
 * for up to 366 days. Supports `*`, numbers, lists (`1,15`), ranges (`1-5`)
 * and steps (an asterisk, a slash and the interval). Anything unparseable
 * falls back to "tomorrow at 06:00", so a typo never makes a schedule fire
 * every quarter hour.
 */
export function nextOccurrence(expression: string, from: Date): Date {
  const fields = expression.trim().split(/\s+/);
  const fallback = new Date(from.getTime());
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  fallback.setUTCHours(6, 0, 0, 0);
  if (fields.length !== 5) return fallback;

  const matchers = [
    parseField(fields[0], 0, 59),
    parseField(fields[1], 0, 23),
    parseField(fields[2], 1, 31),
    parseField(fields[3], 1, 12),
    parseField(fields[4], 0, 6),
  ];
  if (matchers.some((m) => m === null)) return fallback;

  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  const limit = from.getTime() + 366 * 86_400_000;
  while (cursor.getTime() < limit) {
    const [minute, hour, day, month, weekday] = matchers as Set<number>[];
    if (
      minute.has(cursor.getUTCMinutes()) &&
      hour.has(cursor.getUTCHours()) &&
      day.has(cursor.getUTCDate()) &&
      month.has(cursor.getUTCMonth() + 1) &&
      weekday.has(cursor.getUTCDay())
    ) {
      return cursor;
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return fallback;
}

function parseField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) return null;
    let start = min;
    let end = max;
    if (range !== '*') {
      const [a, b] = range.split('-').map(Number);
      if (!Number.isInteger(a)) return null;
      start = a;
      end = b === undefined ? (stepRaw ? max : a) : b;
      if (!Number.isInteger(end)) return null;
    }
    if (start < min || end > max || start > end) return null;
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values.size ? values : null;
}
