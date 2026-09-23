import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  checkinSchema,
  feedbackSchema,
  isoDate,
  MODULES,
  objectiveSchema,
  uuid,
} from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged, softDelete } from '../../common/utils/crud';
import { ScopeService } from '../../core/access/scope.service';
import { PerformanceService } from './performance.service';

const competencySchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().max(80).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  isCore: z.boolean().default(false),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(1).max(5),
        name: z.string().max(120),
        behaviors: z.string().max(4000).nullable().optional(),
      }),
    )
    .default([]),
});

const cycleSchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(['ninety', 'one_eighty', 'three_sixty']).default('ninety'),
  templateId: uuid.nullable().optional(),
  objectiveCycleId: uuid.nullable().optional(),
  selfStart: isoDate.nullable().optional(),
  selfEnd: isoDate.nullable().optional(),
  evalStart: isoDate.nullable().optional(),
  evalEnd: isoDate.nullable().optional(),
  calibrationDate: isoDate.nullable().optional(),
  feedbackDeadline: isoDate.nullable().optional(),
  anonymousPeers: z.boolean().default(true),
  anonymousReports: z.boolean().default(true),
  instructions: z.string().max(8000).nullable().optional(),
});

const submitReviewSchema = z.object({
  responses: z
    .array(
      z.object({
        questionKey: z.string().min(1).max(120),
        competencyId: uuid.nullable().optional(),
        objectiveId: uuid.nullable().optional(),
        rating: z.number().min(0).max(10).nullable().optional(),
        answer: z.any().optional(),
        comment: z.string().max(8000).nullable().optional(),
      }),
    )
    .min(1),
});

const developmentPlanSchema = z.object({
  employeeId: uuid.nullable().optional(),
  departmentId: uuid.nullable().optional(),
  title: z.string().trim().min(2).max(240),
  scopeKind: z.enum(['individual', 'area']).default('individual'),
  cycleId: uuid.nullable().optional(),
  surveyId: uuid.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  actions: z
    .array(
      z.object({
        title: z.string().max(240),
        description: z.string().max(2000).nullable().optional(),
        competencyId: uuid.nullable().optional(),
        courseId: uuid.nullable().optional(),
        responsibleEmployeeId: uuid.nullable().optional(),
        dueDate: isoDate.nullable().optional(),
      }),
    )
    .default([]),
});

@ApiTags('desempeno')
@Controller({ path: 'performance', version: '1' })
@RequireModule(MODULES.PERFORMANCE)
export class PerformanceController {
  constructor(
    private readonly performance: PerformanceService,
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /* ----------------------------- competencies --------------------------- */

  @Get('competencies')
  @RequirePermission('performance.objective.read')
  @ApiOperation({ summary: 'Diccionario de competencias' })
  async competencies(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).competency.findMany({
      where: { deletedAt: null },
      include: { levels: { orderBy: { level: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post('competencies')
  @RequirePermission('performance.competency.manage')
  @Audit({ entityType: 'competency' })
  @ApiOperation({ summary: 'Crea una competencia con sus niveles' })
  async createCompetency(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(competencySchema)) dto: z.infer<typeof competencySchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { levels, ...rest } = dto;
    const competency = await db.competency.create({ data: rest });
    if (levels.length) {
      await db.competencyLevel.createMany({
        data: levels.map((level) => ({ competencyId: competency.id, ...level })),
      });
    }
    return db.competency.findFirst({ where: { id: competency.id }, include: { levels: true } });
  }

  /* ------------------------------ objectives ---------------------------- */

  @Get('objective-cycles')
  @RequirePermission('performance.objective.read')
  @ApiOperation({ summary: 'Ciclos de objetivos' })
  async objectiveCycles(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).objectiveCycle.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }

  @Post('objective-cycles')
  @RequirePermission('performance.objective.create')
  @Audit({ entityType: 'objective_cycle' })
  @ApiOperation({ summary: 'Crea un ciclo de objetivos' })
  async createObjectiveCycle(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(120),
          startDate: isoDate,
          endDate: isoDate,
        }),
      ),
    )
    dto: { name: string; startDate: string; endDate: string },
  ) {
    return this.prisma.forCompany(ctx.companyId).objectiveCycle.create({
      data: { name: dto.name, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
  }

  @Get('objectives')
  @RequirePermission('performance.objective.read')
  @ApiOperation({ summary: 'Arbol de objetivos alineados' })
  async objectives(
    @Ctx() ctx: RequestContext,
    @Query()
    query: { cycleId?: string; level?: string; employeeId?: string; page?: string; limit?: string },
  ) {
    const employeeScope = await this.scope.employeeScope(ctx, 'performance.objective.read');
    return listPaged(this.prisma.forCompany(ctx.companyId).objective, query, {
      where: {
        deletedAt: null,
        ...(query.cycleId ? { cycleId: query.cycleId } : {}),
        ...(query.level ? { level: query.level } : {}),
        ...(query.employeeId ? { ownerEmployeeId: query.employeeId } : {}),
        ...(employeeScope.kind === 'ids' && !query.employeeId
          ? {
              OR: [
                { ownerEmployeeId: { in: employeeScope.ids } },
                { level: { in: ['company', 'department'] } },
              ],
            }
          : {}),
      },
      include: {
        keyResults: { orderBy: { position: 'asc' } },
        owner: { select: { id: true, fullName: true } },
      },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'dueDate', 'progress'],
    });
  }

  @Post('objectives')
  @RequirePermission('performance.objective.create')
  @Audit({ entityType: 'objective' })
  @ApiOperation({ summary: 'Crea un objetivo con sus resultados clave' })
  async createObjective(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(objectiveSchema)) dto: z.infer<typeof objectiveSchema>,
  ) {
    return this.performance.upsertObjective(ctx, dto);
  }

  @Patch('objectives/:id')
  @RequirePermission('performance.objective.update')
  @Audit({ entityType: 'objective' })
  @ApiOperation({ summary: 'Actualiza un objetivo' })
  async updateObjective(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(objectiveSchema.partial())) dto: Record<string, unknown>,
  ) {
    return this.performance.upsertObjective(ctx, dto, id);
  }

