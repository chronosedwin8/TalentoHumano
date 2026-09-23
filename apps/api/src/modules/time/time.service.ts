import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AttendanceStatus, ClockSource, ClockType } from '@prisma/client';
import {
  DOMAIN_EVENTS,
  ERROR_CODES,
  distanceMeters,
  fromDateKey,
  toDateKey,
} from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { ScopeService } from '../../core/access/scope.service';

export interface ClockInput {
  type: ClockType;
  source: ClockSource;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  locationId?: string | null;
  photoFileId?: string | null;
  notes?: string | null;
  occurredAt?: string;
}

const CLOCK_SEQUENCE: Record<ClockType, ClockType[]> = {
  in: ['out', 'break_start'],
  break_start: ['break_end'],
  break_end: ['out', 'break_start'],
  out: ['in'],
};

@Injectable()
export class TimeService {
  private readonly logger = new Logger(TimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly events: EventEmitter2,
  ) {}

  /* ------------------------------ clocking ------------------------------ */

  async clock(ctx: RequestContext, employeeId: string, input: ClockInput) {
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const localDate = fromDateKey(toDateKey(occurredAt));

    const last = await this.prisma.timeClockEntry.findFirst({
      where: { companyId: ctx.companyId, employeeId, localDate },
      orderBy: { occurredAt: 'desc' },
    });

    if (last) {
      if (
        Math.abs(occurredAt.getTime() - last.occurredAt.getTime()) < 60_000 &&
        last.type === input.type
      ) {
        throw new BusinessException(
          ERROR_CODES.CLOCK_DUPLICATE,
          'Ya se registro una marcacion identica hace menos de un minuto',
          409,
        );
      }
      const allowed = CLOCK_SEQUENCE[last.type];
      if (!allowed.includes(input.type)) {
        throw new BusinessException(
          ERROR_CODES.CLOCK_SEQUENCE_INVALID,
          `Despues de "${last.type}" solo puede registrar: ${allowed.join(', ')}`,
          422,
          { lastType: last.type, allowed },
        );
      }
    } else if (input.type !== 'in') {
      throw new BusinessException(
        ERROR_CODES.CLOCK_SEQUENCE_INVALID,
        'La primera marcacion del dia debe ser una entrada',
        422,
      );
    }

    let withinGeofence: boolean | null = null;
    if (input.latitude != null && input.longitude != null) {
      withinGeofence = await this.checkGeofence(
        ctx.companyId,
        employeeId,
        input.latitude,
        input.longitude,
        input.locationId ?? null,
      );
      if (withinGeofence === false && input.source === 'mobile') {
        throw new BusinessException(
          ERROR_CODES.CLOCK_OUT_OF_GEOFENCE,
          'Se encuentra fuera del area permitida para marcar',
          422,
        );
      }
    }

    const entry = await this.prisma.timeClockEntry.create({
      data: {
        companyId: ctx.companyId,
        employeeId,
        type: input.type,
        source: input.source,
        occurredAt,
        localDate,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        accuracy: input.accuracy ?? null,
        withinGeofence,
        locationId: input.locationId ?? null,
        photoFileId: input.photoFileId ?? null,
        notes: input.notes ?? null,
        isManual: input.source === 'manual',
        createdById: ctx.userId,
      },
    });

    await this.recomputeDay(ctx.companyId, employeeId, localDate);
    await this.events.emitAsync(DOMAIN_EVENTS.ATTENDANCE_CLOCKED, {
      companyId: ctx.companyId,
      employeeId,
      type: input.type,
      occurredAt: occurredAt.toISOString(),
    });

    return entry;
  }

