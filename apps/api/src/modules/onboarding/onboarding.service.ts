import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import type { TaskOwnerType } from '@prisma/client';
import { DOMAIN_EVENTS, addDays } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { FilesService } from '../../core/files/files.service';
import { LearningService } from '../learning/learning.service';

interface HiredEvent {
  companyId: string;
  employeeId: string;
  hiredAt: string;
  onboardingTemplateId?: string | null;
  positionId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
}

interface TerminatedEvent {
  companyId: string;
  employeeId: string;
  exitReason: string;
  terminatedAt: string;
}

/** Days after day one at which the manager checks in with the new hire. */
export const FOLLOW_UP_DAYS = [30, 60, 90] as const;

/** Days a task may stay overdue before HR is told about it. */
const ESCALATION_GRACE_DAYS = 3;

/** Roles that receive the escalation of overdue tasks. */
const ESCALATION_ROLE_KEYS = ['hr_admin', 'company_admin'];

/** Employee columns a new hire may fill in from the pre-boarding portal. */
export interface PreboardingProfileInput {
  phone?: string | null;
  mobile?: string | null;
  personalEmail?: string | null;
  address?: string | null;
  city?: string | null;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    altPhone?: string | null;
  } | null;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly encryption: EncryptionService,
    private readonly events: EventEmitter2,
    private readonly files: FilesService,
    private readonly learning: LearningService,
  ) {}

  /**
   * Starts onboarding automatically when a candidate is hired.
   *
   * Without `async: true` the emitter awaits this listener, so the hiring
   * response already reflects the process: the recruiter lands on the new
   * employee and sees the onboarding tasks, not an empty screen.
   */
  @OnEvent(DOMAIN_EVENTS.EMPLOYEE_HIRED)
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
      this.logger.error(`Could not start onboarding: ${(error as Error).message}`);
    }
  }

  /**
   * Opens the offboarding checklist when a termination is registered.
   *
   * Only when the company has an offboarding template: a process without
   * tasks would complete itself on the spot, and that is worse than none.
   * Idempotent, so registering the same termination twice does not open a
   * second checklist.
   */
  @OnEvent(DOMAIN_EVENTS.EMPLOYEE_TERMINATED)
  async onEmployeeTerminated(event: TerminatedEvent): Promise<void> {
    try {
      const existing = await this.prisma.onboardingProcess.findFirst({
        where: {
          companyId: event.companyId,
          employeeId: event.employeeId,
          kind: 'offboarding',
          deletedAt: null,
          status: { in: ['pending', 'in_progress', 'overdue'] },
        },
        select: { id: true },
      });
      if (existing) return;

      const employee = await this.prisma.employee.findFirst({
        where: { id: event.employeeId, companyId: event.companyId },
        select: { positionId: true, departmentId: true, locationId: true },
      });
      if (!employee) return;
      const template = await this.resolveTemplate(event.companyId, 'offboarding', employee);
      if (!template) return;

      await this.startProcess(
        event.companyId,
        {
          employeeId: event.employeeId,
          templateId: template.id,
          referenceDate: event.terminatedAt,
          kind: 'offboarding',
          exitReason: event.exitReason,
        },
        null,
      );
    } catch (error) {
      this.logger.error(`Could not start offboarding: ${(error as Error).message}`);
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

    if (input.buddyEmployeeId) {
      const buddy = await this.prisma.employee.findFirst({
        where: { id: input.buddyEmployeeId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!buddy) throw BusinessException.notFound('Buddy');
    }

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

    const assignee = { ...employee, buddyEmployeeId: input.buddyEmployeeId ?? null };
    const courseIds = new Set<string>();

    if (template?.tasks.length) {
      for (const task of template.tasks) {
        await this.prisma.onboardingTask.create({
          data: {
            companyId,
            processId: process.id,
            title: task.title,
            description: task.description,
            ownerType: task.ownerType,
            assigneeEmployeeId: this.resolveAssignee(task.ownerType, assignee),
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
        if (task.courseId) courseIds.add(task.courseId);
      }
    }

    if (input.kind === 'onboarding') {
      await this.createFollowUps(
        companyId,
        process.id,
        referenceDate,
        template?.tasks ?? [],
        assignee,
      );
    }

    await this.enrollInCourses(companyId, employee.id, [...courseIds], referenceDate, actorUserId);

    await this.refreshProgress(process.id);

    if (employee.userId) {
      await this.notifications.notify({
        companyId,
        userIds: [employee.userId],
        eventKey:
          input.kind === 'onboarding'
            ? DOMAIN_EVENTS.ONBOARDING_STARTED
            : DOMAIN_EVENTS.OFFBOARDING_STARTED,
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
      input.kind === 'onboarding'
        ? DOMAIN_EVENTS.ONBOARDING_STARTED
        : DOMAIN_EVENTS.OFFBOARDING_STARTED,
      { companyId, processId: process.id, employeeId: employee.id },
    );

    return this.prisma.onboardingProcess.findFirst({
      where: { id: process.id },
      include: { tasks: { orderBy: { position: 'asc' } } },
    });
  }

  /**
   * Adds the 30/60/90-day check-ins unless the template already schedules a
   * meeting on those days. They belong to the manager: the point is that the
   * person who leads the new hire sits down with them, not HR.
   */
  private async createFollowUps(
    companyId: string,
    processId: string,
    referenceDate: Date,
    templateTasks: Array<{ kind: string; offsetDays: number; position: number }>,
    employee: { id: string; managerId: string | null; buddyEmployeeId: string | null },
  ): Promise<void> {
    const covered = new Set(
      templateTasks.filter((t) => t.kind === 'meeting').map((t) => t.offsetDays),
    );
    let position = templateTasks.reduce((max, t) => Math.max(max, t.position), -1) + 1;

    for (const day of FOLLOW_UP_DAYS) {
      if (covered.has(day)) continue;
      await this.prisma.onboardingTask.create({
        data: {
          companyId,
          processId,
          title: `Seguimiento de ${day} dias`,
          description:
            'Reunion de seguimiento con el jefe directo: como va la adaptacion, que necesita y ' +
            'que ajustar en el plan de ingreso.',
          ownerType: 'manager',
          assigneeEmployeeId: this.resolveAssignee('manager', employee),
          kind: 'meeting',
          dueDate: addDays(referenceDate, day),
          position: position++,
          isRequired: true,
        },
      });
    }
  }

  /**
   * Enrolls the new hire in every course the checklist references. Each
   * course is independent: a missing or archived one is logged and skipped so
   * the process still opens.
   */
  private async enrollInCourses(
    companyId: string,
    employeeId: string,
    courseIds: string[],
    referenceDate: Date,
    actorUserId: string | null,
  ): Promise<void> {
    if (!courseIds.length) return;
    const ctx = { companyId, userId: actorUserId } as RequestContext;
    for (const courseId of courseIds) {
      try {
        await this.learning.enroll(ctx, {
          courseId,
          employeeIds: [employeeId],
          dueDate: addDays(referenceDate, 30).toISOString().slice(0, 10),
          source: 'onboarding',
        });
      } catch (error) {
        this.logger.warn(`Could not enroll in course ${courseId}: ${(error as Error).message}`);
      }
    }
  }

  private resolveAssignee(
    ownerType: TaskOwnerType,
    employee: { id: string; managerId: string | null; buddyEmployeeId?: string | null },
  ): string | null {
    if (ownerType === 'employee') return employee.id;
    if (ownerType === 'manager') return employee.managerId;
    if (ownerType === 'buddy') return employee.buddyEmployeeId ?? null;
    return null;
  }

  async completeTask(ctx: RequestContext, taskId: string, result: Record<string, unknown> = {}) {
    const task = await this.prisma.onboardingTask.findFirst({
      where: { id: taskId, companyId: ctx.companyId },
      include: { process: true },
    });
    if (!task) throw BusinessException.notFound('Tarea');

    await this.assertDependencyDone(task.dependsOnId);

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

  private async assertDependencyDone(dependsOnId: string | null): Promise<void> {
    if (!dependsOnId) return;
    const dependency = await this.prisma.onboardingTask.findFirst({
      where: { id: dependsOnId },
      select: { status: true, title: true },
    });
    if (dependency && dependency.status !== 'completed') {
      throw BusinessException.validation(`Primero debe completarse la tarea "${dependency.title}"`);
    }
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
        await this.finalizeOffboarding(process.employeeId);
      }
    }

    return progress;
  }

  /**
   * Closes the employee's access once the exit checklist is done.
   *
   * The effective date wins: a checklist finished early keeps the person
   * active until `terminatedAt`, and the daily termination job deactivates
   * them that day. Without an effective date the completion itself is the
   * exit.
   */
  private async finalizeOffboarding(employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId },
      select: { userId: true, terminatedAt: true, status: true },
    });
    if (!employee) return;
    if (employee.terminatedAt && employee.terminatedAt > new Date()) return;

    await this.prisma.employee.updateMany({
      where: { id: employeeId },
      data: { status: 'inactive', terminatedAt: employee.terminatedAt ?? new Date() },
    });
    if (employee.userId) {
      await this.prisma.user.updateMany({
        where: { id: employee.userId },
        data: { status: 'inactive' },
      });
      await this.prisma.session.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
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

  /* ---------------------------- pre-onboarding -------------------------- */

  /** Resolves the token to its process, or fails as "not found" (never "forbidden"). */
  private async processByToken(token: string) {
    if (!token || token.length < 16) throw BusinessException.notFound('Proceso de ingreso');
    const process = await this.prisma.onboardingProcess.findFirst({
      where: {
        preboardingToken: token,
        kind: 'onboarding',
        deletedAt: null,
        status: { not: 'cancelled' },
      },
      select: { id: true, companyId: true, employeeId: true },
    });
    if (!process) throw BusinessException.notFound('Proceso de ingreso');
    return process;
  }

  /** Pre-onboarding view accessible with a temporary token, before day one. */
  async preboarding(token: string) {
    const found = await this.processByToken(token);
    const process = await this.prisma.onboardingProcess.findFirst({
      where: { id: found.id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            fullName: true,
            hiredAt: true,
            phone: true,
            mobile: true,
            personalEmail: true,
            address: true,
            city: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
            location: { select: { name: true, city: true } },
            manager: { select: { fullName: true } },
            emergencyContacts: {
              where: { isPrimary: true },
              take: 1,
              select: { name: true, relationship: true, phone: true, altPhone: true },
            },
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
            result: true,
            completedAt: true,
          },
        },
      },
    });
    if (!process) throw BusinessException.notFound('Proceso de ingreso');

    const company = await this.prisma.company.findFirst({
      where: { id: process.companyId },
      select: { name: true, slug: true, logoUrl: true, primaryColor: true },
    });

    const documentTypeIds = process.tasks
      .map((t) => t.documentTypeId)
      .filter((id): id is string => Boolean(id));
    const documentTypes = documentTypeIds.length
      ? await this.prisma.documentType.findMany({
          where: { id: { in: documentTypeIds } },
          select: { id: true, name: true, description: true },
        })
      : [];
    const typeById = new Map(documentTypes.map((t) => [t.id, t]));

    const { emergencyContacts, ...employee } = process.employee;
    const buddy = process.buddyEmployeeId
      ? await this.prisma.employee.findFirst({
          where: { id: process.buddyEmployeeId },
          select: { fullName: true },
        })
      : null;

    return {
      company,
      processId: process.id,
      employee: { ...employee, emergencyContact: emergencyContacts[0] ?? null },
      buddy,
      tasks: process.tasks.map((task) => {
        const result = (task.result ?? {}) as Record<string, unknown>;
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          kind: task.kind,
          status: task.status,
          dueDate: task.dueDate,
          documentTypeId: task.documentTypeId,
          documentType: task.documentTypeId ? (typeById.get(task.documentTypeId) ?? null) : null,
          completedAt: task.completedAt,
          attachment:
            typeof result.filename === 'string'
              ? { filename: result.filename, uploadedAt: result.uploadedAt ?? null }
              : null,
        };
      }),
    };
  }

  /**
   * Lets the new hire fill in contact data before day one. Only plain
   * contact columns: bank data, identity and anything encrypted stays with
   * HR, who validates it against the physical documents.
   */
  async preboardingUpdateProfile(token: string, input: PreboardingProfileInput) {
    const process = await this.processByToken(token);
    const { emergencyContact, ...contact } = input;

    const data: Record<string, string | null> = {};
    for (const key of ['phone', 'mobile', 'personalEmail', 'address', 'city'] as const) {
      if (contact[key] !== undefined) data[key] = contact[key]?.trim() || null;
    }
    if (Object.keys(data).length) {
      await this.prisma.employee.updateMany({
        where: { id: process.employeeId, companyId: process.companyId },
        data,
      });
    }

    if (emergencyContact) {
      const primary = await this.prisma.emergencyContact.findFirst({
        where: { employeeId: process.employeeId, isPrimary: true },
        select: { id: true },
      });
      const payload = {
        name: emergencyContact.name.trim(),
        relationship: emergencyContact.relationship.trim(),
        phone: emergencyContact.phone.trim(),
        altPhone: emergencyContact.altPhone?.trim() || null,
        isPrimary: true,
      };
      if (primary) {
        await this.prisma.emergencyContact.update({ where: { id: primary.id }, data: payload });
      } else {
        await this.prisma.emergencyContact.create({
          data: { companyId: process.companyId, employeeId: process.employeeId, ...payload },
        });
      }
    }

    return this.preboarding(token);
  }

  /**
   * The new hire completes one of their own tasks. A document task needs the
   * uploaded file, which is filed in the digital record under the requested
   * type so HR finds it where every other document lives.
   */
  async preboardingCompleteTask(
    token: string,
    taskId: string,
    input: { fileId?: string | null; note?: string | null },
  ) {
    const process = await this.processByToken(token);
    const task = await this.prisma.onboardingTask.findFirst({
      where: { id: taskId, processId: process.id, ownerType: 'employee' },
    });
    if (!task) throw BusinessException.notFound('Tarea');
    if (task.status === 'completed') return this.preboarding(token);
    if (task.kind === 'document' && !input.fileId) {
      throw BusinessException.validation('Adjunte el documento solicitado');
    }
    await this.assertDependencyDone(task.dependsOnId);

    const result: Record<string, unknown> = { source: 'preboarding' };
    if (input.note?.trim()) result.note = input.note.trim().slice(0, 1000);

    if (input.fileId) {
      const file = await this.prisma.storedFile.findFirst({
        where: {
          id: input.fileId,
          companyId: process.companyId,
          isUploaded: true,
          deletedAt: null,
        },
        select: { id: true, filename: true },
      });
      if (!file) throw BusinessException.notFound('Archivo');

      result.fileId = file.id;
      result.filename = file.filename;
      result.uploadedAt = new Date().toISOString();

      if (task.documentTypeId) {
        const previous = await this.prisma.employeeDocument.findFirst({
          where: {
            employeeId: process.employeeId,
            documentTypeId: task.documentTypeId,
            deletedAt: null,
          },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const document = await this.prisma.employeeDocument.create({
          data: {
            companyId: process.companyId,
            employeeId: process.employeeId,
            documentTypeId: task.documentTypeId,
            fileId: file.id,
            name: file.filename,
            version: (previous?.version ?? 0) + 1,
            status: 'pending_review',
            notes: 'Cargado por el colaborador desde el portal de pre-ingreso',
          },
        });
        await this.files.link(process.companyId, file.id, 'employee_document', document.id);
        await this.prisma.documentRequest.updateMany({
          where: {
            employeeId: process.employeeId,
            documentTypeId: task.documentTypeId,
            status: 'pending',
          },
          data: { status: 'completed', fulfilledAt: new Date() },
        });
        result.documentId = document.id;
      } else {
        await this.files.link(process.companyId, file.id, 'onboarding_task', task.id);
      }
    }

    await this.prisma.onboardingTask.update({
      where: { id: task.id },
      data: { status: 'completed', completedAt: new Date(), result: result as object },
    });
    await this.refreshProgress(process.id);
    await this.events.emitAsync(DOMAIN_EVENTS.ONBOARDING_TASK_COMPLETED, {
      companyId: process.companyId,
      taskId: task.id,
      processId: process.id,
      employeeId: process.employeeId,
    });

    return this.preboarding(token);
  }

  /* ------------------------------ reminders ----------------------------- */

  /** Reminders for tasks that are due or overdue, then escalation of the stale ones. */
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

    sent += await this.escalateOverdue(companyId);
    return sent;
  }

  /**
   * Tells HR about tasks overdue for more than the grace period. One notice
   * per process per day: HR admins get a digest of the stale tasks of each
   * process, not one alert per task per run.
   */
  async escalateOverdue(companyId: string): Promise<number> {
    const threshold = addDays(new Date(), -ESCALATION_GRACE_DAYS);
    const stale = await this.prisma.onboardingTask.findMany({
      where: {
        companyId,
        status: { in: ['pending', 'in_progress', 'overdue'] },
        dueDate: { lt: threshold },
        process: { deletedAt: null, status: { notIn: ['cancelled', 'completed'] } },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        processId: true,
        process: { select: { kind: true, employee: { select: { fullName: true } } } },
      },
      orderBy: { dueDate: 'asc' },
      take: 500,
    });
    if (!stale.length) return 0;

    const admins = await this.hrAdminUserIds(companyId);
    if (!admins.length) return 0;

    const byProcess = new Map<string, typeof stale>();
    for (const task of stale) {
      const list = byProcess.get(task.processId) ?? [];
      list.push(task);
      byProcess.set(task.processId, list);
    }

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    let escalated = 0;
    for (const [processId, tasks] of byProcess) {
      const alreadyToday = await this.prisma.notification.findFirst({
        where: {
          companyId,
          eventKey: 'onboarding.task_escalated',
          entityType: 'onboarding_process',
          entityId: processId,
          createdAt: { gte: startOfToday },
        },
        select: { id: true },
      });
      if (alreadyToday) continue;

      const first = tasks[0];
      const label = first.process.kind === 'onboarding' ? 'ingreso' : 'salida';
      const lines = tasks
        .slice(0, 8)
        .map((t) => `- ${t.title} (vencio el ${t.dueDate?.toISOString().slice(0, 10) ?? '?'})`);
      if (tasks.length > 8) lines.push(`- y ${tasks.length - 8} mas`);

      await this.notifications.notify({
        companyId,
        userIds: admins,
        eventKey: 'onboarding.task_escalated',
        title: `${tasks.length} tarea(s) de ${label} vencidas: ${first.process.employee.fullName}`,
        body: `Llevan mas de ${ESCALATION_GRACE_DAYS} dias vencidas:\n${lines.join('\n')}`,
        url: `/onboarding/procesos/${processId}`,
        entityType: 'onboarding_process',
        entityId: processId,
        data: { taskIds: tasks.map((t) => t.id) },
      });
      escalated += 1;
    }
    return escalated;
  }

  /** Active users of the company holding an HR or company admin role. */
  private async hrAdminUserIds(companyId: string): Promise<string[]> {
    const holders = await this.prisma.userRole.findMany({
      where: {
        role: { key: { in: ESCALATION_ROLE_KEYS }, deletedAt: null },
        companyUser: { companyId, isActive: true, user: { status: 'active', deletedAt: null } },
      },
      select: { companyUser: { select: { userId: true } } },
    });
    return [...new Set(holders.map((h) => h.companyUser.userId))];
  }
}