  @Delete('objectives/:id')
  @RequirePermission('performance.objective.delete')
  @Audit({ entityType: 'objective', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un objetivo' })
  async removeObjective(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return softDelete(this.prisma.forCompany(ctx.companyId).objective, id, ctx.userId);
  }

  @Post('checkins')
  @RequirePermission('performance.checkin.create')
  @Audit({ entityType: 'kr_checkin' })
  @ApiOperation({ summary: 'Registra un check-in de resultado clave' })
  async checkIn(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(checkinSchema)) dto: z.infer<typeof checkinSchema>,
  ) {
    return this.performance.checkIn(ctx, dto);
  }

  /* --------------------------- review cycles ---------------------------- */

  @Get('cycles')
  @RequirePermission('performance.cycle.read')
  @ApiOperation({ summary: 'Ciclos de evaluacion' })
  async cycles(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).reviewCycle, query, {
      where: { deletedAt: null },
      include: { _count: { select: { assignments: true } } },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('cycles')
  @RequirePermission('performance.cycle.create')
  @Audit({ entityType: 'review_cycle' })
  @ApiOperation({ summary: 'Crea un ciclo de evaluacion 90/180/360' })
  async createCycle(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(cycleSchema)) dto: z.infer<typeof cycleSchema>,
  ) {
    const toDate = (value?: string | null) => (value ? new Date(value) : null);
    return this.prisma.forCompany(ctx.companyId).reviewCycle.create({
      data: {
        name: dto.name,
        type: dto.type,
        templateId: dto.templateId ?? null,
        objectiveCycleId: dto.objectiveCycleId ?? null,
        selfStart: toDate(dto.selfStart),
        selfEnd: toDate(dto.selfEnd),
        evalStart: toDate(dto.evalStart),
        evalEnd: toDate(dto.evalEnd),
        calibrationDate: toDate(dto.calibrationDate),
        feedbackDeadline: toDate(dto.feedbackDeadline),
        anonymousPeers: dto.anonymousPeers,
        anonymousReports: dto.anonymousReports,
        instructions: dto.instructions ?? null,
        createdById: ctx.userId,
      },
    });
  }

  @Post('cycles/:id/generate-assignments')
  @RequirePermission('performance.cycle.update')
  @Audit({ entityType: 'review_assignment' })
  @ApiOperation({ summary: 'Genera la matriz de evaluadores del ciclo' })
  async generateAssignments(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          employeeIds: z.array(uuid).optional(),
          peersPerEmployee: z.number().int().min(1).max(10).default(3),
        }),
      ),
    )
    dto: { employeeIds?: string[]; peersPerEmployee: number },
  ) {
    return this.performance.generateAssignments(ctx, id, dto);
  }

  @Patch('cycles/:id/status')
  @RequirePermission('performance.cycle.update')
  @Audit({ entityType: 'review_cycle' })
  @ApiOperation({ summary: 'Avanza la etapa del ciclo' })
  async setCycleStatus(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          status: z.enum([
            'draft',
            'self_assessment',
            'evaluation',
            'calibration',
            'feedback_meeting',
            'closed',
          ]),
        }),
      ),
    )
    dto: { status: string },
  ) {
    return this.prisma.forCompany(ctx.companyId).reviewCycle.update({
      where: { id },
      data: { status: dto.status as never },
    });
  }

  @Get('assignments/mine')
  @RequirePermission('performance.review.read')
  @ApiOperation({ summary: 'Evaluaciones pendientes del usuario' })
  async myAssignments(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.reviewAssignment.findMany({
      where: {
        companyId: ctx.companyId,
        reviewerEmployeeId: ctx.employeeId,
        cycle: { status: { in: ['self_assessment', 'evaluation'] } },
      },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            evalEnd: true,
            templateId: true,
          },
        },
        subject: { select: { id: true, fullName: true, position: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('assignments/:id/submit')
  @RequirePermission('performance.review.respond')
  @Audit({ entityType: 'review_assignment', action: 'update' })
  @ApiOperation({ summary: 'Envia las respuestas de una evaluacion' })
  async submitReview(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(submitReviewSchema)) dto: z.infer<typeof submitReviewSchema>,
  ) {
    return this.performance.submitReview(ctx, id, dto.responses);
  }

  @Get('cycles/:cycleId/report/:employeeId')
  @RequirePermission('performance.review.read')
  @ApiOperation({ summary: 'Informe individual del ciclo' })
  async report(
    @Ctx() ctx: RequestContext,
    @Param('cycleId', new ZodValidationPipe(uuid)) cycleId: string,
    @Param('employeeId', new ZodValidationPipe(uuid)) employeeId: string,
  ) {
    if (employeeId !== ctx.employeeId) {
      await this.scope.assertEmployeeInScope(ctx, 'performance.review.read', employeeId);
    }
    return this.performance.individualReport(ctx, cycleId, employeeId);
  }

  /* ------------------------------- 9-box -------------------------------- */

  @Get('cycles/:id/nine-box')
  @RequirePermission('performance.ninebox.read')
  @ApiOperation({ summary: 'Matriz 9-box del ciclo' })
  async nineBox(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.performance.nineBox(ctx, id);
  }

  @Post('nine-box')
  @RequirePermission('performance.ninebox.update')
  @Audit({ entityType: 'nine_box_placement' })
  @ApiOperation({ summary: 'Ubica a un colaborador en la matriz 9-box' })
  async setNineBox(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          cycleId: uuid,
          employeeId: uuid,
          performance: z.number().int().min(1).max(3),
          potential: z.number().int().min(1).max(3),
          notes: z.string().max(2000).nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.performance.setNineBox(ctx, dto as never);
  }

  /* ---------------------------- feedback / 1:1 -------------------------- */

  @Get('feedback')
  @RequirePermission('performance.feedback.read')
  @ApiOperation({ summary: 'Feedback continuo recibido' })
  async feedback(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string },
  ) {
    const target = query.employeeId ?? ctx.employeeId;
    if (!target) return { data: [], meta: { total: 0 } };
    if (target !== ctx.employeeId) {
      await this.scope.assertEmployeeInScope(ctx, 'performance.feedback.read', target);
    }
    return listPaged(this.prisma.forCompany(ctx.companyId).feedback, query, {
      where: {
        toEmployeeId: target,
        deletedAt: null,
        ...(target === ctx.employeeId ? {} : { visibility: { not: 'private' } }),
      },
      include: {
        from: { select: { id: true, fullName: true } },
        competency: { select: { id: true, name: true } },
      },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('feedback')
  @RequirePermission('performance.feedback.create')
  @Audit({ entityType: 'feedback' })
  @ApiOperation({ summary: 'Da feedback a otro colaborador' })
  async giveFeedback(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(feedbackSchema)) dto: z.infer<typeof feedbackSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).feedback.create({
      data: {
        fromEmployeeId: ctx.employeeId,
        toEmployeeId: dto.toEmployeeId,
        kind: dto.kind,
        visibility: dto.visibility,
        message: dto.message,
        competencyId: dto.competencyId ?? null,
      },
    });
  }

  @Get('one-on-ones')
  @RequirePermission('performance.oneonone.read')
  @ApiOperation({ summary: 'Reuniones 1:1' })
  async oneOnOnes(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    if (!ctx.employeeId) return { data: [], meta: { total: 0 } };
    return listPaged(this.prisma.forCompany(ctx.companyId).oneOnOne, query, {
      where: {
        OR: [{ leadEmployeeId: ctx.employeeId }, { memberEmployeeId: ctx.employeeId }],
      },
      include: {
        lead: { select: { id: true, fullName: true } },
        member: { select: { id: true, fullName: true } },
      },
      defaultSort: { scheduledAt: 'desc' },
    });
  }

  @Post('one-on-ones')
  @RequirePermission('performance.oneonone.create')
  @Audit({ entityType: 'one_on_one' })
  @ApiOperation({ summary: 'Agenda una reunion 1:1' })
  async createOneOnOne(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          memberEmployeeId: uuid,
          scheduledAt: z.string(),
          agenda: z.string().max(4000).nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    if (!ctx.employeeId)
      throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    return this.prisma.forCompany(ctx.companyId).oneOnOne.create({
      data: {
        leadEmployeeId: ctx.employeeId,
        memberEmployeeId: dto.memberEmployeeId,
        scheduledAt: new Date(dto.scheduledAt),
        agenda: dto.agenda ?? null,
      },
    });
  }

  /* ------------------------ development and career ---------------------- */

  @Get('development-plans')
  @RequirePermission('performance.developmentplan.read')
  @ApiOperation({ summary: 'Planes de desarrollo individual' })
  async developmentPlans(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).developmentPlan, query, {
      where: {
        deletedAt: null,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: {
        actions: true,
        employee: { select: { id: true, fullName: true } },
      },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('development-plans')
  @RequirePermission('performance.developmentplan.create')
  @Audit({ entityType: 'development_plan' })
  @ApiOperation({ summary: 'Crea un plan de desarrollo con sus acciones' })
  async createDevelopmentPlan(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(developmentPlanSchema)) dto: z.infer<typeof developmentPlanSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { actions, ...rest } = dto;
    const plan = await db.developmentPlan.create({
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : null,
        dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
        createdById: ctx.userId,
      } as never,
    });
    if (actions.length) {
      for (const action of actions) {
        await db.developmentAction.create({
          data: {
            planId: plan.id,
            title: action.title,
            description: action.description ?? null,
            competencyId: action.competencyId ?? null,
            courseId: action.courseId ?? null,
            responsibleEmployeeId: action.responsibleEmployeeId ?? null,
            dueDate: action.dueDate ? new Date(action.dueDate) : null,
          },
        });
      }
    }
    return db.developmentPlan.findFirst({ where: { id: plan.id }, include: { actions: true } });
  }

  @Get('career-paths')
  @RequirePermission('performance.career.manage')
  @ApiOperation({ summary: 'Rutas de carrera' })
  async careerPaths(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).careerPath.findMany({
      where: { deletedAt: null },
      include: { steps: { include: { jobPosition: { select: { id: true, name: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  @Get('succession')
  @RequirePermission('performance.succession.read')
  @ApiOperation({ summary: 'Planes de sucesion de cargos criticos' })
  async succession(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).successionPlan.findMany({
      where: { deletedAt: null },
      include: {
        candidates: { include: { employee: { select: { id: true, fullName: true } } } },
      },
    });
  }

  @Post('succession')
  @RequirePermission('performance.succession.manage')
  @Audit({ entityType: 'succession_plan' })
  @ApiOperation({ summary: 'Define el plan de sucesion de un cargo' })
  async upsertSuccession(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          positionId: uuid,
          incumbentEmployeeId: uuid.nullable().optional(),
          criticality: z.enum(['low', 'medium', 'high']).default('high'),
          riskOfLoss: z.enum(['low', 'medium', 'high']).default('medium'),
          notes: z.string().max(4000).nullable().optional(),
          candidates: z
            .array(
              z.object({
                employeeId: uuid,
                readiness: z.enum(['ready_now', '1_2_years', '3_5_years']).default('1_2_years'),
                notes: z.string().max(2000).nullable().optional(),
              }),
            )
            .default([]),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { candidates, ...rest } = dto;
    const plan = await db.successionPlan.upsert({
      where: { companyId_positionId: { companyId: ctx.companyId, positionId: dto.positionId } },
      create: rest as never,
      update: rest as never,
    });
    await db.successionCandidate.deleteMany({ where: { planId: plan.id } });
    if (candidates?.length) {
      await db.successionCandidate.createMany({
        data: candidates.map((candidate: Record<string, unknown>) => ({
          planId: plan.id,
          ...candidate,
        })) as never,
      });
    }
    return db.successionPlan.findFirst({ where: { id: plan.id }, include: { candidates: true } });
  }

  @Get('metrics')
  @RequirePermission('performance.objective.read')
  @ApiOperation({ summary: 'Indicadores de desempeno' })
  async metrics(@Ctx() ctx: RequestContext) {
    return this.performance.metrics(ctx);
  }
}
