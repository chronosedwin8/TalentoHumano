import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isoDate, MODULES, round, uuid } from '@talento/shared';
import { z } from 'zod';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  Audit,
  Ctx,
  RequireModule,
  RequirePermission,
  SensitiveAccess,
} from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged } from '../../common/utils/crud';
import { paged, parsePage } from '../../common/utils/pagination';

const examSchema = z.object({
  employeeId: uuid,
  kind: z.enum(['entry', 'periodic', 'exit', 'post_incapacity', 'special']),
  provider: z.string().max(200).nullable().optional(),
  performedAt: isoDate,
  expiresAt: isoDate.nullable().optional(),
  result: z.enum(['fit', 'fit_with_restrictions', 'unfit', 'pending']).default('pending'),
  restrictions: z.string().max(8000).nullable().optional(),
  recommendations: z.string().max(8000).nullable().optional(),
  fileId: uuid.nullable().optional(),
});

const accidentSchema = z.object({
  employeeId: uuid,
  kind: z.enum(['accident', 'incident', 'occupational_disease']).default('accident'),
  occurredAt: z.string(),
  reportedAt: z.string().nullable().optional(),
  locationId: uuid.nullable().optional(),
  place: z.string().max(300).nullable().optional(),
  bodyPart: z.string().max(120).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  description: z.string().min(10).max(20000),
  furatNumber: z.string().max(60).nullable().optional(),
  lostDays: z.number().int().min(0).max(3650).default(0),
});

const riskSchema = z.object({
  positionId: uuid.nullable().optional(),
  departmentId: uuid.nullable().optional(),
  locationId: uuid.nullable().optional(),
  hazard: z.string().trim().min(2).max(260),
  hazardClass: z.string().trim().min(2).max(80),
  risk: z.string().trim().min(2).max(260),
  exposedCount: z.number().int().min(0).max(100000).default(0),
  probability: z.number().int().min(1).max(5).default(1),
  consequence: z.number().int().min(1).max(5).default(1),
  controls: z.string().max(8000).nullable().optional(),
});

const committeeSchema = z.object({
  kind: z.enum(['copasst', 'convivencia', 'emergencias', 'otro']),
  name: z.string().trim().min(2).max(200),
  termStart: isoDate,
  termEnd: isoDate,
  members: z
    .array(
      z.object({
        employeeId: uuid,
        role: z.string().max(60).default('member'),
        representation: z.enum(['employer', 'employee']).default('employer'),
        isPrincipal: z.boolean().default(true),
      }),
    )
    .default([]),
});

