import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  CO_VACATION_DAYS_PER_YEAR,
  DOMAIN_EVENTS,
  ERROR_CODES,
  colombianHolidays,
  countDays,
  fromDateKey,
  toDateKey,
  type LeaveRequestInput,
} from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { ScopeService } from '../../core/access/scope.service';
import { AuditService } from '../../core/audit/audit.service';
import { FilesService } from '../../core/files/files.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import {
  WORKFLOW_RESOLVED,
  WorkflowsService,
  type WorkflowResolvedEvent,
} from '../../core/workflows/workflows.service';

export const LEAVE_ENTITY = 'leave_request';

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly workflows: WorkflowsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly events: EventEmitter2,
  ) {}

  /* ------------------------------ holidays ------------------------------ */

  async holidaysFor(companyId: string, from: Date, to: Date): Promise<Set<string>> {
    const rows = await this.prisma.holiday.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      select: { date: true },
    });
    return new Set(rows.map((row) => toDateKey(row.date)));
  }

  /** Loads the Colombian public holidays for a range of years. */
  async seedHolidays(companyId: string, years: number[]): Promise<number> {
    let created = 0;
    for (const year of years) {
      for (const holiday of colombianHolidays(year)) {
        const exists = await this.prisma.holiday.findFirst({
          where: { companyId, date: fromDateKey(holiday.date), locationId: null },
        });
        if (exists) continue;
        await this.prisma.holiday.create({
          data: {
            companyId,
            date: fromDateKey(holiday.date),
            name: holiday.name,
            country: 'CO',
          },
        });
        created += 1;
      }
    }
    return created;
  }

  /* ------------------------------ balances ------------------------------ */

  /**
   * Accrues vacation days proportionally to the time worked in the year.
   * Colombia: 15 business days per completed year of service. Days only,
   * never money.
   */
  async recalculateBalance(companyId: string, employeeId: string, year = new Date().getUTCFullYear()) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { hiredAt: true, terminatedAt: true },
    });
    if (!employee) return null;

    const vacationType = await this.prisma.leaveType.findFirst({
      where: { companyId, code: 'vacaciones', deletedAt: null },
    });
    if (!vacationType) return null;

    const policy =
      (await this.prisma.leavePolicy.findFirst({
        where: { companyId, isDefault: true, deletedAt: null },
      })) ?? null;
    const daysPerYear = policy ? Number(policy.daysPerYear) : CO_VACATION_DAYS_PER_YEAR;

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const start = employee.hiredAt > yearStart ? employee.hiredAt : yearStart;
    const end = employee.terminatedAt && employee.terminatedAt < yearEnd ? employee.terminatedAt : yearEnd;
    const today = new Date();
    const effectiveEnd = end > today ? today : end;

    const daysWorked = Math.max(
      0,
      Math.floor((effectiveEnd.getTime() - start.getTime()) / 86_400_000) + 1,
    );
    const accrued = Number(((daysWorked / 365) * daysPerYear).toFixed(2));

    const [taken, pending, adjustments] = await Promise.all([
      this.prisma.leaveRequest.aggregate({
        where: {
          companyId,
          employeeId,
          leaveTypeId: vacationType.id,
          status: { in: ['approved', 'taken'] },
          deletedAt: null,
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { requestedDays: true },
      }),
      this.prisma.leaveRequest.aggregate({
        where: {
          companyId,
          employeeId,
          leaveTypeId: vacationType.id,
          status: 'pending',
          deletedAt: null,
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { requestedDays: true },
      }),
      this.prisma.leaveBalanceAdjustment.aggregate({
        where: { companyId, employeeId, year },
        _sum: { days: true },
      }),
    ]);

    const takenDays = Number(taken._sum.requestedDays ?? 0);
    const pendingDays = Number(pending._sum.requestedDays ?? 0);
    const adjustedDays = Number(adjustments._sum.days ?? 0);

    return this.prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId: vacationType.id, year },
      },
      create: {
        companyId,
        employeeId,
        leaveTypeId: vacationType.id,
        policyId: policy?.id ?? null,
        year,
        accruedDays: new Prisma.Decimal(accrued),
        takenDays: new Prisma.Decimal(takenDays),
        pendingDays: new Prisma.Decimal(pendingDays),
        adjustedDays: new Prisma.Decimal(adjustedDays),
        lastAccrualAt: new Date(),
      },
      update: {
        accruedDays: new Prisma.Decimal(accrued),
        takenDays: new Prisma.Decimal(takenDays),
        pendingDays: new Prisma.Decimal(pendingDays),
        adjustedDays: new Prisma.Decimal(adjustedDays),
        policyId: policy?.id ?? undefined,
        lastAccrualAt: new Date(),
      },
    });
  }

  async balanceFor(companyId: string, employeeId: string, year = new Date().getUTCFullYear()) {
    const balance = await this.recalculateBalance(companyId, employeeId, year);
    if (!balance) return null;
    const available =
      Number(balance.accruedDays) +
      Number(balance.adjustedDays) +
      Number(balance.carryOverDays) -
      Number(balance.takenDays) -
      Number(balance.pendingDays);
    return {
      year,
      accruedDays: Number(balance.accruedDays),
      takenDays: Number(balance.takenDays),
      pendingDays: Number(balance.pendingDays),
      adjustedDays: Number(balance.adjustedDays),
      carryOverDays: Number(balance.carryOverDays),
      availableDays: Number(available.toFixed(2)),
    };
  }

  async adjustBalance(
    ctx: RequestContext,
    input: { employeeId: string; days: number; reason: string; year?: number },
  ) {
    this.scope.requirePermission(ctx, 'leaves.balance.adjust');
    const year = input.year ?? new Date().getUTCFullYear();
    const adjustment = await this.prisma.leaveBalanceAdjustment.create({
      data: {
        companyId: ctx.companyId,
        employeeId: input.employeeId,
        days: new Prisma.Decimal(input.days),
        reason: input.reason,
        year,
        createdById: ctx.userId,
      },
    });
    await this.recalculateBalance(ctx.companyId, input.employeeId, year);
    await this.audit.record(ctx, {
      action: 'update',
      entityType: 'leave_balance_adjustment',
      entityId: adjustment.id,
      summary: `Ajuste de ${input.days} dias: ${input.reason}`,
    });
    return adjustment;
  }

  /* ------------------------------ requests ------------------------------ */

  /** Business days (or calendar days) of a request, honouring half days. */
  async computeDays(
    companyId: string,
    leaveTypeId: string,
    startDate: Date,
    endDate: Date,
    halfDayStart: boolean,
    halfDayEnd: boolean,
  ): Promise<number> {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: leaveTypeId, companyId },
    });
    if (!leaveType) throw BusinessException.notFound('Tipo de ausencia');

    const holidays = leaveType.countsBusinessDays
      ? await this.holidaysFor(companyId, startDate, endDate)
      : new Set<string>();
    let days = countDays(startDate, endDate, {
      businessDays: leaveType.countsBusinessDays,
      holidays,
    });
    if (halfDayStart) days -= 0.5;
    if (halfDayEnd && startDate.getTime() !== endDate.getTime()) days -= 0.5;
    return Math.max(0, Number(days.toFixed(2)));
  }

  async createRequest(ctx: RequestContext, input: LeaveRequestInput) {
    const employeeId = input.employeeId ?? ctx.employeeId;
    if (!employeeId) throw BusinessException.forbidden('No hay colaborador asociado a la solicitud');

    if (employeeId !== ctx.employeeId) {
      await this.scope.assertEmployeeInScope(ctx, 'leaves.request.create', employeeId);
    }

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: input.leaveTypeId, companyId: ctx.companyId, isActive: true, deletedAt: null },
    });
    if (!leaveType) throw BusinessException.notFound('Tipo de ausencia');

    const startDate = fromDateKey(input.startDate);
    const endDate = fromDateKey(input.endDate);

    if (leaveType.requiresAttachment && !input.fileIds.length) {
      throw new BusinessException(
        ERROR_CODES.LEAVE_ATTACHMENT_REQUIRED,
        `${leaveType.name} requiere adjuntar el soporte`,
        422,
      );
    }

    if (leaveType.minNoticeDays > 0) {
      const noticeDays = Math.floor((startDate.getTime() - Date.now()) / 86_400_000);
      if (noticeDays < leaveType.minNoticeDays) {
        throw new BusinessException(
          ERROR_CODES.LEAVE_MIN_NOTICE,
          `Este tipo de ausencia requiere solicitarse con ${leaveType.minNoticeDays} dias de anticipacion`,
          422,
          { minNoticeDays: leaveType.minNoticeDays },
        );
      }
    }

    const requestedDays = await this.computeDays(
      ctx.companyId,
      leaveType.id,
      startDate,
      endDate,
      input.halfDayStart,
      input.halfDayEnd,
    );

    if (requestedDays <= 0) {
      throw BusinessException.validation('El rango seleccionado no contiene dias habiles');
    }
    if (leaveType.maxDaysPerRequest && requestedDays > leaveType.maxDaysPerRequest) {
      throw new BusinessException(
        ERROR_CODES.LEAVE_MAX_DAYS,
        `El maximo por solicitud es de ${leaveType.maxDaysPerRequest} dias`,
        422,
        { maxDaysPerRequest: leaveType.maxDaysPerRequest },
      );
    }

    // No overlap with any other pending or approved absence of the employee.
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        companyId: ctx.companyId,
        employeeId,
        deletedAt: null,
        status: { in: ['pending', 'approved', 'taken'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, startDate: true, endDate: true },
    });
    if (overlap) {
      throw new BusinessException(
        ERROR_CODES.LEAVE_OVERLAP,
        'Ya existe una ausencia registrada que se cruza con las fechas solicitadas',
        409,
        overlap,
      );
    }

    if (leaveType.affectsBalance) {
      const balance = await this.balanceFor(ctx.companyId, employeeId, startDate.getUTCFullYear());
      if (balance && balance.availableDays < requestedDays) {
        throw new BusinessException(
          ERROR_CODES.INSUFFICIENT_BALANCE,
          `Saldo insuficiente: dispone de ${balance.availableDays} dias y solicita ${requestedDays}`,
          422,
          balance,
        );
      }
    }

    if (leaveType.requiresCoverage && !input.coverageEmployeeId) {
      throw new BusinessException(
        ERROR_CODES.LEAVE_COVERAGE,
        'Debe indicar quien cubrira sus funciones',
        422,
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: ctx.companyId },
      select: { fullName: true, managerId: true },
    });

    const request = await this.prisma.leaveRequest.create({
      data: {
        companyId: ctx.companyId,
        employeeId,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        halfDayStart: input.halfDayStart,
        halfDayEnd: input.halfDayEnd,
        requestedDays: new Prisma.Decimal(requestedDays),
        status: leaveType.requiresApproval ? 'pending' : 'approved',
        reason: input.reason ?? null,
        coverageEmployeeId: input.coverageEmployeeId ?? null,
        createdById: ctx.userId,
        ...(leaveType.requiresApproval ? {} : { decidedAt: new Date(), decidedById: ctx.userId }),
      },
    });

    if (input.fileIds.length) {
      await this.files.linkMany(ctx.companyId, input.fileIds, LEAVE_ENTITY, request.id);
    }

    if (leaveType.requiresApproval) {
      const { instanceId, status } = await this.workflows.start({
        companyId: ctx.companyId,
        entityType: LEAVE_ENTITY,
        entityId: request.id,
        title: `${leaveType.name}: ${employee?.fullName ?? ''}`.trim(),
        summary: `${input.startDate} a ${input.endDate} (${requestedDays} dias)`,
        requestedByUserId: ctx.userId,
        subjectEmployeeId: employeeId,
        context: { days: requestedDays, leaveTypeCode: leaveType.code },
        url: `/leaves/requests/${request.id}`,
      });
      if (instanceId) {
        await this.prisma.leaveRequest.update({
          where: { id: request.id },
          data: { workflowInstanceId: instanceId },
        });
      }
      if (status === 'approved') await this.applyDecision(ctx.companyId, request.id, 'approved');
    } else {
      await this.applyDecision(ctx.companyId, request.id, 'approved');
    }

    await this.recalculateBalance(ctx.companyId, employeeId, startDate.getUTCFullYear());
    await this.events.emitAsync(DOMAIN_EVENTS.LEAVE_REQUESTED, {
      companyId: ctx.companyId,
      leaveRequestId: request.id,
      employeeId,
      leaveTypeCode: leaveType.code,
      startDate: input.startDate,
      endDate: input.endDate,
      days: requestedDays,
    });

    return this.prisma.leaveRequest.findFirst({
      where: { id: request.id },
      include: { leaveType: true, employee: { select: { id: true, fullName: true } } },
    });
  }

  /** Reacts to the approval engine resolving a leave request. */
  @OnEvent(WORKFLOW_RESOLVED, { async: true })
  async onWorkflowResolved(event: WorkflowResolvedEvent): Promise<void> {
    if (event.entityType !== LEAVE_ENTITY) return;
    await this.applyDecision(
      event.companyId,
      event.entityId,
      event.status === 'approved' ? 'approved' : 'rejected',
      event.decidedByUserId,
      event.comment,
    );
  }

  private async applyDecision(
    companyId: string,
    requestId: string,
    decision: 'approved' | 'rejected',
    decidedByUserId?: string | null,
    comment?: string | null,
  ): Promise<void> {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, companyId },
      include: { leaveType: true, employee: { select: { id: true, userId: true, fullName: true } } },
    });
    if (!request || ['approved', 'rejected', 'cancelled'].includes(request.status)) {
      if (!request || request.status !== 'pending') return;
    }

    await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedById: decidedByUserId ?? null,
        decisionComment: comment ?? null,
      },
    });

    if (decision === 'approved') {
      await this.syncAttendance(companyId, requestId);
    }

    await this.recalculateBalance(companyId, request.employeeId, request.startDate.getUTCFullYear());

    if (request.employee.userId) {
      await this.notifications.notify({
        companyId,
        userIds: [request.employee.userId],
        eventKey: decision === 'approved' ? DOMAIN_EVENTS.LEAVE_APPROVED : DOMAIN_EVENTS.LEAVE_REJECTED,
        title:
          decision === 'approved'
            ? `Su solicitud de ${request.leaveType.name} fue aprobada`
            : `Su solicitud de ${request.leaveType.name} fue rechazada`,
        body: comment ?? undefined,
        url: `/portal/solicitudes`,
        entityType: LEAVE_ENTITY,
        entityId: requestId,
      });
    }

    await this.events.emitAsync(
      decision === 'approved' ? DOMAIN_EVENTS.LEAVE_APPROVED : DOMAIN_EVENTS.LEAVE_REJECTED,
      { companyId, leaveRequestId: requestId, employeeId: request.employeeId },
    );
  }

  /** Marks the affected attendance days as leave. */
  private async syncAttendance(companyId: string, requestId: string): Promise<void> {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id: requestId, companyId } });
    if (!request) return;
    for (
      let day = new Date(request.startDate);
      day <= request.endDate;
      day = new Date(day.getTime() + 86_400_000)
    ) {
      await this.prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId: request.employeeId, date: day } },
        create: {
          companyId,
          employeeId: request.employeeId,
          date: day,
          status: 'leave',
          leaveRequestId: request.id,
        },
        update: { status: 'leave', leaveRequestId: request.id },
      });
    }
  }

  async cancelRequest(ctx: RequestContext, id: string, reason?: string | null) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!request) throw BusinessException.notFound('Solicitud');
    if (request.employeeId !== ctx.employeeId) {
      this.scope.requirePermission(ctx, 'leaves.request.approve');
    }
    if (request.status === 'cancelled') return request;
    if (request.status === 'taken') {
      throw BusinessException.validation('La ausencia ya fue disfrutada y no puede anularse');
    }

    await this.workflows.cancel(ctx.companyId, LEAVE_ENTITY, id);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date(), decisionComment: reason ?? null },
    });
    await this.prisma.attendanceDay.updateMany({
      where: { leaveRequestId: id },
      data: { status: 'pending', leaveRequestId: null },
    });
    await this.recalculateBalance(ctx.companyId, request.employeeId, request.startDate.getUTCFullYear());
    await this.events.emitAsync(DOMAIN_EVENTS.LEAVE_CANCELLED, {
      companyId: ctx.companyId,
      leaveRequestId: id,
      employeeId: request.employeeId,
    });
    return updated;
  }

  /* ------------------------------- listing ------------------------------ */

  async listRequests(
    ctx: RequestContext,
    params: {
      page: number;
      limit: number;
      status?: string;
      employeeId?: string;
      leaveTypeId?: string;
      from?: string;
      to?: string;
      onlyMine?: boolean;
    },
  ) {
    const employeeScope = params.onlyMine
      ? { kind: 'ids' as const, ids: ctx.employeeId ? [ctx.employeeId] : [] }
      : await this.scope.employeeScope(ctx, 'leaves.request.read');

    const where: Prisma.LeaveRequestWhereInput = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(employeeScope.kind === 'ids' ? { employeeId: { in: employeeScope.ids } } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.leaveTypeId ? { leaveTypeId: params.leaveTypeId } : {}),
      ...(params.from || params.to
        ? {
            startDate: params.to ? { lte: fromDateKey(params.to) } : undefined,
            endDate: params.from ? { gte: fromDateKey(params.from) } : undefined,
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: { select: { id: true, name: true, code: true, color: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { rows, total };
  }

  /** Team calendar: approved and pending absences in a date range. */
  async calendar(
    ctx: RequestContext,
    params: { from: string; to: string; departmentId?: string; locationId?: string },
  ) {
    const employeeScope = await this.scope.employeeScope(ctx, 'leaves.request.read');
    const from = fromDateKey(params.from);
    const to = fromDateKey(params.to);

    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: { in: ['pending', 'approved', 'taken'] },
        startDate: { lte: to },
        endDate: { gte: from },
        ...(employeeScope.kind === 'ids' ? { employeeId: { in: employeeScope.ids } } : {}),
        ...(params.departmentId || params.locationId
          ? {
              employee: {
                ...(params.departmentId ? { departmentId: params.departmentId } : {}),
                ...(params.locationId ? { locationId: params.locationId } : {}),
              },
            }
          : {}),
      },
      include: {
        leaveType: { select: { name: true, color: true, code: true } },
        employee: { select: { id: true, fullName: true, department: { select: { name: true } } } },
      },
      orderBy: { startDate: 'asc' },
    });

    const holidays = await this.prisma.holiday.findMany({
      where: { companyId: ctx.companyId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    return { absences: rows, holidays };
  }

  /* --------------------------- payroll export --------------------------- */

  /**
   * Exports absences and personnel events for an external payroll system.
   * This is the only interface with payroll and it is outbound only:
   * TALENTO never calculates any monetary value.
   */
  async buildPayrollExport(
    ctx: RequestContext,
    params: { from: string; to: string; scopes: string[]; name?: string },
  ) {
    const from = fromDateKey(params.from);
    const to = fromDateKey(params.to);
    const rows: Array<Record<string, string | number>> = [];

    if (params.scopes.includes('leaves')) {
      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          companyId: ctx.companyId,
          deletedAt: null,
          status: { in: ['approved', 'taken'] },
          startDate: { lte: to },
          endDate: { gte: from },
        },
        include: {
          leaveType: true,
          employee: { select: { employeeCode: true, documentNumber: true, fullName: true } },
        },
        orderBy: { startDate: 'asc' },
      });
      for (const leave of leaves) {
        rows.push({
          tipo: 'AUSENCIA',
          codigo_novedad: leave.leaveType.payrollCode ?? leave.leaveType.code,
          concepto: leave.leaveType.name,
          codigo_empleado: leave.employee.employeeCode,
          documento: leave.employee.documentNumber,
          nombre: leave.employee.fullName,
          fecha_inicio: toDateKey(leave.startDate),
          fecha_fin: toDateKey(leave.endDate),
          dias: Number(leave.requestedDays),
          remunerada: leave.leaveType.isPaid ? 'SI' : 'NO',
        });
      }
    }

    if (params.scopes.includes('events')) {
      const events = await this.prisma.employeeEvent.findMany({
        where: {
          companyId: ctx.companyId,
          deletedAt: null,
          startDate: { lte: to, gte: from },
        },
        include: { employee: { select: { employeeCode: true, documentNumber: true, fullName: true } } },
      });
      for (const event of events) {
        rows.push({
          tipo: 'NOVEDAD',
          codigo_novedad: event.payrollCode ?? event.eventType,
          concepto: event.title,
          codigo_empleado: event.employee.employeeCode,
          documento: event.employee.documentNumber,
          nombre: event.employee.fullName,
          fecha_inicio: toDateKey(event.startDate),
          fecha_fin: event.endDate ? toDateKey(event.endDate) : toDateKey(event.startDate),
          dias: 0,
          cantidad: event.quantity ? Number(event.quantity) : 0,
          unidad: event.unit ?? '',
        });
      }
    }

    if (params.scopes.includes('attendance')) {
      const attendance = await this.prisma.attendanceDay.findMany({
        where: {
          companyId: ctx.companyId,
          date: { gte: from, lte: to },
          OR: [{ overtimeMinutes: { gt: 0 } }, { status: 'absent' }],
        },
        include: { employee: { select: { employeeCode: true, documentNumber: true, fullName: true } } },
      });
      for (const day of attendance) {
        rows.push({
          tipo: 'ASISTENCIA',
          codigo_novedad: day.status === 'absent' ? 'AUSENCIA_INJUSTIFICADA' : 'HORAS_EXTRA_INFORMATIVAS',
          concepto: day.status,
          codigo_empleado: day.employee.employeeCode,
          documento: day.employee.documentNumber,
          nombre: day.employee.fullName,
          fecha_inicio: toDateKey(day.date),
          fecha_fin: toDateKey(day.date),
          dias: day.status === 'absent' ? 1 : 0,
          horas_extra: Number((day.overtimeMinutes / 60).toFixed(2)),
        });
      }
    }

    const record = await this.prisma.payrollExport.create({
      data: {
        companyId: ctx.companyId,
        name: params.name ?? `Novedades ${params.from} a ${params.to}`,
        periodFrom: from,
        periodTo: to,
        format: 'csv',
        scopes: params.scopes,
        rowCount: rows.length,
        status: 'success',
        createdById: ctx.userId,
      },
    });

    await this.prisma.leaveRequest.updateMany({
      where: {
        companyId: ctx.companyId,
        status: { in: ['approved', 'taken'] },
        startDate: { lte: to },
        endDate: { gte: from },
      },
      data: { exportedAt: new Date() },
    });

    await this.audit.record(ctx, {
      action: 'export',
      entityType: 'payroll_export',
      entityId: record.id,
      summary: `Exportacion de novedades ${params.from} a ${params.to} (${rows.length} filas)`,
    });

    return { export: record, rows };
  }
}
