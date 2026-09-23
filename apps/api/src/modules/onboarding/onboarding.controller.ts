import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isoDate, MODULES, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, Public, RequireModule, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { OnboardingService } from './onboarding.service';

const preboardingProfileSchema = z.object({
  phone: z.string().max(40).nullable().optional(),
  mobile: z.string().max(40).nullable().optional(),
  personalEmail: z.string().email().max(180).nullable().optional().or(z.literal('')),
  address: z.string().max(240).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().min(2).max(160),
      relationship: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(6).max(40),
      altPhone: z.string().max(40).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const templateTaskSchema = z.object({
  title: z.string().trim().min(2).max(260),
  description: z.string().max(2000).nullable().optional(),
  ownerType: z.enum(['employee', 'manager', 'hr', 'it', 'buddy', 'other']),
  ownerUserId: uuid.nullable().optional(),
  kind: z
    .enum([
      'document',
      'form',
      'course',
      'meeting',
      'reading',
      'equipment',
      'system_access',
      'generic',
    ])
    .default('generic'),
  offsetDays: z.number().int().min(-90).max(365).default(0),
  courseId: uuid.nullable().optional(),
  formId: uuid.nullable().optional(),
  documentTypeId: uuid.nullable().optional(),
  policyId: uuid.nullable().optional(),
  isRequired: z.boolean().default(true),
});

const templateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  kind: z.enum(['onboarding', 'offboarding']).default('onboarding'),
  description: z.string().max(1000).nullable().optional(),
  positionId: uuid.nullable().optional(),
  departmentId: uuid.nullable().optional(),
  locationId: uuid.nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  tasks: z.array(templateTaskSchema).default([]),
});

const startProcessSchema = z.object({
  employeeId: uuid,
  templateId: uuid.nullable().optional(),
  referenceDate: isoDate,
  kind: z.enum(['onboarding', 'offboarding']).default('onboarding'),
  buddyEmployeeId: uuid.nullable().optional(),
  exitReason: z.string().max(80).nullable().optional(),
});

const exitInterviewSchema = z.object({
  employeeId: uuid,
  processId: uuid.nullable().optional(),
  conductedAt: isoDate.nullable().optional(),
  exitReason: z.string().trim().min(2).max(80),
  wouldRecommend: z.boolean().nullable().optional(),
  npsScore: z.number().int().min(0).max(10).nullable().optional(),
  summary: z.string().max(8000).nullable().optional(),
});

