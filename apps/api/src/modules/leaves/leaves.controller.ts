import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  balanceAdjustmentSchema,
  isoDate,
  leaveRequestSchema,
  leaveTypeSchema,
  MODULES,
  uuid,
} from '@talento/shared';
import type { Response } from 'express';
import { z } from 'zod';
import {
  Audit,
  Ctx,
  RequireModule,
  RequirePermission,
  SensitiveAccess,
} from '../../common/decorators';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { paged, parsePage } from '../../common/utils/pagination';
import { ScopeService } from '../../core/access/scope.service';
import { LeavesService } from './leaves.service';

const holidaySchema = z.object({
  date: isoDate,
  name: z.string().trim().min(2).max(160),
  locationId: uuid.nullable().optional(),
  isRecurring: z.boolean().default(false),
});

const eventSchema = z.object({
  employeeId: uuid,
  eventType: z.string().trim().min(2).max(60),
  title: z.string().trim().min(2).max(240),
  description: z.string().max(4000).nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(30).nullable().optional(),
  payrollCode: z.string().max(40).nullable().optional(),
  fileIds: z.array(uuid).default([]),
});

const disciplinarySchema = z.object({
  employeeId: uuid,
  caseType: z.string().trim().min(2).max(60),
  subject: z.string().trim().min(3).max(200),
  description: z.string().max(8000).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  openedAt: isoDate,
});

const disciplinaryStepSchema = z.object({
  stepType: z.string().trim().min(2).max(60),
  position: z.number().int().min(0).default(0),
  dueDate: isoDate.nullable().optional(),
  content: z.string().max(8000).nullable().optional(),
  fileId: uuid.nullable().optional(),
});

