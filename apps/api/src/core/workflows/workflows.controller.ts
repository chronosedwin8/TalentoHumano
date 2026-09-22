import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { uuid, workflowDecisionSchema, workflowDelegateSchema } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged, defined } from '../../common/utils/crud';
import { paged, parsePage } from '../../common/utils/pagination';
import { WorkflowsService } from './workflows.service';

const stepSchema = z.object({
  name: z.string().trim().min(2).max(200),
  approverType: z.enum([
    'direct_manager',
    'manager_of_manager',
    'hr',
    'role',
    'user',
    'department_manager',
    'requester',
  ]),
  approverRoleId: z.string().uuid().nullable().optional(),
  approverUserId: z.string().uuid().nullable().optional(),
  condition: z
    .object({
      field: z.string().optional(),
      op: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in']).optional(),
      value: z.any().optional(),
    })
    .default({}),
  slaHours: z.number().int().min(1).max(2000).nullable().optional(),
  escalateToUserId: z.string().uuid().nullable().optional(),
});

const definitionSchema = z.object({
  key: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(200),
  entityType: z.string().trim().min(2).max(80),
  description: z.string().max(500).nullable().optional(),
  mode: z.enum(['sequential', 'parallel']).default('sequential'),
  isActive: z.boolean().default(true),
  steps: z.array(stepSchema).min(1),
});

@ApiTags('workflows')
@Controller({ path: 'workflows', version: '1' })
export class WorkflowsController {
  constructor(
    private readonly workflows: WorkflowsService,
    private readonly prisma: PrismaService,
  ) {}

  /* --------------------------- approval inbox --------------------------- */

  @Get('inbox')
  @RequirePermission('workflow.instance.read')
  @ApiOperation({ summary: 'Bandeja unica de aprobaciones del usuario' })
  async inbox(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.workflows.inbox(ctx, { page, limit });
    return paged(rows, total, page, limit);
  }

  @Get('inbox/count')
  @RequirePermission('workflow.instance.read')
  @ApiOperation({ summary: 'Cantidad de aprobaciones pendientes' })
  async inboxCount(@Ctx() ctx: RequestContext) {
    return { count: await this.workflows.pendingCount(ctx) };
  }

  @Get('instances/:id')
  @RequirePermission('workflow.instance.read')
  @ApiOperation({ summary: 'Detalle de una solicitud en curso' })
  async instance(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.workflowInstance.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        definition: { select: { name: true, entityType: true } },
      },
    });
  }

  @Post('instances/:id/approve')
  @RequirePermission('workflow.instance.approve')
  @Audit({ entityType: 'workflow_instance', action: 'approve' })
  @ApiOperation({ summary: 'Aprueba el paso actual' })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(workflowDecisionSchema)) dto: { comment?: string | null },
  ) {
    return this.workflows.decide(ctx, id, 'approved', dto.comment);
  }

  @Post('instances/:id/reject')
  @RequirePermission('workflow.instance.approve')
  @Audit({ entityType: 'workflow_instance', action: 'reject' })
  @ApiOperation({ summary: 'Rechaza la solicitud' })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(workflowDecisionSchema)) dto: { comment?: string | null },
  ) {
    return this.workflows.decide(ctx, id, 'rejected', dto.comment);
  }

  @Post('instances/:id/delegate')
  @RequirePermission('workflow.instance.delegate')
  @Audit({ entityType: 'workflow_instance', action: 'update' })
  @ApiOperation({ summary: 'Delega la aprobacion en otro usuario' })
  async delegate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(workflowDelegateSchema)) dto: { toUserId: string; comment?: string | null },
  ) {
    return this.workflows.delegate(ctx, id, dto.toUserId, dto.comment);
  }

  /* ------------------------- definitions (setup) ------------------------ */

  @Get('definitions')
  @RequirePermission('settings.workflow.manage')
  @ApiOperation({ summary: 'Flujos de aprobacion configurados' })
  async definitions(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).workflowDefinition, query, {
      where: { deletedAt: null },
      include: { steps: { orderBy: { position: 'asc' } } },
      sortable: ['name', 'entityType', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }

  @Post('definitions')
  @RequirePermission('settings.workflow.manage')
  @Audit({ entityType: 'workflow_definition' })
  @ApiOperation({ summary: 'Crea o reemplaza un flujo de aprobacion' })
  async upsertDefinition(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(definitionSchema)) dto: z.infer<typeof definitionSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const existing = await db.workflowDefinition.findFirst({ where: { key: dto.key } });

    const definition = existing
      ? await db.workflowDefinition.update({
          where: { id: existing.id },
          data: defined({
            name: dto.name,
            entityType: dto.entityType,
            description: dto.description ?? null,
            mode: dto.mode,
            isActive: dto.isActive,
            updatedById: ctx.userId,
            deletedAt: null,
          }),
        })
      : await db.workflowDefinition.create({
          data: {
            key: dto.key,
            name: dto.name,
            entityType: dto.entityType,
            description: dto.description ?? null,
            mode: dto.mode,
            isActive: dto.isActive,
            createdById: ctx.userId,
          },
        });

    await db.workflowStep.deleteMany({ where: { definitionId: definition.id } });
    for (const [index, step] of dto.steps.entries()) {
      await db.workflowStep.create({
        data: {
          definitionId: definition.id,
          position: index,
          name: step.name,
          approverType: step.approverType,
          approverRoleId: step.approverRoleId ?? null,
          approverUserId: step.approverUserId ?? null,
          condition: (step.condition ?? {}) as object,
          slaHours: step.slaHours ?? null,
          escalateToUserId: step.escalateToUserId ?? null,
        },
      });
    }

    return db.workflowDefinition.findFirst({
      where: { id: definition.id },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
  }

  @Post('definitions/:id/archive')
  @RequirePermission('settings.workflow.manage')
  @Audit({ entityType: 'workflow_definition', action: 'delete' })
  @ApiOperation({ summary: 'Desactiva un flujo de aprobacion' })
  async archive(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.prisma
      .forCompany(ctx.companyId)
      .workflowDefinition.updateMany({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    return { id };
  }
}
