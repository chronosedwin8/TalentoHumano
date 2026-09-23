import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ApproverType, WorkflowStatus } from '@prisma/client';
import { DOMAIN_EVENTS, ERROR_CODES } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { NotificationsService } from '../notifications/notifications.service';

export interface StartWorkflowInput {
  companyId: string;
  entityType: string;
  entityId: string;
  title: string;
  summary?: string;
  requestedByUserId?: string | null;
  subjectEmployeeId?: string | null;
  /** Values the step conditions are evaluated against. */
  context?: Record<string, unknown>;
  /** Link opened from the approval inbox. */
  url?: string;
}

export interface WorkflowResolvedEvent {
  companyId: string;
  instanceId: string | null;
  entityType: string;
  entityId: string;
  status: WorkflowStatus;
  decidedByUserId?: string | null;
  comment?: string | null;
}

export const WORKFLOW_RESOLVED = 'workflow.resolved';

export interface StepCondition {
  field?: string;
  op?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in';
  value?: unknown;
}

/**
 * Decides whether a step of an approval flow applies to a given request.
 *
 * A step without a condition always applies, so a flow configured with plain
 * steps behaves as a straight chain. Conditions let a company add, for example,
 * a second approver only when the absence exceeds a number of days.
 *
 * Pure and exported so the rule can be tested without a database.
 */
export function matchesStepCondition(
  condition: StepCondition | null | undefined,
  context: Record<string, unknown>,
): boolean {
  if (!condition || !condition.field || condition.op === undefined) return true;
  const actual = context[condition.field];
  const expected = condition.value;
  switch (condition.op) {
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'neq':
      return actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as never);
    case 'eq':
    default:
      return actual === expected;
  }
}

/**
 * Generic approval engine shared by leaves, personnel events, requisitions,
 * movements, shift swaps and any other object that needs sign-off.
 *
 * When a company has no definition for an entity type the request is
 * auto-approved, so every module works out of the box and gains approvals as
 * soon as a flow is configured.
 */