const exportSchema = z.object({
  from: isoDate,
  to: isoDate,
  scopes: z.array(z.enum(['leaves', 'events', 'attendance'])).min(1),
  name: z.string().max(200).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

@ApiTags('ausencias y novedades')
@Controller({ path: 'leaves', version: '1' })
@RequireModule(MODULES.LEAVES)
export class LeavesController {
  constructor(
    private readonly leaves: LeavesService,
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly encryption: EncryptionService,
  ) {}

  /* ------------------------------- types -------------------------------- */

  @Get('types')
  @RequirePermission('leaves.request.read')
  @ApiOperation({ summary: 'Tipos de ausencia configurados' })
  async types(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).leaveType.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  @Post('types')
  @RequirePermission('leaves.type.manage')
  @Audit({ entityType: 'leave_type' })
  @ApiOperation({ summary: 'Crea un tipo de ausencia' })
  async createType(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(leaveTypeSchema)) dto: z.infer<typeof leaveTypeSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).leaveType.create({
      data: { ...dto, createdById: ctx.userId },
    });
  }

  @Patch('types/:id')
  @RequirePermission('leaves.type.manage')
  @Audit({ entityType: 'leave_type' })
  @ApiOperation({ summary: 'Actualiza un tipo de ausencia' })
  async updateType(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(leaveTypeSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.leaveType.updateMany({ where: { id }, data: defined(dto) as never });
    return db.leaveType.findFirst({ where: { id } });
  }

  @Delete('types/:id')
  @RequirePermission('leaves.type.manage')
  @Audit({ entityType: 'leave_type', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un tipo de ausencia' })
  async removeType(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).leaveType, id, ctx.userId);
  }

  /* ------------------------------ policies ------------------------------ */

  @Get('policies')
  @RequirePermission('leaves.balance.read')
  @ApiOperation({ summary: 'Politicas de vacaciones' })
  async policies(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).leavePolicy.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  @Post('policies')
  @RequirePermission('leaves.policy.manage')
  @Audit({ entityType: 'leave_policy' })
  @ApiOperation({ summary: 'Crea una politica de vacaciones (solo dias, nunca dinero)' })
  async createPolicy(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(160),
          daysPerYear: z.number().min(0).max(60).default(15),
          accrualMode: z.enum(['monthly', 'yearly', 'daily']).default('monthly'),
          countsBusinessDays: z.boolean().default(true),
          maxCarryOverDays: z.number().min(0).max(120).nullable().optional(),
          alertThresholdDays: z.number().min(0).max(120).default(30),
          minDaysPerRequest: z.number().int().min(1).max(30).default(1),
          isDefault: z.boolean().default(false),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    if (dto.isDefault) {
      await db.leavePolicy.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return db.leavePolicy.create({ data: dto as never });
  }

  /* ------------------------------ balances ------------------------------ */

  @Get('balances/:employeeId')
  @RequirePermission('leaves.balance.read')
  @ApiOperation({ summary: 'Saldo de vacaciones del colaborador' })
  async balance(
    @Ctx() ctx: RequestContext,
    @Param('employeeId', new ZodValidationPipe(uuid)) employeeId: string,
    @Query('year') year?: string,
  ) {
    if (employeeId !== ctx.employeeId) {
      await this.scope.assertEmployeeInScope(ctx, 'leaves.balance.read', employeeId);
    }
    return this.leaves.balanceFor(
      ctx.companyId,
      employeeId,
      year ? Number(year) : new Date().getUTCFullYear(),
    );
  }

  @Post('balances/adjust')
  @RequirePermission('leaves.balance.adjust')
  @Audit({ entityType: 'leave_balance_adjustment' })
  @ApiOperation({ summary: 'Ajusta manualmente el saldo (queda auditado)' })
  async adjustBalance(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(balanceAdjustmentSchema)) dto: z.infer<typeof balanceAdjustmentSchema>,
  ) {
    return this.leaves.adjustBalance(ctx, dto);
  }

  @Get('balances')
  @RequirePermission('leaves.balance.read')
  @ApiOperation({ summary: 'Saldos de vacaciones del alcance del usuario' })
  async balances(@Ctx() ctx: RequestContext, @Query('year') year?: string) {
    const employeeScope = await this.scope.employeeScope(ctx, 'leaves.balance.read');
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: 'active',
        ...(employeeScope.kind === 'ids' ? { id: { in: employeeScope.ids } } : {}),
      },
      select: { id: true, fullName: true, employeeCode: true, hiredAt: true },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
    const targetYear = year ? Number(year) : new Date().getUTCFullYear();
    return Promise.all(
      employees.map(async (employee) => ({
        employee,
        balance: await this.leaves.balanceFor(ctx.companyId, employee.id, targetYear),
      })),
    );
  }

  /* ------------------------------ requests ------------------------------ */

  @Get('requests')
  @RequirePermission('leaves.request.read')
  @ApiOperation({ summary: 'Solicitudes de ausencia' })
  async requests(
    @Ctx() ctx: RequestContext,
    @Query()
    query: {
      page?: string;
      limit?: string;
      status?: string;
      employeeId?: string;
      leaveTypeId?: string;
      from?: string;
      to?: string;
      mine?: string;
    },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.leaves.listRequests(ctx, {
      page,
      limit,
      status: query.status,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
      from: query.from,
      to: query.to,
      onlyMine: query.mine === 'true',
    });
    return paged(rows, total, page, limit);
  }

  @Get('requests/:id')
  @RequirePermission('leaves.request.read')
  @ApiOperation({ summary: 'Detalle de una solicitud' })
  async request(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).leaveRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        leaveType: true,
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
    });
  }

  @Post('requests')
  @RequirePermission('leaves.request.create')
  @Audit({ entityType: 'leave_request' })
  @ApiOperation({ summary: 'Crea una solicitud de ausencia y dispara el flujo de aprobacion' })
  async createRequest(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(leaveRequestSchema)) dto: z.infer<typeof leaveRequestSchema>,
  ) {
    return this.leaves.createRequest(ctx, dto);
  }

  @Post('requests/:id/cancel')
  @RequirePermission('leaves.request.cancel')
  @Audit({ entityType: 'leave_request', action: 'update' })
  @ApiOperation({ summary: 'Anula una solicitud' })
  async cancelRequest(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().max(500).nullable().optional() })))
    dto: { reason?: string | null },
  ) {
    return this.leaves.cancelRequest(ctx, id, dto.reason);
  }

  @Get('calendar')
  @RequirePermission('leaves.request.read')
  @ApiOperation({ summary: 'Calendario de ausencias del equipo o del area' })
  async calendar(
    @Ctx() ctx: RequestContext,
    @Query() query: { from: string; to: string; departmentId?: string; locationId?: string },
  ) {
    return this.leaves.calendar(ctx, query);
  }

  /* ------------------------------ holidays ------------------------------ */

  @Get('holidays')
  @RequirePermission('leaves.request.read')
  @ApiOperation({ summary: 'Festivos registrados' })
  async holidays(@Ctx() ctx: RequestContext, @Query('year') year?: string) {
    const target = year ? Number(year) : new Date().getUTCFullYear();
    return this.prisma.holiday.findMany({
      where: {
        companyId: ctx.companyId,
        date: {
          gte: new Date(Date.UTC(target, 0, 1)),
          lte: new Date(Date.UTC(target, 11, 31)),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  @Post('holidays')
  @RequirePermission('leaves.holiday.manage')
  @Audit({ entityType: 'holiday' })
  @ApiOperation({ summary: 'Registra un festivo' })
  async createHoliday(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(holidaySchema)) dto: z.infer<typeof holidaySchema>,
  ) {
    return this.prisma.holiday.create({
      data: {
        companyId: ctx.companyId,
        date: new Date(dto.date),
        name: dto.name,
        locationId: dto.locationId ?? null,
        isRecurring: dto.isRecurring,
      },
    });
  }

  @Post('holidays/load-colombia')
  @RequirePermission('leaves.holiday.manage')
  @Audit({ entityType: 'holiday', summary: 'Carga de festivos de Colombia' })
  @ApiOperation({ summary: 'Carga los festivos de Colombia para los anos indicados' })
  async loadColombianHolidays(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(z.object({ years: z.array(z.number().int().min(2000).max(2100)).min(1) })))
    dto: { years: number[] },
  ) {
    return { created: await this.leaves.seedHolidays(ctx.companyId, dto.years) };
  }

  @Delete('holidays/:id')
  @RequirePermission('leaves.holiday.manage')
  @Audit({ entityType: 'holiday', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un festivo' })
  async removeHoliday(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.prisma.holiday.deleteMany({ where: { id, companyId: ctx.companyId } });
    return { id };
  }

  /* ------------------------------- events ------------------------------- */

  @Get('events')
  @RequirePermission('leaves.event.read')
  @ApiOperation({ summary: 'Novedades del colaborador' })
  async events(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string; eventType?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).employeeEvent, query, {
      where: {
        deletedAt: null,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.eventType ? { eventType: query.eventType } : {}),
      },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      defaultSort: { startDate: 'desc' },
      sortable: ['startDate', 'createdAt'],
    });
  }

  @Post('events')
  @RequirePermission('leaves.event.create')
  @Audit({ entityType: 'employee_event' })
  @ApiOperation({ summary: 'Registra una novedad del colaborador' })
  async createEvent(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(eventSchema)) dto: z.infer<typeof eventSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).employeeEvent.create({
      data: {
        employeeId: dto.employeeId,
        eventType: dto.eventType,
        title: dto.title,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        quantity: dto.quantity ?? null,
        unit: dto.unit ?? null,
        payrollCode: dto.payrollCode ?? null,
        createdById: ctx.userId,
      },
    });
  }

  @Delete('events/:id')
  @RequirePermission('leaves.event.delete')
  @Audit({ entityType: 'employee_event', action: 'delete' })
  @ApiOperation({ summary: 'Elimina una novedad' })
  async removeEvent(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).employeeEvent, id, ctx.userId);
  }

  /* --------------------------- disciplinary ----------------------------- */

  @Get('disciplinary')
  @RequirePermission('leaves.disciplinary.read')
  @SensitiveAccess('disciplinary_case')
  @ApiOperation({ summary: 'Procesos disciplinarios (acceso restringido y trazado)' })
  async disciplinaryCases(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string; status?: string },
  ) {
    const { page, limit, skip, take } = parsePage(query);
    const where = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.disciplinaryCase.findMany({
        where,
        include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
        orderBy: { openedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.disciplinaryCase.count({ where }),
    ]);
    const decrypted = rows.map((row) => ({
      ...row,
      subject: this.encryption.decrypt(row.subject),
      description: this.encryption.decrypt(row.description),
      decision: this.encryption.decrypt(row.decision),
    }));
    return paged(decrypted, total, page, limit);
  }

  @Post('disciplinary')
  @RequirePermission('leaves.disciplinary.create')
  @Audit({ entityType: 'disciplinary_case' })
  @ApiOperation({ summary: 'Abre un proceso disciplinario (contenido cifrado)' })
  async createDisciplinaryCase(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(disciplinarySchema)) dto: z.infer<typeof disciplinarySchema>,
  ) {
    const count = await this.prisma.disciplinaryCase.count({ where: { companyId: ctx.companyId } });
    return this.prisma.disciplinaryCase.create({
      data: {
        companyId: ctx.companyId,
        employeeId: dto.employeeId,
        caseNumber: `DIS-${String(count + 1).padStart(5, '0')}`,
        caseType: dto.caseType,
        subject: this.encryption.encrypt(dto.subject) as string,
        description: this.encryption.encrypt(dto.description ?? null),
        severity: dto.severity,
        openedAt: new Date(dto.openedAt),
        createdById: ctx.userId,
      },
    });
  }

  @Post('disciplinary/:id/steps')
  @RequirePermission('leaves.disciplinary.update')
  @Audit({ entityType: 'disciplinary_case_step' })
  @ApiOperation({ summary: 'Agrega una etapa al proceso (citacion, descargos, decision)' })
  async addDisciplinaryStep(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(disciplinaryStepSchema)) dto: z.infer<typeof disciplinaryStepSchema>,
  ) {
    return this.prisma.disciplinaryCaseStep.create({
      data: {
        companyId: ctx.companyId,
        caseId: id,
        stepType: dto.stepType,
        position: dto.position,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        content: this.encryption.encrypt(dto.content ?? null),
        fileId: dto.fileId ?? null,
        createdById: ctx.userId,
      },
    });
  }

  /* --------------------------- payroll export --------------------------- */

  @Post('payroll-export')
  @RequirePermission('leaves.export.execute')
  @Audit({ entityType: 'payroll_export', action: 'export' })
  @ApiOperation({
    summary: 'Exporta novedades a nomina externa (unica interfaz con nomina, solo de salida)',
  })
  async payrollExport(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(exportSchema)) dto: z.infer<typeof exportSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.leaves.buildPayrollExport(ctx, dto);
    if (dto.format === 'json') return result;

    const columns = [...new Set(result.rows.flatMap((row) => Object.keys(row)))];
    const csv = [
      columns.join(';'),
      ...result.rows.map((row) =>
        columns.map((column) => String(row[column] ?? '').replace(/;/g, ',')).join(';'),
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="novedades-${dto.from}-${dto.to}.csv"`,
    );
    return `﻿${csv}`;
  }

  @Get('payroll-export')
  @RequirePermission('leaves.export.execute')
  @ApiOperation({ summary: 'Historial de exportaciones a nomina' })
  async payrollExports(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).payrollExport, query, {
      defaultSort: { createdAt: 'desc' },
    });
  }
}
