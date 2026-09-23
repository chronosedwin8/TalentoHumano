import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  AttendanceStatus,
  ClockSource,
  ClockType,
  JustificationStatus,
  WorkflowStatus,
} from '@prisma/client';
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
import { NotificationsService } from '../../core/notifications/notifications.service';

/**
 * Event keys for the time notifications. They live here instead of
 * DOMAIN_EVENTS because they only drive notification preferences.
 */
const TIME_EVENTS = {
  SHIFT_PUBLISHED: 'shift.published',
  SHIFT_SWAP_REQUESTED: 'shift.swap_requested',
  SHIFT_SWAP_DECIDED: 'shift.swap_decided',
  JUSTIFICATION_DECIDED: 'attendance.justification_decided',
} as const;

const EMPLOYEE_SUMMARY = { id: true, fullName: true, employeeCode: true } as const;

export interface AttendanceFilters {
  from: string;
  to: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
}

export interface SwapRequestInput {
  requesterAssignmentId: string;
  targetEmployeeId: string;
  targetAssignmentId?: string | null;
  reason?: string | null;
}

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
    private readonly notifications: NotificationsService,
  ) {}

  /** The guard lets superadmins through, so the service must too. */
  private canDo(ctx: RequestContext, permission: string): boolean {
    return ctx.isSuperadmin || this.scope.has(ctx, permission);
  }

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

  /** Shared filter for the attendance listing and its CSV export. */
  private async attendanceWhere(ctx: RequestContext, params: AttendanceFilters) {
    const employeeScope = await this.scope.employeeScope(ctx, 'time.attendance.read');
    return {
      companyId: ctx.companyId,
      date: { gte: fromDateKey(params.from), lte: fromDateKey(params.to) },
      ...(employeeScope.kind === 'ids' ? { employeeId: { in: employeeScope.ids } } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.status ? { status: params.status as AttendanceStatus } : {}),
      ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
    };
  }

  private readonly attendanceInclude = {
    employee: {
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
    },
  };

  async attendance(
    ctx: RequestContext,
    params: AttendanceFilters & { page: number; limit: number },
  ) {
    const where = await this.attendanceWhere(ctx, params);

    const [rows, total] = await Promise.all([
      this.prisma.attendanceDay.findMany({
        where,
        include: this.attendanceInclude,
        orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.attendanceDay.count({ where }),
    ]);

    return { rows, total };
  }

  /** Every row matching the filters, capped so a wide range cannot exhaust memory. */
  async attendanceExport(ctx: RequestContext, params: AttendanceFilters) {
    const where = await this.attendanceWhere(ctx, params);
    return this.prisma.attendanceDay.findMany({
      where,
      include: this.attendanceInclude,
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
      take: 20_000,
    });
  }

  /** Days worked remotely per employee in the period; a count, never a value. */
  async remoteSummary(ctx: RequestContext, from: string, to: string) {
    const employeeScope = await this.scope.employeeScope(ctx, 'time.attendance.read');
    const where = {
      companyId: ctx.companyId,
      date: { gte: fromDateKey(from), lte: fromDateKey(to) },
      ...(employeeScope.kind === 'ids' ? { employeeId: { in: employeeScope.ids } } : {}),
      OR: [{ status: 'remote' as AttendanceStatus }, { isRemote: true }],
    };

    const grouped = await this.prisma.attendanceDay.groupBy({
      by: ['employeeId'],
      where,
      _count: { _all: true },
      _sum: { workedMinutes: true },
    });
    if (!grouped.length) return { rows: [], totalDays: 0 };

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: grouped.map((row) => row.employeeId) } },
      select: { ...EMPLOYEE_SUMMARY, department: { select: { name: true } } },
    });
    const byId = new Map(employees.map((employee) => [employee.id, employee]));

    const rows = grouped
      .map((row) => ({
        employeeId: row.employeeId,
        fullName: byId.get(row.employeeId)?.fullName ?? '—',
        employeeCode: byId.get(row.employeeId)?.employeeCode ?? '',
        department: byId.get(row.employeeId)?.department?.name ?? null,
        remoteDays: row._count._all,
        workedHours: Number(((row._sum.workedMinutes ?? 0) / 60).toFixed(1)),
      }))
      .sort((a, b) => b.remoteDays - a.remoteDays || a.fullName.localeCompare(b.fullName));

    return { rows, totalDays: rows.reduce((acc, row) => acc + row.remoteDays, 0) };
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

  /* --------------------------- justifications --------------------------- */

  /** An employee justifies one of their own attendance days. */
  async createJustification(
    ctx: RequestContext,
    input: { attendanceDayId: string; reason: string; fileId?: string | null },
  ) {
    if (!ctx.employeeId)
      throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    const day = await this.prisma.attendanceDay.findFirst({
      where: { id: input.attendanceDayId, companyId: ctx.companyId },
      select: { id: true, employeeId: true },
    });
    if (!day) throw BusinessException.notFound('Dia de asistencia');
    if (day.employeeId !== ctx.employeeId)
      throw BusinessException.forbidden('Solo puede justificar sus propios dias');

    const pending = await this.prisma.attendanceJustification.findFirst({
      where: { attendanceDayId: day.id, status: 'pending' },
      select: { id: true },
    });
    if (pending)
      throw BusinessException.conflict('Ya existe una justificacion pendiente para ese dia');

    return this.prisma.attendanceJustification.create({
      data: {
        companyId: ctx.companyId,
        attendanceDayId: day.id,
        employeeId: ctx.employeeId,
        reason: input.reason,
        fileId: input.fileId ?? null,
      },
    });
  }

  async decideJustification(
    ctx: RequestContext,
    id: string,
    decision: 'approved' | 'rejected',
    comment?: string | null,
  ) {
    const justification = await this.prisma.attendanceJustification.findFirst({
      where: { id, companyId: ctx.companyId },
      include: { attendanceDay: { select: { date: true } } },
    });
    if (!justification) throw BusinessException.notFound('Justificacion');
    if (justification.status !== 'pending')
      throw BusinessException.validation('La justificacion ya fue decidida');

    const updated = await this.prisma.attendanceJustification.update({
      where: { id },
      data: {
        status: decision as JustificationStatus,
        decidedById: ctx.userId,
        decidedAt: new Date(),
        decisionComment: comment ?? null,
      },
    });
    if (decision === 'approved') {
      await this.prisma.attendanceDay.update({
        where: { id: justification.attendanceDayId },
        data: { notes: justification.reason.slice(0, 500), updatedById: ctx.userId },
      });
    }

    const date = toDateKey(justification.attendanceDay.date);
    await this.notifications.notify({
      companyId: ctx.companyId,
      employeeIds: [justification.employeeId],
      eventKey: TIME_EVENTS.JUSTIFICATION_DECIDED,
      title:
        decision === 'approved'
          ? `Su justificacion del ${date} fue aprobada`
          : `Su justificacion del ${date} fue rechazada`,
      body: comment ?? undefined,
      url: '/time/justifications',
      entityType: 'attendance_justification',
      entityId: id,
      channels: ['in_app'],
    });

    return updated;
  }

  /* -------------------------------- shifts ------------------------------ */

  /**
   * Assignments in a range. Managers see everything within their scope,
   * drafts included; everyone else only sees published assignments.
   */
  async planner(
    ctx: RequestContext,
    params: { from: string; to: string; departmentId?: string; employeeId?: string },
  ) {
    const employeeScope = await this.scope.employeeScope(ctx, 'time.shift.read');
    const manager = this.canDo(ctx, 'time.shift.update');
    return this.prisma.shiftAssignment.findMany({
      where: {
        companyId: ctx.companyId,
        date: { gte: fromDateKey(params.from), lte: fromDateKey(params.to) },
        ...this.scope.whereEmployee(employeeScope),
        ...(params.employeeId ? { employeeId: params.employeeId } : {}),
        ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
        ...(manager ? {} : { isPublished: true }),
      },
      include: { shift: true, employee: { select: EMPLOYEE_SUMMARY } },
      orderBy: [{ date: 'asc' }],
    });
  }

  /** Marks the draft assignments of a range as published and tells the people involved. */
  async publishAssignments(
    ctx: RequestContext,
    params: { from: string; to: string; departmentId?: string; employeeIds?: string[] },
  ) {
    const where = {
      companyId: ctx.companyId,
      isPublished: false,
      date: { gte: fromDateKey(params.from), lte: fromDateKey(params.to) },
      ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
      ...(params.employeeIds?.length ? { employeeId: { in: params.employeeIds } } : {}),
    };
    const drafts = await this.prisma.shiftAssignment.findMany({
      where,
      select: { employeeId: true },
    });
    const employeeIds = [...new Set(drafts.map((row) => row.employeeId))];
    const result = await this.prisma.shiftAssignment.updateMany({
      where,
      data: { isPublished: true },
    });
    await this.notifySchedulePublished(ctx.companyId, employeeIds, params.from, params.to);
    return { published: result.count, employees: employeeIds.length };
  }

  /** In-app notice for everyone whose schedule was just published. */
  async notifySchedulePublished(
    companyId: string,
    employeeIds: string[],
    from: string,
    to: string,
  ) {
    if (!employeeIds.length) return;
    await this.notifications.notify({
      companyId,
      employeeIds,
      eventKey: TIME_EVENTS.SHIFT_PUBLISHED,
      title: 'Se publico su programacion de turnos',
      body: `Revise sus turnos del ${from} al ${to}.`,
      url: '/time/turnos',
      entityType: 'shift_assignment',
      channels: ['in_app'],
    });
  }

  /* --------------------------------- swaps ------------------------------ */

  private async assignmentOrFail(companyId: string, id: string) {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { id, companyId },
      include: { shift: { select: { name: true, code: true } } },
    });
    if (!assignment) throw BusinessException.notFound('Asignacion de turno');
    return assignment;
  }

  async requestSwap(ctx: RequestContext, input: SwapRequestInput) {
    const requester = await this.assignmentOrFail(ctx.companyId, input.requesterAssignmentId);
    const approver = this.canDo(ctx, 'time.swap.approve');
    if (!approver && requester.employeeId !== ctx.employeeId)
      throw BusinessException.forbidden('Solo puede solicitar cambios sobre sus propios turnos');
    if (requester.employeeId === input.targetEmployeeId)
      throw BusinessException.validation('El companero del intercambio debe ser otra persona');

    if (input.targetAssignmentId) {
      const target = await this.assignmentOrFail(ctx.companyId, input.targetAssignmentId);
      if (target.employeeId !== input.targetEmployeeId)
        throw BusinessException.validation('El turno objetivo no pertenece al companero elegido');
    }

    const duplicate = await this.prisma.shiftSwapRequest.findFirst({
      where: { requesterAssignmentId: requester.id, status: 'pending' },
      select: { id: true },
    });
    if (duplicate)
      throw BusinessException.conflict('Ya existe una solicitud pendiente para ese turno');

    const swap = await this.prisma.shiftSwapRequest.create({
      data: {
        companyId: ctx.companyId,
        requesterAssignmentId: requester.id,
        targetEmployeeId: input.targetEmployeeId,
        targetAssignmentId: input.targetAssignmentId ?? null,
        reason: input.reason ?? null,
      },
    });

    const employee = await this.prisma.employee.findFirst({
      where: { id: requester.employeeId },
      select: { fullName: true },
    });
    await this.notifications.notify({
      companyId: ctx.companyId,
      employeeIds: [input.targetEmployeeId],
      eventKey: TIME_EVENTS.SHIFT_SWAP_REQUESTED,
      title: 'Le propusieron un intercambio de turno',
      body: `${employee?.fullName ?? 'Un companero'} quiere intercambiar el turno ${requester.shift.name} del ${toDateKey(requester.date)}.`,
      url: '/time/turnos',
      entityType: 'shift_swap_request',
      entityId: swap.id,
      channels: ['in_app'],
    });

    return swap;
  }

  /** Approvers see every request; others only those they take part in. */
  async listSwaps(
    ctx: RequestContext,
    params: { status?: WorkflowStatus; page: number; limit: number },
  ) {
    let participation: Record<string, unknown> = {};
    if (!this.canDo(ctx, 'time.swap.approve')) {
      if (!ctx.employeeId) return { rows: [], total: 0 };
      const mine = await this.prisma.shiftAssignment.findMany({
        where: { companyId: ctx.companyId, employeeId: ctx.employeeId },
        select: { id: true },
      });
      participation = {
        OR: [
          { requesterAssignmentId: { in: mine.map((row) => row.id) } },
          { targetEmployeeId: ctx.employeeId },
        ],
      };
    }

    const where = {
      companyId: ctx.companyId,
      ...(params.status ? { status: params.status } : {}),
      ...participation,
    };
    const [swaps, total] = await Promise.all([
      this.prisma.shiftSwapRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.shiftSwapRequest.count({ where }),
    ]);

    // The swap table has no relations, so the sides are resolved by hand.
    const assignmentIds = new Set<string>();
    const employeeIds = new Set<string>();
    for (const swap of swaps) {
      assignmentIds.add(swap.requesterAssignmentId);
      if (swap.targetAssignmentId) assignmentIds.add(swap.targetAssignmentId);
      employeeIds.add(swap.targetEmployeeId);
    }
    const [assignments, employees] = await Promise.all([
      this.prisma.shiftAssignment.findMany({
        where: { id: { in: [...assignmentIds] } },
        include: {
          shift: { select: { id: true, name: true, code: true, color: true } },
          employee: { select: EMPLOYEE_SUMMARY },
        },
      }),
      this.prisma.employee.findMany({
        where: { id: { in: [...employeeIds] } },
        select: EMPLOYEE_SUMMARY,
      }),
    ]);
    const assignmentById = new Map(assignments.map((row) => [row.id, row]));
    const employeeById = new Map(employees.map((row) => [row.id, row]));

    const rows = swaps.map((swap) => ({
      ...swap,
      requesterAssignment: assignmentById.get(swap.requesterAssignmentId) ?? null,
      targetAssignment: swap.targetAssignmentId
        ? (assignmentById.get(swap.targetAssignmentId) ?? null)
        : null,
      targetEmployee: employeeById.get(swap.targetEmployeeId) ?? null,
    }));
    return { rows, total };
  }

  /**
   * Approving moves the requester's shift to the colleague. When the request
   * names a colleague's shift too, both shifts change hands.
   */
  async decideSwap(ctx: RequestContext, id: string, decision: 'approved' | 'rejected') {
    const swap = await this.prisma.shiftSwapRequest.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!swap) throw BusinessException.notFound('Solicitud de intercambio');
    if (swap.status !== 'pending')
      throw BusinessException.validation('La solicitud ya fue decidida');

    const requester = await this.assignmentOrFail(ctx.companyId, swap.requesterAssignmentId);
    const decidedData = { status: decision, decidedById: ctx.userId, decidedAt: new Date() };

    if (decision === 'rejected') {
      const rejected = await this.prisma.shiftSwapRequest.update({
        where: { id },
        data: decidedData,
      });
      await this.notifySwapDecision(ctx.companyId, requester.employeeId, rejected.id, decision);
      return rejected;
    }

    const target = swap.targetAssignmentId
      ? await this.assignmentOrFail(ctx.companyId, swap.targetAssignmentId)
      : null;

    const taken = await this.prisma.shiftAssignment.findFirst({
      where: {
        employeeId: swap.targetEmployeeId,
        date: requester.date,
        shiftId: requester.shiftId,
        ...(target ? { id: { not: target.id } } : {}),
      },
      select: { id: true },
    });
    if (taken) throw BusinessException.conflict('El companero ya tiene ese mismo turno ese dia');

    const approved = await this.prisma.$transaction(async (tx) => {
      await tx.shiftAssignment.update({
        where: { id: requester.id },
        data: { employeeId: swap.targetEmployeeId },
      });
      if (target) {
        await tx.shiftAssignment.update({
          where: { id: target.id },
          data: { employeeId: requester.employeeId },
        });
      }
      return tx.shiftSwapRequest.update({ where: { id }, data: decidedData });
    });

    await this.notifySwapDecision(ctx.companyId, requester.employeeId, approved.id, decision);
    if (target) {
      await this.notifySwapDecision(ctx.companyId, swap.targetEmployeeId, approved.id, decision);
    }
    return approved;
  }

  private async notifySwapDecision(
    companyId: string,
    employeeId: string,
    swapId: string,
    decision: 'approved' | 'rejected',
  ) {
    await this.notifications.notify({
      companyId,
      employeeIds: [employeeId],
      eventKey: TIME_EVENTS.SHIFT_SWAP_DECIDED,
      title:
        decision === 'approved'
          ? 'Su intercambio de turno fue aprobado'
          : 'Su intercambio de turno fue rechazado',
      url: '/time/turnos',
      entityType: 'shift_swap_request',
      entityId: swapId,
      channels: ['in_app'],
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