@ApiTags('seguridad y salud en el trabajo')
@Controller({ path: 'sst', version: '1' })
@RequireModule(MODULES.SST)
export class SstController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /* ---------------------------- medical exams --------------------------- */

  @Get('medical-exams')
  @RequirePermission('sst.medicalexam.read')
  @SensitiveAccess('medical_exam')
  @ApiOperation({ summary: 'Examenes medicos ocupacionales (contenido cifrado)' })
  async exams(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string; kind?: string },
  ) {
    const { page, limit, skip, take } = parsePage(query);
    const where = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.kind ? { kind: query.kind as never } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.medicalExam.findMany({
        where,
        include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
        orderBy: { performedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.medicalExam.count({ where }),
    ]);
    return paged(
      rows.map((row) => ({
        ...row,
        restrictions: this.encryption.decrypt(row.restrictions),
        recommendations: this.encryption.decrypt(row.recommendations),
      })),
      total,
      page,
      limit,
    );
  }

  @Post('medical-exams')
  @RequirePermission('sst.medicalexam.create')
  @Audit({ entityType: 'medical_exam' })
  @ApiOperation({ summary: 'Registra un examen medico ocupacional' })
  async createExam(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(examSchema)) dto: z.infer<typeof examSchema>,
  ) {
    return this.prisma.medicalExam.create({
      data: {
        companyId: ctx.companyId,
        employeeId: dto.employeeId,
        kind: dto.kind,
        provider: dto.provider ?? null,
        performedAt: new Date(dto.performedAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        result: dto.result,
        restrictions: this.encryption.encrypt(dto.restrictions ?? null),
        recommendations: this.encryption.encrypt(dto.recommendations ?? null),
        fileId: dto.fileId ?? null,
        createdById: ctx.userId,
      },
    });
  }

  @Get('medical-exams/expiring')
  @RequirePermission('sst.medicalexam.read')
  @ApiOperation({ summary: 'Examenes por vencer' })
  async expiringExams(@Ctx() ctx: RequestContext, @Query('days') days = '60') {
    return this.prisma.medicalExam.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        expiresAt: { not: null, lte: new Date(Date.now() + Number(days) * 86_400_000) },
      },
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { expiresAt: 'asc' },
      take: 200,
    });
  }

  /* ------------------------------ accidents ----------------------------- */

  @Get('accidents')
  @RequirePermission('sst.accident.read')
  @ApiOperation({ summary: 'Accidentes e incidentes de trabajo' })
  async accidents(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; kind?: string; from?: string; to?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).workAccident, query, {
      where: {
        deletedAt: null,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.from || query.to
          ? {
              occurredAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        investigation: true,
      },
      defaultSort: { occurredAt: 'desc' },
      sortable: ['occurredAt', 'severity'],
    });
  }

  @Post('accidents')
  @RequirePermission('sst.accident.create')
  @Audit({ entityType: 'work_accident' })
  @ApiOperation({ summary: 'Registra un accidente o incidente (FURAT informativo)' })
  async createAccident(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(accidentSchema)) dto: z.infer<typeof accidentSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const count = await db.workAccident.count();
    return db.workAccident.create({
      data: {
        ...dto,
        code: `ATEL-${new Date().getUTCFullYear()}-${String(count + 1).padStart(4, '0')}`,
        occurredAt: new Date(dto.occurredAt),
        reportedAt: dto.reportedAt ? new Date(dto.reportedAt) : new Date(),
        createdById: ctx.userId,
      } as never,
    });
  }

  @Post('accidents/:id/investigation')
  @RequirePermission('sst.accident.update')
  @Audit({ entityType: 'accident_investigation' })
  @ApiOperation({ summary: 'Registra la investigacion y el plan de accion' })
  async investigate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          rootCause: z.string().max(8000).nullable().optional(),
          immediateCauses: z.string().max(8000).nullable().optional(),
          basicCauses: z.string().max(8000).nullable().optional(),
          actionPlan: z.string().max(8000).nullable().optional(),
          completedAt: isoDate.nullable().optional(),
          fileId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.accidentInvestigation.upsert({
      where: { accidentId: id },
      create: {
        companyId: ctx.companyId,
        accidentId: id,
        ...defined(dto),
        completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        investigatedById: ctx.userId,
      } as never,
      update: {
        ...defined(dto),
        completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
      } as never,
    });
  }

  /* --------------------------- risk matrix, EPP ------------------------- */

  @Get('risks')
  @RequirePermission('sst.risk.manage')
  @ApiOperation({ summary: 'Matriz de riesgos y peligros' })
  async risks(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).riskMatrixEntry, query, {
      where: { deletedAt: null },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('risks')
  @RequirePermission('sst.risk.manage')
  @Audit({ entityType: 'risk_matrix_entry' })
  @ApiOperation({ summary: 'Agrega una entrada a la matriz de riesgos' })
  async createRisk(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(riskSchema)) dto: z.infer<typeof riskSchema>,
  ) {
    const score = dto.probability * dto.consequence;
    const riskLevel =
      score >= 20 ? 'critico' : score >= 12 ? 'alto' : score >= 6 ? 'medio' : 'bajo';
    return this.prisma.forCompany(ctx.companyId).riskMatrixEntry.create({
      data: { ...dto, riskLevel } as never,
    });
  }

  @Get('ppe')
  @RequirePermission('sst.ppe.read')
  @ApiOperation({ summary: 'Entregas de elementos de proteccion personal' })
  async ppe(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).ppeDelivery, query, {
      where: { ...(query.employeeId ? { employeeId: query.employeeId } : {}) },
      include: { employee: { select: { id: true, fullName: true } } },
      defaultSort: { deliveredAt: 'desc' },
    });
  }

  @Post('ppe')
  @RequirePermission('sst.ppe.create')
  @Audit({ entityType: 'ppe_delivery' })
  @ApiOperation({ summary: 'Registra la entrega de EPP con acta' })
  async createPpe(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          employeeId: uuid,
          ppeType: z.string().trim().min(2).max(80),
          description: z.string().max(300).nullable().optional(),
          quantity: z.number().int().min(1).max(100).default(1),
          deliveredAt: isoDate,
          replacesAt: isoDate.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).ppeDelivery.create({
      data: {
        ...dto,
        deliveredAt: new Date(dto.deliveredAt),
        replacesAt: dto.replacesAt ? new Date(dto.replacesAt) : null,
        createdById: ctx.userId,
      } as never,
    });
  }

  /* ------------------------ inspections, committees --------------------- */

  @Get('inspections')
  @RequirePermission('sst.inspection.read')
  @ApiOperation({ summary: 'Inspecciones de seguridad' })
  async inspections(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).sstInspection, query, {
      where: { deletedAt: null },
      defaultSort: { scheduledAt: 'desc' },
    });
  }

  @Post('inspections')
  @RequirePermission('sst.inspection.create')
  @Audit({ entityType: 'sst_inspection' })
  @ApiOperation({ summary: 'Programa o registra una inspeccion' })
  async createInspection(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          title: z.string().trim().min(2).max(260),
          kind: z.string().max(60).default('general'),
          locationId: uuid.nullable().optional(),
          scheduledAt: isoDate.nullable().optional(),
          performedAt: isoDate.nullable().optional(),
          inspectorEmployeeId: uuid.nullable().optional(),
          findings: z.string().max(20000).nullable().optional(),
          actionPlan: z.string().max(20000).nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).sstInspection.create({
      data: {
        ...defined(dto),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : null,
      } as never,
    });
  }

  @Get('committees')
  @RequirePermission('sst.committee.manage')
  @ApiOperation({ summary: 'COPASST y comite de convivencia' })
  async committees(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).committee.findMany({
      where: { deletedAt: null },
      include: {
        members: { include: { employee: { select: { id: true, fullName: true } } } },
        minutes: { orderBy: { meetingDate: 'desc' }, take: 5 },
      },
      orderBy: { termStart: 'desc' },
    });
  }

  @Post('committees')
  @RequirePermission('sst.committee.manage')
  @Audit({ entityType: 'committee' })
  @ApiOperation({ summary: 'Crea un comite con sus integrantes y vigencia' })
  async createCommittee(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(committeeSchema)) dto: z.infer<typeof committeeSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { members, ...rest } = dto;
    const committee = await db.committee.create({
      data: { ...rest, termStart: new Date(rest.termStart), termEnd: new Date(rest.termEnd) },
    });
    if (members.length) {
      await db.committeeMember.createMany({
        data: members.map((member) => ({ committeeId: committee.id, ...member })),
      });
    }
    return db.committee.findFirst({ where: { id: committee.id }, include: { members: true } });
  }

  @Post('committees/:id/minutes')
  @RequirePermission('sst.committee.manage')
  @Audit({ entityType: 'committee_minute' })
  @ApiOperation({ summary: 'Registra un acta del comite' })
  async createMinute(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          number: z.string().max(40),
          meetingDate: isoDate,
          agenda: z.string().max(20000).nullable().optional(),
          decisions: z.string().max(20000).nullable().optional(),
          attendees: z.array(z.string().max(200)).default([]),
          fileId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).committeeMinute.create({
      data: {
        committeeId: id,
        ...dto,
        meetingDate: new Date(dto.meetingDate),
        createdById: ctx.userId,
      } as never,
    });
  }

  /* ------------------------------ indicators ---------------------------- */

  @Get('indicators')
  @RequirePermission('sst.indicator.read')
  @ApiOperation({ summary: 'Indicadores minimos de la Resolucion 0312 de 2019' })
  async indicators(@Ctx() ctx: RequestContext, @Query('year') yearParam?: string) {
    const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear();
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31));

    const [accidents, headcount, medicalAbsence, totalAbsence] = await Promise.all([
      this.prisma.workAccident.findMany({
        where: { companyId: ctx.companyId, deletedAt: null, occurredAt: { gte: from, lte: to } },
        select: { lostDays: true, kind: true, severity: true },
      }),
      this.prisma.employee.count({
        where: { companyId: ctx.companyId, deletedAt: null, status: 'active' },
      }),
      this.prisma.leaveRequest.aggregate({
        where: {
          companyId: ctx.companyId,
          deletedAt: null,
          status: { in: ['approved', 'taken'] },
          startDate: { gte: from, lte: to },
          leaveType: { code: { in: ['incapacidad_eps', 'incapacidad_arl'] } },
        },
        _sum: { requestedDays: true },
        _count: { _all: true },
      }),
      this.prisma.leaveRequest.aggregate({
        where: {
          companyId: ctx.companyId,
          deletedAt: null,
          status: { in: ['approved', 'taken'] },
          startDate: { gte: from, lte: to },
        },
        _sum: { requestedDays: true },
      }),
    ]);

    const workDays = headcount * 240;
    const accidentCount = accidents.filter((a) => a.kind === 'accident').length;
    const lostDays = accidents.reduce((acc, a) => acc + a.lostDays, 0);
    const medicalDays = Number(medicalAbsence._sum.requestedDays ?? 0);

    return {
      year,
      headcount,
      accidents: accidentCount,
      incidents: accidents.filter((a) => a.kind === 'incident').length,
      occupationalDiseases: accidents.filter((a) => a.kind === 'occupational_disease').length,
      lostDays,
      // Resolucion 0312 de 2019: frequency, severity and medical absenteeism.
      frequencyRate: headcount ? round((accidentCount / headcount) * 100, 2) : 0,
      severityRate: headcount ? round((lostDays / headcount) * 100, 2) : 0,
      medicalAbsenteeismRate: workDays ? round((medicalDays / workDays) * 100, 2) : 0,
      medicalLeaveCount: medicalAbsence._count._all,
      totalAbsenceDays: Number(totalAbsence._sum.requestedDays ?? 0),
    };
  }
}
