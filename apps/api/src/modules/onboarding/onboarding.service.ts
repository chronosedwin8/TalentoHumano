import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import type { TaskOwnerType } from '@prisma/client';
import { DOMAIN_EVENTS, addDays } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { NotificationsService } from '../../core/notifications/notifications.service';

interface HiredEvent {
  companyId: string;
  employeeId: string;
  hiredAt: string;
  onboardingTemplateId?: string | null;
  positionId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly encryption: EncryptionService,
    private readonly events: EventEmitter2,
  ) {}

  /** Starts onboarding automatically when a candidate is hired. */
  @OnEvent(DOMAIN_EVENTS.EMPLOYEE_HIRED, { async: true })
  async onEmployeeHired(event: HiredEvent): Promise<void> {
    try {
      await this.startProcess(
        event.companyId,
        {
          employeeId: event.employeeId,
          templateId: event.onboardingTemplateId ?? null,
          referenceDate: event.hiredAt,
          kind: 'onboarding',
        },
        null,
      );
    } catch (error) {
      this.logger.error(`No se pudo iniciar el onboarding: ${(error as Error).message}`);
    }
  }

  /** Picks the most specific template: position, then department, then default. */
  private async resolveTemplate(
    companyId: string,
    kind: string,
    employee: { positionId: string | null; departmentId: string | null; locationId: string | null },
  ) {
    const candidates = await this.prisma.onboardingTemplate.findMany({
      where: { companyId, kind, isActive: true, deletedAt: null },
    });
    if (!candidates.length) return null;
    return (
      candidates.find((t) => t.positionId && t.positionId === employee.positionId) ??
      candidates.find((t) => t.departmentId && t.departmentId === employee.departmentId) ??
      candidates.find((t) => t.locationId && t.locationId === employee.locationId) ??
      candidates.find((t) => t.isDefault) ??
      candidates[0]
    );
  }

  async startProcess(
    companyId: string,
    input: {
      employeeId: string;
      templateId?: string | null;
      referenceDate: string;
      kind: 'onboarding' | 'offboarding';
      buddyEmployeeId?: string | null;
      exitReason?: string | null;
    },
    actorUserId: string | null,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, companyId },
      select: {
        id: true,
        fullName: true,
        userId: true,
        managerId: true,
        positionId: true,
        departmentId: true,
        locationId: true,
      },
    });
    if (!employee) throw BusinessException.notFound('Colaborador');

    const template = input.templateId
      ? await this.prisma.onboardingTemplate.findFirst({
          where: { id: input.templateId, companyId, deletedAt: null },
          include: { tasks: { orderBy: { position: 'asc' } } },
        })
      : await (async () => {
          const resolved = await this.resolveTemplate(companyId, input.kind, employee);
          return resolved
            ? this.prisma.onboardingTemplate.findFirst({
                where: { id: resolved.id },
                include: { tasks: { orderBy: { position: 'asc' } } },
              })
            : null;
        })();

    const referenceDate = new Date(input.referenceDate);
    const process = await this.prisma.onboardingProcess.create({
      data: {
        companyId,
        employeeId: employee.id,
        templateId: template?.id ?? null,
        kind: input.kind,
        status: 'in_progress',
        referenceDate,
        startedAt: new Date(),
        buddyEmployeeId: input.buddyEmployeeId ?? null,
        exitReason: input.exitReason ?? null,
        preboardingToken: input.kind === 'onboarding' ? this.encryption.randomToken(24) : null,
        createdById: actorUserId,
      },
    });

    if (template?.tasks.length) {
      for (const task of template.tasks) {
        await this.prisma.onboardingTask.create({
          data: {
            companyId,
            processId: process.id,
            title: task.title,
            description: task.description,
            ownerType: task.ownerType,
            assigneeEmployeeId: this.resolveAssignee(task.ownerType, employee),
            assigneeUserId: task.ownerUserId,
            kind: task.kind,
            dueDate: addDays(referenceDate, task.offsetDays),
            position: task.position,
            courseId: task.courseId,
            formId: task.formId,
            documentTypeId: task.documentTypeId,
            policyId: task.policyId,
            isRequired: task.isRequired,
          },
        });
      }
    }

    await this.refreshProgress(process.id);

    if (employee.userId) {
      await this.notifications.notify({
        companyId,
        userIds: [employee.userId],
        eventKey:
          input.kind === 'onboarding' ? DOMAIN_EVENTS.ONBOARDING_STARTED : DOMAIN_EVENTS.OFFBOARDING_STARTED,
        title:
          input.kind === 'onboarding'
            ? 'Su proceso de ingreso esta listo'
            : 'Se inicio su proceso de salida',
        body: 'Revise sus tareas pendientes en el portal.',
        url: '/portal/tareas',
        entityType: 'onboarding_process',
        entityId: process.id,
      });
    }

    await this.events.emitAsync(
      input.kind === 'onboarding' ? DOMAIN_EVENTS.ONBOARDING_STARTED : DOMAIN_EVENTS.OFFBOARDING_STARTED,
      { companyId, processId: process.id, employeeId: employee.id },
    );

    return this.prisma.onboardingProcess.findFirst({
      where: { id: process.id },
      include: { tasks: { orderBy: { position: 'asc' } } },
    });
  }

  private resolveAssignee(
    ownerType: TaskOwnerType,
    employee: { id: string; managerId: string | null },
  ): string | null {
    if (ownerType === 'employee') return employee.id;
    if (ownerType === 'manager') return employee.managerId;
    return null;
  }

  async completeTask(
    ctx: RequestContext,
    taskId: string,
    result: Record<string, unknown> = {},
  ) {
    const task = await this.prisma.onboardingTask.findFirst({
      where: { id: taskId, companyId: ctx.companyId },
      include: { process: true },
    });
    if (!task) throw BusinessException.notFound('Tarea');

    if (task.dependsOnId) {
      const dependency = await this.prisma.onboardingTask.findFirst({
        where: { id: task.dependsOnId },
        select: { status: true, title: true },
      });
      if (dependency && dependency.status !== 'completed') {
        throw BusinessException.validation(
          `Primero debe completarse la tarea "${dependency.title}"`,
        );
      }
    }

    const updated = await this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedById: ctx.userId,
        result: result as object,
      },
    });

    await this.refreshProgress(task.processId);
    await this.events.emitAsync(DOMAIN_EVENTS.ONBOARDING_TASK_COMPLETED, {
      companyId: ctx.companyId,
      taskId,
      processId: task.processId,
      employeeId: task.process.employeeId,
    });

    return updated;
  }

  async refreshProgress(processId: string): Promise<number> {
    const tasks = await this.prisma.onboardingTask.findMany({
      where: { processId },
      select: { status: true, isRequired: true, dueDate: true },
    });
    const required = tasks.filter((t) => t.isRequired);
    const done = required.filter((t) => t.status === 'completed').length;
    const progress = required.length ? Math.round((done / required.length) * 100) : 100;

    const hasOverdue = tasks.some(
      (t) => t.status !== 'completed' && t.dueDate && t.dueDate < new Date(),
    );

    const process = await this.prisma.onboardingProcess.update({
      where: { id: processId },
      data: {
        progress,
        status: progress === 100 ? 'completed' : hasOverdue ? 'overdue' : 'in_progress',
        completedAt: progress === 100 ? new Date() : null,
      },
    });

    if (progress === 100) {
      await this.events.emitAsync(DOMAIN_EVENTS.ONBOARDING_COMPLETED, {
        companyId: process.companyId,
        processId,
        employeeId: process.employeeId,
        kind: process.kind,
      });
      if (process.kind === 'offboarding') {
        await this.prisma.employee.updateMany({
          where: { id: process.employeeId },
          data: { status: 'inactive' },
        });
      }
    }

    return progress;
  }

  /** Progress board across every open process. */
  async board(ctx: RequestContext, kind: 'onboarding' | 'offboarding') {
    const processes = await this.prisma.onboardingProcess.findMany({
      where: { companyId: ctx.companyId, kind, deletedAt: null, status: { not: 'cancelled' } },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        tasks: { select: { status: true, dueDate: true, isRequired: true } },
      },
      orderBy: { referenceDate: 'desc' },
      take: 200,
    });

    return processes.map((process) => ({
      id: process.id,
      employee: process.employee,
      referenceDate: process.referenceDate,
      status: process.status,
      progress: process.progress,
      totalTasks: process.tasks.length,
      completedTasks: process.tasks.filter((t) => t.status === 'completed').length,
      overdueTasks: process.tasks.filter(
        (t) => t.status !== 'completed' && t.dueDate && t.dueDate < new Date(),
      ).length,
    }));
  }

  /** Pre-onboarding view accessible with a temporary token, before day one. */
  async preboarding(token: string) {
    const process = await this.prisma.onboardingProcess.findFirst({
      where: { preboardingToken: token, kind: 'onboarding', deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            fullName: true,
            hiredAt: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
            location: { select: { name: true, city: true } },
            manager: { select: { fullName: true } },
          },
        },
        tasks: {
          where: { ownerType: 'employee' },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            kind: true,
            status: true,
            dueDate: true,
            documentTypeId: true,
          },
        },
      },
    });
    if (!process) throw BusinessException.notFound('Proceso de ingreso');

    const company = await this.prisma.company.findFirst({
      where: { id: process.companyId },
      select: { name: true, logoUrl: true, primaryColor: true },
    });

    return { company, employee: process.employee, tasks: process.tasks, processId: process.id };
  }

  /** Reminders for tasks that are due or overdue. */
  async sendReminders(companyId: string): Promise<number> {
    const tasks = await this.prisma.onboardingTask.findMany({
      where: {
        companyId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lte: addDays(new Date(), 1) },
        remindersSent: { lt: 3 },
      },
      include: { assignee: { select: { userId: true, fullName: true } } },
      take: 200,
    });

    let sent = 0;
    for (const task of tasks) {
      if (!task.assignee?.userId) continue;
      await this.notifications.notify({
        companyId,
        userIds: [task.assignee.userId],
        eventKey: 'onboarding.task_reminder',
        title: `Tarea pendiente: ${task.title}`,
        body: task.dueDate ? `Vence el ${task.dueDate.toISOString().slice(0, 10)}` : undefined,
        url: '/portal/tareas',
        entityType: 'onboarding_task',
        entityId: task.id,
      });
      await this.prisma.onboardingTask.update({
        where: { id: task.id },
        data: { remindersSent: { increment: 1 } },
      });
      sent += 1;
    }
    return sent;
  }
}