@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  async start(
    input: StartWorkflowInput,
  ): Promise<{ instanceId: string | null; status: WorkflowStatus }> {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: {
        companyId: input.companyId,
        entityType: input.entityType,
        isActive: true,
        deletedAt: null,
      },
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    if (!definition || definition.steps.length === 0) {
      await this.emitResolved({
        companyId: input.companyId,
        instanceId: null,
        entityType: input.entityType,
        entityId: input.entityId,
        status: 'approved',
      });
      return { instanceId: null, status: 'approved' };
    }

    const applicable = definition.steps.filter((step) =>
      this.matchesCondition(step.condition as StepCondition, input.context ?? {}),
    );
    if (applicable.length === 0) {
      await this.emitResolved({
        companyId: input.companyId,
        instanceId: null,
        entityType: input.entityType,
        entityId: input.entityId,
        status: 'approved',
      });
      return { instanceId: null, status: 'approved' };
    }

    const instance = await this.prisma.workflowInstance.create({
      data: {
        companyId: input.companyId,
        definitionId: definition.id,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        summary: input.summary ?? null,
        requestedById: input.requestedByUserId ?? null,
        subjectEmployeeId: input.subjectEmployeeId ?? null,
        status: 'pending',
        currentStep: 0,
        context: { ...(input.context ?? {}), url: input.url ?? null } as object,
      },
    });

    for (const [index, step] of applicable.entries()) {
      const approverUserId = await this.resolveApprover(
        input.companyId,
        step.approverType,
        { roleId: step.approverRoleId, userId: step.approverUserId },
        input.subjectEmployeeId ?? null,
        input.requestedByUserId ?? null,
      );
      await this.prisma.workflowStepInstance.create({
        data: {
          companyId: input.companyId,
          instanceId: instance.id,
          stepId: step.id,
          position: index,
          name: step.name,
          status: 'pending',
          approverUserId,
          dueAt: step.slaHours ? new Date(Date.now() + step.slaHours * 3_600_000) : null,
        },
      });
    }

    await this.notifyCurrentStep(instance.id);
    return { instanceId: instance.id, status: 'pending' };
  }

  /** Evaluates a single condition; an empty condition always matches. */
  private matchesCondition(
    condition: StepCondition | null,
    context: Record<string, unknown>,
  ): boolean {
    return matchesStepCondition(condition, context);
  }

  private async resolveApprover(
    companyId: string,
    type: ApproverType,
    refs: { roleId: string | null; userId: string | null },
    subjectEmployeeId: string | null,
    requesterUserId: string | null,
  ): Promise<string | null> {
    switch (type) {
      case 'user':
        return refs.userId;
      case 'requester':
        return requesterUserId;
      case 'direct_manager': {
        if (!subjectEmployeeId) return null;
        const employee = await this.prisma.employee.findFirst({
          where: { id: subjectEmployeeId, companyId },
          select: { manager: { select: { userId: true } } },
        });
        return employee?.manager?.userId ?? null;
      }
      case 'manager_of_manager': {
        if (!subjectEmployeeId) return null;
        const employee = await this.prisma.employee.findFirst({
          where: { id: subjectEmployeeId, companyId },
          select: { manager: { select: { manager: { select: { userId: true } } } } },
        });
        return employee?.manager?.manager?.userId ?? null;
      }
      case 'department_manager': {
        if (!subjectEmployeeId) return null;
        const employee = await this.prisma.employee.findFirst({
          where: { id: subjectEmployeeId, companyId },
          select: { department: { select: { managerId: true } } },
        });
        const managerId = employee?.department?.managerId;
        if (!managerId) return null;
        const manager = await this.prisma.employee.findFirst({
          where: { id: managerId, companyId },
          select: { userId: true },
        });
        return manager?.userId ?? null;
      }
      case 'hr':
      case 'role':
      default: {
        const roleKey = type === 'hr' ? 'hr_admin' : undefined;
        const role = await this.prisma.role.findFirst({
          where: refs.roleId
            ? { id: refs.roleId }
            : { companyId, key: roleKey ?? 'hr_admin', deletedAt: null },
          select: { id: true },
        });
        if (!role) return null;
        const holder = await this.prisma.userRole.findFirst({
          where: { roleId: role.id, companyUser: { companyId, isActive: true } },
          select: { companyUser: { select: { userId: true } } },
          orderBy: { createdAt: 'asc' },
        });
        return holder?.companyUser.userId ?? null;
      }
    }
  }

  private async notifyCurrentStep(instanceId: string): Promise<void> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!instance || instance.status !== 'pending') return;

    const step = instance.steps.find((s) => s.position === instance.currentStep);
    if (!step?.approverUserId) {
      // Nobody can approve this step: escalate by auto-approving it so the
      // process never gets stuck, and leave a trace.
      if (step) {
        await this.prisma.workflowStepInstance.update({
          where: { id: step.id },
          data: { status: 'approved', comment: 'Aprobado automaticamente: sin aprobador asignado' },
        });
        await this.advance(instance.id);
      }
      return;
    }

    const url = (instance.context as Record<string, unknown>)?.url as string | undefined;
    await this.notifications.notify({
      companyId: instance.companyId,
      userIds: [step.approverUserId],
      eventKey: DOMAIN_EVENTS.WORKFLOW_STEP_PENDING,
      title: `Aprobacion pendiente: ${instance.title}`,
      body: instance.summary ?? 'Tiene una solicitud pendiente de aprobacion.',
      url: url ?? '/approvals',
      entityType: 'workflow_instance',
      entityId: instance.id,
    });
  }

  async decide(
    ctx: RequestContext,
    instanceId: string,
    decision: 'approved' | 'rejected',
    comment?: string | null,
  ): Promise<{ status: WorkflowStatus }> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, companyId: ctx.companyId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!instance) throw BusinessException.notFound('Solicitud');
    if (instance.status !== 'pending') {
      throw new BusinessException(
        ERROR_CODES.WORKFLOW_ALREADY_RESOLVED,
        'La solicitud ya fue resuelta',
        409,
      );
    }

    const step = instance.steps.find((s) => s.position === instance.currentStep);
    if (!step) throw BusinessException.notFound('Paso de aprobacion');

    const isApprover =
      step.approverUserId === ctx.userId ||
      step.delegatedToId === ctx.userId ||
      ctx.isSuperadmin ||
      ctx.roles.includes('company_admin');
    if (!isApprover) {
      throw new BusinessException(
        ERROR_CODES.WORKFLOW_STEP_NOT_ALLOWED,
        'No es el aprobador de este paso',
        403,
      );
    }

    await this.prisma.workflowStepInstance.update({
      where: { id: step.id },
      data: {
        status: decision,
        decidedById: ctx.userId,
        decidedAt: new Date(),
        comment: comment ?? null,
      },
    });
    await this.prisma.workflowAction.create({
      data: {
        companyId: ctx.companyId,
        instanceId: instance.id,
        actorId: ctx.userId,
        action: decision,
        comment: comment ?? null,
      },
    });

    if (decision === 'rejected') {
      await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: { status: 'rejected', resolvedAt: new Date() },
      });
      await this.emitResolved({
        companyId: ctx.companyId,
        instanceId: instance.id,
        entityType: instance.entityType,
        entityId: instance.entityId,
        status: 'rejected',
        decidedByUserId: ctx.userId,
        comment,
      });
      await this.notifyRequester(instance.id, 'rejected', comment);
      return { status: 'rejected' };
    }

    return { status: await this.advance(instance.id, ctx.userId, comment) };
  }

  private async advance(
    instanceId: string,
    decidedByUserId?: string,
    comment?: string | null,
  ): Promise<WorkflowStatus> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!instance) return 'cancelled';

    const next = instance.steps.find(
      (s) => s.position > instance.currentStep && s.status === 'pending',
    );

    if (next) {
      await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: { currentStep: next.position },
      });
      await this.notifyCurrentStep(instance.id);
      return 'pending';
    }

    await this.prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { status: 'approved', resolvedAt: new Date() },
    });
    await this.emitResolved({
      companyId: instance.companyId,
      instanceId: instance.id,
      entityType: instance.entityType,
      entityId: instance.entityId,
      status: 'approved',
      decidedByUserId,
      comment,
    });
    await this.notifyRequester(instance.id, 'approved', comment);
    return 'approved';
  }

  private async notifyRequester(
    instanceId: string,
    status: 'approved' | 'rejected',
    comment?: string | null,
  ): Promise<void> {
    const instance = await this.prisma.workflowInstance.findFirst({ where: { id: instanceId } });
    if (!instance?.requestedById) return;
    await this.notifications.notify({
      companyId: instance.companyId,
      userIds: [instance.requestedById],
      eventKey:
        status === 'approved' ? DOMAIN_EVENTS.WORKFLOW_COMPLETED : DOMAIN_EVENTS.WORKFLOW_REJECTED,
      title: status === 'approved' ? `Aprobado: ${instance.title}` : `Rechazado: ${instance.title}`,
      body: comment ?? undefined,
      url: ((instance.context as Record<string, unknown>)?.url as string) ?? '/portal/solicitudes',
      entityType: instance.entityType,
      entityId: instance.entityId,
    });
  }

  async delegate(
    ctx: RequestContext,
    instanceId: string,
    toUserId: string,
    comment?: string | null,
  ) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, companyId: ctx.companyId },
      include: { steps: true },
    });
    if (!instance) throw BusinessException.notFound('Solicitud');
    const step = instance.steps.find((s) => s.position === instance.currentStep);
    if (!step || (step.approverUserId !== ctx.userId && !ctx.isSuperadmin)) {
      throw new BusinessException(
        ERROR_CODES.WORKFLOW_STEP_NOT_ALLOWED,
        'No es el aprobador de este paso',
        403,
      );
    }
    await this.prisma.workflowStepInstance.update({
      where: { id: step.id },
      data: { delegatedToId: toUserId, approverUserId: toUserId },
    });
    await this.prisma.workflowAction.create({
      data: {
        companyId: ctx.companyId,
        instanceId: instance.id,
        actorId: ctx.userId,
        action: 'delegate',
        comment: comment ?? null,
        metadata: { toUserId } as object,
      },
    });
    await this.notifyCurrentStep(instance.id);
    return { delegatedTo: toUserId };
  }

  async cancel(companyId: string, entityType: string, entityId: string): Promise<void> {
    await this.prisma.workflowInstance.updateMany({
      where: { companyId, entityType, entityId, status: 'pending' },
      data: { status: 'cancelled', resolvedAt: new Date() },
    });
  }

  /** Approval inbox of the current user. */
  async inbox(ctx: RequestContext, params: { page: number; limit: number }) {
    const where = {
      companyId: ctx.companyId,
      status: 'pending' as WorkflowStatus,
      steps: {
        some: {
          status: 'pending' as WorkflowStatus,
          OR: [{ approverUserId: ctx.userId }, { delegatedToId: ctx.userId }],
        },
      },
    };
    const [rows, total] = await Promise.all([
      this.prisma.workflowInstance.findMany({
        where,
        include: {
          steps: { orderBy: { position: 'asc' } },
          definition: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.workflowInstance.count({ where }),
    ]);
    return { rows, total };
  }

  async pendingCount(ctx: RequestContext): Promise<number> {
    return this.prisma.workflowInstance.count({
      where: {
        companyId: ctx.companyId,
        status: 'pending',
        steps: {
          some: {
            status: 'pending',
            OR: [{ approverUserId: ctx.userId }, { delegatedToId: ctx.userId }],
          },
        },
      },
    });
  }

  async findForEntity(companyId: string, entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findFirst({
      where: { companyId, entityType, entityId },
      include: { steps: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async emitResolved(event: WorkflowResolvedEvent): Promise<void> {
    await this.events.emitAsync(WORKFLOW_RESOLVED, event);
  }
}