@ApiTags('ingreso y salida')
@Controller({ path: 'onboarding', version: '1' })
@RequireModule(MODULES.ONBOARDING)
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly prisma: PrismaService,
  ) {}

  /* ------------------------------ templates ----------------------------- */

  @Get('templates')
  @RequirePermission('onboarding.template.read')
  @ApiOperation({ summary: 'Plantillas de ingreso y salida' })
  async templates(@Ctx() ctx: RequestContext, @Query('kind') kind?: string) {
    return this.prisma.forCompany(ctx.companyId).onboardingTemplate.findMany({
      where: { deletedAt: null, ...(kind ? { kind } : {}) },
      include: { tasks: { orderBy: { position: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post('templates')
  @RequirePermission('onboarding.template.create')
  @Audit({ entityType: 'onboarding_template' })
  @ApiOperation({ summary: 'Crea una plantilla con sus tareas' })
  async createTemplate(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(templateSchema)) dto: z.infer<typeof templateSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { tasks, ...rest } = dto;
    const template = await db.onboardingTemplate.create({
      data: { ...rest, createdById: ctx.userId },
    });
    if (tasks.length) {
      for (const [index, task] of tasks.entries()) {
        await db.onboardingTemplateTask.create({
          data: { templateId: template.id, position: index, ...task },
        });
      }
    }
    return db.onboardingTemplate.findFirst({
      where: { id: template.id },
      include: { tasks: { orderBy: { position: 'asc' } } },
    });
  }

  @Patch('templates/:id')
  @RequirePermission('onboarding.template.update')
  @Audit({ entityType: 'onboarding_template' })
  @ApiOperation({ summary: 'Actualiza una plantilla y reemplaza sus tareas' })
  async updateTemplate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(templateSchema.partial())) dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { tasks, ...rest } = dto;
    await db.onboardingTemplate.updateMany({ where: { id }, data: defined(rest) as never });
    if (Array.isArray(tasks)) {
      await db.onboardingTemplateTask.deleteMany({ where: { templateId: id } });
      for (const [index, task] of tasks.entries()) {
        await db.onboardingTemplateTask.create({
          data: { templateId: id, position: index, ...task },
        });
      }
    }
    return db.onboardingTemplate.findFirst({
      where: { id },
      include: { tasks: { orderBy: { position: 'asc' } } },
    });
  }

  @Delete('templates/:id')
  @RequirePermission('onboarding.template.delete')
  @Audit({ entityType: 'onboarding_template', action: 'delete' })
  @ApiOperation({ summary: 'Elimina una plantilla' })
  async removeTemplate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return softDelete(this.prisma.forCompany(ctx.companyId).onboardingTemplate, id);
  }

  /* ------------------------------ processes ----------------------------- */

  @Get('processes')
  @RequirePermission('onboarding.process.read')
  @ApiOperation({ summary: 'Procesos de ingreso o salida' })
  async processes(
    @Ctx() ctx: RequestContext,
    @Query()
    query: { page?: string; limit?: string; kind?: string; status?: string; employeeId?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).onboardingProcess, query, {
      where: {
        deletedAt: null,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        template: { select: { id: true, name: true } },
      },
      defaultSort: { referenceDate: 'desc' },
      sortable: ['referenceDate', 'createdAt', 'progress'],
    });
  }

  @Get('board')
  @RequirePermission('onboarding.process.read')
  @ApiOperation({ summary: 'Tablero de progreso de ingresos o salidas' })
  async board(
    @Ctx() ctx: RequestContext,
    @Query('kind') kind: 'onboarding' | 'offboarding' = 'onboarding',
  ) {
    return this.onboarding.board(ctx, kind);
  }

  @Get('processes/:id')
  @RequirePermission('onboarding.process.read')
  @ApiOperation({ summary: 'Detalle de un proceso con sus tareas' })
  async process(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).onboardingProcess.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            email: true,
            hiredAt: true,
            position: { select: { name: true } },
          },
        },
        tasks: {
          orderBy: { position: 'asc' },
          include: { assignee: { select: { fullName: true } } },
        },
      },
    });
  }

  @Post('processes')
  @RequirePermission('onboarding.process.create')
  @Audit({ entityType: 'onboarding_process' })
  @ApiOperation({ summary: 'Inicia manualmente un proceso de ingreso o salida' })
  async startProcess(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(startProcessSchema)) dto: z.infer<typeof startProcessSchema>,
  ) {
    return this.onboarding.startProcess(ctx.companyId, dto, ctx.userId);
  }

  /* -------------------------------- tasks ------------------------------- */

  @Get('tasks/mine')
  @RequirePermission('onboarding.task.read')
  @ApiOperation({ summary: 'Tareas de ingreso asignadas al usuario' })
  async myTasks(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.onboardingTask.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [{ assigneeEmployeeId: ctx.employeeId }, { assigneeUserId: ctx.userId }],
        status: { in: ['pending', 'in_progress', 'overdue'] },
      },
      include: {
        process: {
          select: { id: true, kind: true, employee: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
    });
  }

  @Post('tasks/:id/complete')
  @RequirePermission('onboarding.task.complete')
  @Audit({ entityType: 'onboarding_task', action: 'update' })
  @ApiOperation({ summary: 'Marca una tarea como completada' })
  async completeTask(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ result: z.record(z.unknown()).default({}) })))
    dto: { result: Record<string, unknown> },
  ) {
    return this.onboarding.completeTask(ctx, id, dto.result);
  }

  @Patch('tasks/:id')
  @RequirePermission('onboarding.task.update')
  @Audit({ entityType: 'onboarding_task' })
  @ApiOperation({ summary: 'Actualiza una tarea del proceso' })
  async updateTask(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'overdue']).optional(),
          assigneeEmployeeId: uuid.nullable().optional(),
          dueDate: isoDate.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.onboardingTask.updateMany({
      where: { id },
      data: {
        ...defined(dto),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
      } as never,
    });
    const task = await db.onboardingTask.findFirst({ where: { id } });
    if (task) await this.onboarding.refreshProgress(task.processId);
    return task;
  }

  /* --------------------------- exit interviews -------------------------- */

  @Post('exit-interviews')
  @RequirePermission('onboarding.exitinterview.create')
  @Audit({ entityType: 'exit_interview' })
  @ApiOperation({ summary: 'Registra la entrevista de retiro' })
  async createExitInterview(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(exitInterviewSchema)) dto: z.infer<typeof exitInterviewSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).exitInterview.create({
      data: {
        employeeId: dto.employeeId,
        processId: dto.processId ?? null,
        interviewedById: ctx.userId,
        conductedAt: dto.conductedAt ? new Date(dto.conductedAt) : new Date(),
        exitReason: dto.exitReason,
        wouldRecommend: dto.wouldRecommend ?? null,
        npsScore: dto.npsScore ?? null,
        summary: dto.summary ?? null,
      },
    });
  }

  @Get('exit-interviews')
  @RequirePermission('onboarding.exitinterview.read')
  @ApiOperation({ summary: 'Entrevistas de retiro registradas' })
  async exitInterviews(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).exitInterview, query, {
      include: { employee: { select: { id: true, fullName: true, terminatedAt: true } } },
      defaultSort: { conductedAt: 'desc' },
    });
  }

  /* ---------------------------- pre-onboarding -------------------------- */

  @Public()
  @Get('preboarding/:token')
  @ApiOperation({ summary: 'Portal de pre-ingreso accesible con enlace temporal' })
  async preboarding(@Param('token') token: string) {
    return this.onboarding.preboarding(token);
  }

  @Public()
  @Patch('preboarding/:token/profile')
  @ApiOperation({
    summary: 'El nuevo colaborador completa sus datos de contacto antes del ingreso',
  })
  async preboardingProfile(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(preboardingProfileSchema))
    dto: z.infer<typeof preboardingProfileSchema>,
  ) {
    return this.onboarding.preboardingUpdateProfile(token, dto);
  }

  @Public()
  @Post('preboarding/:token/tasks/:taskId/complete')
  @ApiOperation({
    summary: 'El nuevo colaborador completa una tarea propia (con adjunto opcional)',
  })
  async preboardingTask(
    @Param('token') token: string,
    @Param('taskId', new ZodValidationPipe(uuid)) taskId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          fileId: uuid.nullable().optional(),
          note: z.string().max(1000).nullable().optional(),
        }),
      ),
    )
    dto: { fileId?: string | null; note?: string | null },
  ) {
    return this.onboarding.preboardingCompleteTask(token, taskId, dto);
  }

  @Post('reminders/run')
  @RequirePermission('onboarding.process.update')
  @ApiOperation({ summary: 'Envia recordatorios de tareas por vencer y escala las vencidas' })
  async runReminders(@Ctx() ctx: RequestContext) {
    const sent = await this.onboarding.sendReminders(ctx.companyId);
    const escalated = await this.onboarding.escalateOverdue(ctx.companyId);
    return { sent, escalated };
  }
}