  private async checkGeofence(
    companyId: string,
    employeeId: string,
    latitude: number,
    longitude: number,
    locationId: string | null,
  ): Promise<boolean | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { locationId: true },
    });
    const targetLocation = locationId ?? employee?.locationId ?? null;
    const geofences = await this.prisma.geofence.findMany({
      where: {
        companyId,
        isActive: true,
        ...(targetLocation ? { locationId: targetLocation } : {}),
      },
    });
    if (!geofences.length) return null;
    return geofences.some(
      (fence) =>
        distanceMeters(latitude, longitude, Number(fence.latitude), Number(fence.longitude)) <=
        fence.radiusMeters,
    );
  }

  /** Rebuilds the daily attendance record from the raw clock entries. */
  async recomputeDay(companyId: string, employeeId: string, date: Date) {
    const entries = await this.prisma.timeClockEntry.findMany({
      where: { companyId, employeeId, localDate: date },
      orderBy: { occurredAt: 'asc' },
    });

    const schedule = await this.scheduleFor(companyId, employeeId, date);
    const holiday = await this.prisma.holiday.findFirst({ where: { companyId, date } });
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        companyId,
        employeeId,
        deletedAt: null,
        status: { in: ['approved', 'taken'] },
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { id: true },
    });

    const firstIn = entries.find((e) => e.type === 'in')?.occurredAt ?? null;
    const lastOut = [...entries].reverse().find((e) => e.type === 'out')?.occurredAt ?? null;

    let breakMinutes = 0;
    let breakStart: Date | null = null;
    for (const entry of entries) {
      if (entry.type === 'break_start') breakStart = entry.occurredAt;
      if (entry.type === 'break_end' && breakStart) {
        breakMinutes += Math.round((entry.occurredAt.getTime() - breakStart.getTime()) / 60_000);
        breakStart = null;
      }
    }

    const workedMinutes =
      firstIn && lastOut
        ? Math.max(0, Math.round((lastOut.getTime() - firstIn.getTime()) / 60_000) - breakMinutes)
        : 0;

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;

    if (schedule?.isWorkingDay && firstIn) {
      const scheduledIn = this.combine(date, schedule.startTime);
      const tolerance = schedule.toleranceMinutes;
      const diff = Math.round((firstIn.getTime() - scheduledIn.getTime()) / 60_000);
      lateMinutes = Math.max(0, diff - tolerance);
    }
    if (schedule?.isWorkingDay && lastOut) {
      const scheduledOut = this.combine(date, schedule.endTime);
      const diff = Math.round((scheduledOut.getTime() - lastOut.getTime()) / 60_000);
      earlyLeaveMinutes = Math.max(0, diff);
      overtimeMinutes = Math.max(0, -diff);
    }

    let status: AttendanceStatus = 'pending';
    if (leave) status = 'leave';
    else if (holiday) status = 'holiday';
    else if (!schedule?.isWorkingDay) status = 'rest';
    else if (!entries.length) status = date < new Date() ? 'absent' : 'pending';
    else if (lateMinutes > 0) status = 'late';
    else if (earlyLeaveMinutes > 0) status = 'early_leave';
    else status = 'present';

    return this.prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        companyId,
        employeeId,
        date,
        status,
        scheduledStart: schedule?.startTime ?? null,
        scheduledEnd: schedule?.endTime ?? null,
        firstIn,
        lastOut,
        workedMinutes,
        breakMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        leaveRequestId: leave?.id ?? null,
        computedAt: new Date(),
      },
      update: {
        status,
        scheduledStart: schedule?.startTime ?? null,
        scheduledEnd: schedule?.endTime ?? null,
        firstIn,
        lastOut,
        workedMinutes,
        breakMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        leaveRequestId: leave?.id ?? null,
        computedAt: new Date(),
      },
    });
  }

  private combine(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes),
    );
  }

  private async scheduleFor(companyId: string, employeeId: string, date: Date) {
    const assignment = await this.prisma.employeeSchedule.findFirst({
      where: {
        companyId,
        employeeId,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      include: { schedule: { include: { rules: true } } },
      orderBy: { startDate: 'desc' },
    });

    const schedule =
      assignment?.schedule ??
      (await this.prisma.workSchedule.findFirst({
        where: { companyId, isDefault: true, deletedAt: null },
        include: { rules: true },
      }));
    if (!schedule) return null;

    const rule = schedule.rules.find((r) => r.weekday === date.getUTCDay());
    if (!rule) return null;
    return {
      startTime: rule.startTime,
      endTime: rule.endTime,
      breakMinutes: rule.breakMinutes,
      isWorkingDay: rule.isWorkingDay,
      toleranceMinutes: schedule.toleranceMinutes,
    };
  }

  /* ----------------------------- attendance ----------------------------- */

  async attendance(
    ctx: RequestContext,
    params: {
      from: string;
      to: string;
      employeeId?: string;
      departmentId?: string;
      status?: string;
      page: number;
      limit: number;
    },
  ) {
    const employeeScope = await this.scope.employeeScope(ctx, 'time.attendance.read');
    const where = {
      companyId: ctx.companyId,
      date: { gte: fromDateKey(params.from), lte: fromDateKey(params.to) },
      ...(employeeScope.kind === 'ids' ? { employeeId: { in: employeeScope.ids } } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.status ? { status: params.status as AttendanceStatus } : {}),
      ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.attendanceDay.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.attendanceDay.count({ where }),
    ]);

    return { rows, total };
  }

  async attendanceSummary(ctx: RequestContext, from: string, to: string) {
    const employeeScope = await this.scope.employeeScope(ctx, 'time.attendance.read');
    const where = {
      companyId: ctx.companyId,
      date: { gte: fromDateKey(from), lte: fromDateKey(to) },
      ...(employeeScope.kind === 'ids' ? { employeeId: { in: employeeScope.ids } } : {}),
    };

    const [byStatus, totals] = await Promise.all([
      this.prisma.attendanceDay.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.attendanceDay.aggregate({
        where,
        _sum: { workedMinutes: true, lateMinutes: true, overtimeMinutes: true },
        _count: { _all: true },
      }),
    ]);

    const total = totals._count._all || 1;
    const present = byStatus
      .filter((row) => ['present', 'late', 'early_leave', 'remote'].includes(row.status))
      .reduce((acc, row) => acc + row._count._all, 0);
    const absent = byStatus.find((row) => row.status === 'absent')?._count._all ?? 0;
    const late = byStatus.find((row) => row.status === 'late')?._count._all ?? 0;

    return {
      byStatus: byStatus.map((row) => ({ label: row.status, value: row._count._all })),
      punctualityRate: Number((((present - late) / total) * 100).toFixed(1)),
      absenteeismRate: Number(((absent / total) * 100).toFixed(1)),
      workedHours: Number(((totals._sum.workedMinutes ?? 0) / 60).toFixed(1)),
      overtimeHours: Number(((totals._sum.overtimeMinutes ?? 0) / 60).toFixed(1)),
      days: totals._count._all,
    };
  }

  /** Manual correction by HR; the original entries are preserved. */
  async correctDay(
    ctx: RequestContext,
    attendanceDayId: string,
    input: { status?: AttendanceStatus; notes?: string | null; workedMinutes?: number },
  ) {
    this.scope.requirePermission(ctx, 'time.attendance.update');
    const day = await this.prisma.attendanceDay.findFirst({
      where: { id: attendanceDayId, companyId: ctx.companyId },
    });
    if (!day) throw BusinessException.notFound('Dia de asistencia');
    return this.prisma.attendanceDay.update({
      where: { id: day.id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.workedMinutes !== undefined ? { workedMinutes: input.workedMinutes } : {}),
        updatedById: ctx.userId,
      },
    });
  }

  /* --------------------------- device ingestion -------------------------- */

  /** CSV/API ingestion from biometric clocks. */
  async ingestEntries(
    companyId: string,
    rows: Array<{
      employeeCode?: string;
      documentNumber?: string;
      timestamp: string;
      type: ClockType;
      deviceSerial?: string;
    }>,
  ) {
    const results = { imported: 0, skipped: 0, errors: [] as string[] };
    const touched = new Map<string, Set<string>>();

    for (const row of rows) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          companyId,
          deletedAt: null,
          ...(row.employeeCode
            ? { employeeCode: row.employeeCode }
            : { documentNumber: row.documentNumber ?? '' }),
        },
        select: { id: true },
      });
      if (!employee) {
        results.skipped += 1;
        results.errors.push(`Colaborador no encontrado: ${row.employeeCode ?? row.documentNumber}`);
        continue;
      }
      const occurredAt = new Date(row.timestamp);
      if (Number.isNaN(occurredAt.getTime())) {
        results.skipped += 1;
        results.errors.push(`Fecha invalida: ${row.timestamp}`);
        continue;
      }
      const localDate = fromDateKey(toDateKey(occurredAt));
      const duplicate = await this.prisma.timeClockEntry.findFirst({
        where: { companyId, employeeId: employee.id, occurredAt, type: row.type },
      });
      if (duplicate) {
        results.skipped += 1;
        continue;
      }
      await this.prisma.timeClockEntry.create({
        data: {
          companyId,
          employeeId: employee.id,
          type: row.type,
          source: 'device',
          occurredAt,
          localDate,
        },
      });
      results.imported += 1;
      const key = employee.id;
      if (!touched.has(key)) touched.set(key, new Set());
      touched.get(key)!.add(toDateKey(localDate));
    }

    for (const [employeeId, dates] of touched) {
      for (const date of dates) {
        await this.recomputeDay(companyId, employeeId, fromDateKey(date));
      }
    }

    return results;
  }
}
