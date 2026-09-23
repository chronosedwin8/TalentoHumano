import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { clockEntrySchema, isoDate, MODULES, uuid, workScheduleSchema } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, Public, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged } from '../../common/utils/crud';
import { paged, parsePage } from '../../common/utils/pagination';
import { TimeService } from './time.service';

const shiftSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(30),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#0ea5e9'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).max(240).default(60),
  crossesMidnight: z.boolean().default(false),
  minRestHours: z.number().int().min(0).max(48).default(12),
  locationId: uuid.nullable().optional(),
  isActive: z.boolean().default(true),
});

const assignShiftsSchema = z.object({
  assignments: z
    .array(
      z.object({
        shiftId: uuid,
        employeeId: uuid,
        date: isoDate,
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(1000),
  publish: z.boolean().default(false),
});

const justificationSchema = z.object({
  attendanceDayId: uuid,
  reason: z.string().trim().min(5).max(1000),
  fileId: uuid.nullable().optional(),
});

const ingestSchema = z.object({
  deviceToken: z.string().max(200).optional(),
  entries: z
    .array(
      z.object({
        employeeCode: z.string().max(40).optional(),
        documentNumber: z.string().max(40).optional(),
        timestamp: z.string(),
        type: z.enum(['in', 'out', 'break_start', 'break_end']),
        deviceSerial: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(5000),
});

@ApiTags('tiempo y asistencia')
@Controller({ path: 'time', version: '1' })
@RequireModule(MODULES.TIME)
export class TimeController {
  constructor(
    private readonly time: TimeService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /* ------------------------------ clocking ------------------------------ */

  @Post('clock')
  @RequirePermission('time.clock.create')
  @Audit({ entityType: 'time_clock_entry' })
  @ApiOperation({ summary: 'Registra una marcacion del colaborador autenticado' })
  async clock(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(clockEntrySchema)) dto: z.infer<typeof clockEntrySchema>,
  ) {
    if (!ctx.employeeId)
      throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    return this.time.clock(ctx, ctx.employeeId, dto as never);
  }

  @Post('clock/:employeeId')
  @RequirePermission('time.attendance.update')
  @Audit({ entityType: 'time_clock_entry', idParam: 'employeeId' })
  @ApiOperation({ summary: 'Marcacion manual registrada por Talento Humano' })
  async clockFor(
    @Ctx() ctx: RequestContext,
    @Param('employeeId', new ZodValidationPipe(uuid)) employeeId: string,
    @Body(new ZodValidationPipe(clockEntrySchema)) dto: z.infer<typeof clockEntrySchema>,
  ) {
    return this.time.clock(ctx, employeeId, { ...dto, source: 'manual' } as never);
  }

  @Get('clock/today')
  @RequirePermission('time.clock.read')
  @ApiOperation({ summary: 'Marcaciones del dia del colaborador autenticado' })
  async today(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return { entries: [], day: null };
    const today = new Date();
    const localDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const [entries, day] = await Promise.all([
      this.prisma.timeClockEntry.findMany({
        where: { companyId: ctx.companyId, employeeId: ctx.employeeId, localDate },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.attendanceDay.findFirst({
        where: { companyId: ctx.companyId, employeeId: ctx.employeeId, date: localDate },
      }),
    ]);
    return { entries, day };
  }

  /* ----------------------------- attendance ----------------------------- */

  @Get('attendance')
  @RequirePermission('time.attendance.read')
  @ApiOperation({ summary: 'Asistencia diaria calculada' })
  async attendance(
    @Ctx() ctx: RequestContext,
    @Query()
    query: {
      from: string;
      to: string;
      employeeId?: string;
      departmentId?: string;
      status?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.time.attendance(ctx, {
      from: query.from,
      to: query.to,
      employeeId: query.employeeId,
      departmentId: query.departmentId,
      status: query.status,
      page,
      limit,
    });
    return paged(rows, total, page, limit);
  }

  @Get('attendance/summary')
  @RequirePermission('time.report.read')
  @ApiOperation({ summary: 'Indicadores de puntualidad y ausentismo' })
  async summary(@Ctx() ctx: RequestContext, @Query() query: { from: string; to: string }) {
    return this.time.attendanceSummary(ctx, query.from, query.to);
  }

  @Patch('attendance/:id')
  @RequirePermission('time.attendance.update')
  @Audit({ entityType: 'attendance_day' })
  @ApiOperation({ summary: 'Correccion manual de un dia de asistencia (auditada)' })
  async correct(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          status: z
            .enum([
              'pending',
              'present',
              'absent',
              'late',
              'early_leave',
              'leave',
              'holiday',
              'rest',
              'remote',
            ])
            .optional(),
          notes: z.string().max(500).nullable().optional(),
          workedMinutes: z.number().int().min(0).max(1440).optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.time.correctDay(ctx, id, dto);
  }

  @Post('attendance/:employeeId/recompute')
  @RequirePermission('time.attendance.update')
  @ApiOperation({ summary: 'Recalcula la asistencia de un rango de fechas' })
  async recompute(
    @Ctx() ctx: RequestContext,
    @Param('employeeId', new ZodValidationPipe(uuid)) employeeId: string,
    @Body(new ZodValidationPipe(z.object({ from: isoDate, to: isoDate })))
    dto: { from: string; to: string },
  ) {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    let days = 0;
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86_400_000)) {
      await this.time.recomputeDay(ctx.companyId, employeeId, d);
      days += 1;
    }
    return { employeeId, days };
  }

  /* --------------------------- justifications --------------------------- */

  @Post('justifications')
  @RequirePermission('time.justification.create')
  @Audit({ entityType: 'attendance_justification' })
  @ApiOperation({ summary: 'Justifica una inconsistencia de asistencia' })
  async createJustification(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(justificationSchema)) dto: z.infer<typeof justificationSchema>,
  ) {
    if (!ctx.employeeId)
      throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    return this.prisma.attendanceJustification.create({
      data: {
        companyId: ctx.companyId,
        attendanceDayId: dto.attendanceDayId,
        employeeId: ctx.employeeId,
        reason: dto.reason,
        fileId: dto.fileId ?? null,
      },
    });
  }

  @Get('justifications')
  @RequirePermission('time.justification.approve')
  @ApiOperation({ summary: 'Justificaciones pendientes de aprobacion' })
  async justifications(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).attendanceJustification, query, {
      where: { status: (query.status as never) ?? 'pending' },
      include: {
        attendanceDay: { include: { employee: { select: { id: true, fullName: true } } } },
      },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('justifications/:id/decide')
  @RequirePermission('time.justification.approve')
  @Audit({ entityType: 'attendance_justification', action: 'approve' })
  @ApiOperation({ summary: 'Aprueba o rechaza una justificacion' })
  async decideJustification(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          decision: z.enum(['approved', 'rejected']),
          comment: z.string().max(1000).nullable().optional(),
        }),
      ),
    )
    dto: { decision: 'approved' | 'rejected'; comment?: string | null },
  ) {
    const justification = await this.prisma.attendanceJustification.update({
      where: { id },
      data: {
        status: dto.decision,
        decidedById: ctx.userId,
        decidedAt: new Date(),
        decisionComment: dto.comment ?? null,
      },
    });
    if (dto.decision === 'approved') {
      await this.prisma.attendanceDay.update({
        where: { id: justification.attendanceDayId },
        data: { notes: justification.reason.slice(0, 500) },
      });
    }
    return justification;
  }

  /* ------------------------------ schedules ----------------------------- */

  @Get('schedules')
  @RequirePermission('time.shift.read')
  @ApiOperation({ summary: 'Horarios de trabajo' })
  async schedules(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).workSchedule.findMany({
      where: { deletedAt: null },
      include: { rules: { orderBy: { weekday: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post('schedules')
  @RequirePermission('time.schedule.manage')
  @Audit({ entityType: 'work_schedule' })
  @ApiOperation({ summary: 'Crea un horario semanal' })
  async createSchedule(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(workScheduleSchema)) dto: z.infer<typeof workScheduleSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const schedule = await db.workSchedule.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        toleranceMinutes: dto.toleranceMinutes,
        isActive: dto.isActive,
      },
    });
    await db.scheduleRule.createMany({
      data: dto.rules.map((rule) => ({ scheduleId: schedule.id, ...rule })),
    });
    return db.workSchedule.findFirst({ where: { id: schedule.id }, include: { rules: true } });
  }

  @Post('schedules/:id/assign')
  @RequirePermission('time.schedule.manage')
  @Audit({ entityType: 'employee_schedule' })
  @ApiOperation({ summary: 'Asigna un horario a colaboradores' })
  async assignSchedule(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          employeeIds: z.array(uuid).min(1),
          startDate: isoDate,
          endDate: isoDate.nullable().optional(),
        }),
      ),
    )
    dto: { employeeIds: string[]; startDate: string; endDate?: string | null },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.employeeSchedule.createMany({
      data: dto.employeeIds.map((employeeId) => ({
        employeeId,
        scheduleId: id,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      })),
    });
    return { assigned: dto.employeeIds.length };
  }

  /* -------------------------------- shifts ------------------------------ */

  @Get('shifts')
  @RequirePermission('time.shift.read')
  @ApiOperation({ summary: 'Turnos definidos' })
  async shifts(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).shift.findMany({
      where: { deletedAt: null },
      orderBy: { startTime: 'asc' },
    });
  }

  @Post('shifts')
  @RequirePermission('time.shift.create')
  @Audit({ entityType: 'shift' })
  @ApiOperation({ summary: 'Crea un turno' })
  async createShift(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(shiftSchema)) dto: z.infer<typeof shiftSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).shift.create({ data: dto });
  }

  @Get('shifts/planner')
  @RequirePermission('time.shift.read')
  @ApiOperation({ summary: 'Grilla de turnos asignados en un rango' })
  async planner(
    @Ctx() ctx: RequestContext,
    @Query() query: { from: string; to: string; departmentId?: string },
  ) {
    return this.prisma.shiftAssignment.findMany({
      where: {
        companyId: ctx.companyId,
        date: { gte: new Date(query.from), lte: new Date(query.to) },
        ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
      },
      include: {
        shift: true,
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: [{ date: 'asc' }],
    });
  }

  @Post('shifts/assign')
  @RequirePermission('time.shift.update')
  @Audit({ entityType: 'shift_assignment' })
  @ApiOperation({ summary: 'Asigna turnos de forma masiva' })
  async assignShifts(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(assignShiftsSchema)) dto: z.infer<typeof assignShiftsSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    let created = 0;
    for (const assignment of dto.assignments) {
      await db.shiftAssignment.upsert({
        where: {
          employeeId_date_shiftId: {
            employeeId: assignment.employeeId,
            date: new Date(assignment.date),
            shiftId: assignment.shiftId,
          },
        },
        create: {
          employeeId: assignment.employeeId,
          shiftId: assignment.shiftId,
          date: new Date(assignment.date),
          notes: assignment.notes ?? null,
          isPublished: dto.publish,
          createdById: ctx.userId,
        },
        update: { notes: assignment.notes ?? null, isPublished: dto.publish },
      });
      created += 1;
    }
    return { assigned: created, published: dto.publish };
  }

  @Post('shifts/swap')
  @RequirePermission('time.swap.request')
  @Audit({ entityType: 'shift_swap_request' })
  @ApiOperation({ summary: 'Solicita un intercambio de turno' })
  async requestSwap(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          requesterAssignmentId: uuid,
          targetEmployeeId: uuid,
          targetAssignmentId: uuid.nullable().optional(),
          reason: z.string().max(500).nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.shiftSwapRequest.create({
      data: {
        companyId: ctx.companyId,
        requesterAssignmentId: dto.requesterAssignmentId,
        targetEmployeeId: dto.targetEmployeeId,
        targetAssignmentId: dto.targetAssignmentId ?? null,
        reason: dto.reason ?? null,
      },
    });
  }

  @Post('shifts/swap/:id/decide')
  @RequirePermission('time.swap.approve')
  @Audit({ entityType: 'shift_swap_request', action: 'approve' })
  @ApiOperation({ summary: 'Aprueba o rechaza un intercambio de turno' })
  async decideSwap(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ decision: z.enum(['approved', 'rejected']) })))
    dto: { decision: 'approved' | 'rejected' },
  ) {
    const swap = await this.prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: dto.decision, decidedById: ctx.userId, decidedAt: new Date() },
    });
    if (dto.decision === 'approved') {
      const requester = await this.prisma.shiftAssignment.findFirst({
        where: { id: swap.requesterAssignmentId },
      });
      if (requester) {
        await this.prisma.shiftAssignment.update({
          where: { id: requester.id },
          data: { employeeId: swap.targetEmployeeId },
        });
      }
    }
    return swap;
  }

  /* ------------------------------- devices ------------------------------ */

  @Get('devices')
  @RequirePermission('time.device.manage')
  @ApiOperation({ summary: 'Dispositivos de marcacion registrados' })
  async devices(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).clockDevice.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        vendor: true,
        serial: true,
        locationId: true,
        lastSeenAt: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  @Post('devices')
  @RequirePermission('time.device.manage')
  @Audit({ entityType: 'clock_device' })
  @ApiOperation({ summary: 'Registra un dispositivo y devuelve su token (una sola vez)' })
  async createDevice(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(120),
          vendor: z.string().max(80).nullable().optional(),
          serial: z.string().max(120).nullable().optional(),
          locationId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const token = this.encryption.randomToken(24);
    const device = await this.prisma.clockDevice.create({
      data: {
        companyId: ctx.companyId,
        name: dto.name,
        vendor: dto.vendor ?? null,
        serial: dto.serial ?? null,
        locationId: dto.locationId ?? null,
        tokenHash: this.encryption.hash(token),
        qrSecret: this.encryption.randomToken(12),
      },
    });
    return { ...device, tokenHash: undefined, token };
  }

  @Public()
  @Post('devices/ingest')
  @ApiOperation({ summary: 'Ingesta de marcaciones desde relojes biometricos' })
  async ingest(@Body(new ZodValidationPipe(ingestSchema)) dto: z.infer<typeof ingestSchema>) {
    if (!dto.deviceToken) throw BusinessException.forbidden('Token de dispositivo requerido');
    const device = await this.prisma.clockDevice.findFirst({
      where: { tokenHash: this.encryption.hash(dto.deviceToken), isActive: true, deletedAt: null },
    });
    if (!device) throw BusinessException.forbidden('Dispositivo no autorizado');
    await this.prisma.clockDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    return this.time.ingestEntries(device.companyId, dto.entries);
  }

  @Post('import')
  @RequirePermission('time.device.manage')
  @Audit({
    entityType: 'time_clock_entry',
    action: 'create',
    summary: 'Importacion CSV de marcaciones',
  })
  @ApiOperation({ summary: 'Importa marcaciones desde un archivo CSV ya parseado' })
  async importEntries(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(ingestSchema.omit({ deviceToken: true })))
    dto: { entries: Array<Record<string, any>> },
  ) {
    return this.time.ingestEntries(ctx.companyId, dto.entries as never);
  }

  /* ------------------------------ geofences ----------------------------- */

  @Get('geofences')
  @RequirePermission('time.device.manage')
  @ApiOperation({ summary: 'Geocercas por sede' })
  async geofences(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).geofence.findMany({
      include: { location: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post('geofences')
  @RequirePermission('time.device.manage')
  @Audit({ entityType: 'geofence' })
  @ApiOperation({ summary: 'Crea una geocerca' })
  async createGeofence(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          locationId: uuid,
          name: z.string().trim().min(2).max(120),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          radiusMeters: z.number().int().min(20).max(5000).default(150),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).geofence.create({ data: dto as never });
  }

  @Delete('geofences/:id')
  @RequirePermission('time.device.manage')
  @Audit({ entityType: 'geofence', action: 'delete' })
  @ApiOperation({ summary: 'Elimina una geocerca' })
  async removeGeofence(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    await this.prisma.geofence.deleteMany({ where: { id, companyId: ctx.companyId } });
    return { id };
  }
}
