import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EmployeeStatus, Prisma } from '@prisma/client';
import {
  DOMAIN_EVENTS,
  ERROR_CODES,
  fullName as buildFullName,
  type EmployeeCreateInput,
} from '@talento/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined } from '../../common/utils/crud';
import { AuditService } from '../../core/audit/audit.service';
import { ScopeService } from '../../core/access/scope.service';
import { UsersService } from '../../core/users/users.service';

/** Personal data columns stored encrypted. */
const SENSITIVE_PERSONAL_FIELDS = [
  'bankName',
  'bankAccountType',
  'bankAccountNumber',
  'baseSalary',
  'disability',
  'medicalNotes',
] as const;

export interface EmployeeListParams {
  page: number;
  limit: number;
  search?: string;
  status?: EmployeeStatus;
  departmentId?: string;
  locationId?: string;
  positionId?: string;
  managerId?: string;
  /** Explicit ids (pickers resolving a preselected value). */
  ids?: string[];
  /** 'team' narrows the list to the caller's reporting line. */
  scope?: 'all' | 'team';
  sort?: string;
}

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  /* -------------------------------- list -------------------------------- */

  async list(ctx: RequestContext, params: EmployeeListParams) {
    const employeeScope = await this.scope.employeeScope(ctx, 'people.employee.read');
    const teamIds = params.scope === 'team' ? await this.scope.teamEmployeeIds(ctx) : null;
    const idFilters = [
      employeeScope.kind === 'ids' ? employeeScope.ids : null,
      teamIds,
      params.ids?.length ? params.ids : null,
    ].filter((ids): ids is string[] => ids !== null);

    const where: Prisma.EmployeeWhereInput = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(idFilters.length ? { AND: idFilters.map((ids) => ({ id: { in: ids } })) } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.locationId ? { locationId: params.locationId } : {}),
      ...(params.positionId ? { positionId: params.positionId } : {}),
      ...(params.managerId ? { managerId: params.managerId } : {}),
      ...(params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { documentNumber: { contains: params.search, mode: 'insensitive' } },
              { employeeCode: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderByField = (params.sort ?? 'fullName').replace('-', '');
    const direction = params.sort?.startsWith('-') ? 'desc' : 'asc';
    const sortable = ['fullName', 'hiredAt', 'employeeCode', 'createdAt', 'status'];
    const orderBy = sortable.includes(orderByField)
      ? { [orderByField]: direction }
      : { fullName: 'asc' as const };

    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          hiredAt: true,
          terminatedAt: true,
          workModality: true,
          photoFileId: true,
          position: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          manager: { select: { id: true, fullName: true } },
        },
        orderBy: orderBy as Prisma.EmployeeOrderByWithRelationInput,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { rows, total };
  }

  /**
   * Rows for the XLSX export: the list decides which employees are visible
   * (scope and filters); this only widens the columns. Sensitive, encrypted
   * fields are deliberately not selected.
   */
  async exportRows(
    ctx: RequestContext,
    params: Omit<EmployeeListParams, 'page' | 'limit'>,
    limit: number,
  ) {
    const { rows } = await this.list(ctx, { ...params, page: 1, limit });
    return this.prisma.employee.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: {
        employeeCode: true,
        firstName: true,
        lastName: true,
        secondLastName: true,
        email: true,
        personalEmail: true,
        phone: true,
        mobile: true,
        documentType: true,
        documentNumber: true,
        birthDate: true,
        gender: true,
        nationality: true,
        city: true,
        status: true,
        hiredAt: true,
        terminatedAt: true,
        workModality: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
        location: { select: { name: true } },
        costCenter: { select: { name: true } },
        manager: { select: { fullName: true, email: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  /* ------------------------------- detail ------------------------------- */

  /** Full 360 profile. Sensitive blocks are masked without the permission. */
  async findOne(ctx: RequestContext, id: string) {
    await this.scope.assertEmployeeInScope(ctx, 'people.employee.read', id);

    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: {
        position: { select: { id: true, name: true, level: true, family: true } },
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, city: true } },
        costCenter: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, fullName: true, email: true } },
        directReports: { select: { id: true, fullName: true }, where: { deletedAt: null } },
        personalData: true,
        emergencyContacts: true,
        dependents: true,
        education: { orderBy: { endDate: 'desc' } },
        workExperience: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issuedAt: 'desc' } },
        languages: true,
        skills: { include: { skill: true } },
        contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' } },
        movements: { where: { deletedAt: null }, orderBy: { effectiveDate: 'desc' }, take: 20 },
        assetAssignments: { include: { asset: true }, orderBy: { assignedAt: 'desc' } },
        user: { select: { id: true, email: true, status: true, lastLoginAt: true } },
      },
    });
    if (!employee) throw BusinessException.notFound('Colaborador');

    const canSeeSensitive = this.scope.has(ctx, 'people.sensitive.read');
    if (canSeeSensitive) {
      await this.audit.recordSensitiveAccess(ctx, 'people.sensitive.read', 'employee', id);
    }

    const personalData = employee.personalData
      ? canSeeSensitive
        ? this.encryption.decryptFields(employee.personalData, [...SENSITIVE_PERSONAL_FIELDS])
        : EncryptionService.maskFields(employee.personalData, [...SENSITIVE_PERSONAL_FIELDS])
      : null;

    const contracts = employee.contracts.map((contract) => ({
      ...contract,
      baseSalary: canSeeSensitive ? this.encryption.decryptNumber(contract.baseSalary) : null,
    }));

    const customFields = await this.customFieldValues(ctx.companyId, 'employee', id);

    return { ...employee, personalData, contracts, customFields };
  }

  async customFieldValues(companyId: string, entityType: string, entityId: string) {
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { companyId, entityType, isActive: true, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    if (!definitions.length) return [];
    const values = await this.prisma.customFieldValue.findMany({
      where: { companyId, entityType, entityId },
    });
    const byDefinition = new Map(values.map((v) => [v.definitionId, v.value]));
    return definitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      fieldType: definition.fieldType,
      options: definition.options,
      isRequired: definition.isRequired,
      employeeEditable: definition.employeeEditable,
      value: byDefinition.get(definition.id) ?? null,
    }));
  }

  async saveCustomFields(
    companyId: string,
    entityType: string,
    entityId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { companyId, entityType, isActive: true, deletedAt: null },
    });
    for (const definition of definitions) {
      if (!(definition.key in values)) continue;
      await this.prisma.customFieldValue.upsert({
        where: { definitionId_entityId: { definitionId: definition.id, entityId } },
        create: {
          companyId,
          definitionId: definition.id,
          entityType,
          entityId,
          value: values[definition.key] as object,
        },
        update: { value: values[definition.key] as object },
      });
    }
  }

  /* ------------------------------- create ------------------------------- */

  async create(ctx: RequestContext, input: EmployeeCreateInput) {
    const existing = await this.prisma.employee.findFirst({
      where: {
        companyId: ctx.companyId,
        OR: [{ documentNumber: input.documentNumber }, { email: input.email.toLowerCase() }],
        deletedAt: null,
      },
      select: { id: true, documentNumber: true, email: true },
    });
    if (existing) {
      throw BusinessException.conflict(
        'Ya existe un colaborador con ese documento o correo',
        ERROR_CODES.CONFLICT,
        existing,
      );
    }

    const employeeCode = input.employeeCode?.trim() || (await this.nextEmployeeCode(ctx.companyId));
    const employee = await this.prisma.employee.create({
      data: {
        companyId: ctx.companyId,
        employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        secondLastName: input.secondLastName ?? null,
        preferredName: input.preferredName ?? null,
        fullName: buildFullName(input),
        email: input.email.toLowerCase(),
        personalEmail: input.personalEmail ?? null,
        phone: input.phone ?? null,
        mobile: input.mobile ?? null,
        documentType: input.documentType ?? 'CC',
        documentNumber: input.documentNumber,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        gender: input.gender ?? null,
        nationality: input.nationality ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        status: input.status ?? 'active',
        hiredAt: new Date(input.hiredAt),
        positionId: input.positionId ?? null,
        departmentId: input.departmentId ?? null,
        locationId: input.locationId ?? null,
        costCenterId: input.costCenterId ?? null,
        managerId: input.managerId ?? null,
        dataConsentAt: new Date(),
        createdById: ctx.userId,
      },
    });

    if (input.customFields) {
      await this.saveCustomFields(ctx.companyId, 'employee', employee.id, input.customFields);
    }

    if (input.createUserAccount !== false) {
      const employeeRole = await this.prisma.role.findFirst({
        where: { companyId: ctx.companyId, key: 'employee', deletedAt: null },
        select: { id: true },
      });
      if (employeeRole) {
        await this.users.create(ctx, {
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          roleIds: [employeeRole.id],
          employeeId: employee.id,
          sendInvitation: true,
        });
      }
    }

    await this.events.emitAsync(DOMAIN_EVENTS.EMPLOYEE_CREATED, {
      companyId: ctx.companyId,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      hiredAt: employee.hiredAt,
      positionId: employee.positionId,
      departmentId: employee.departmentId,
      locationId: employee.locationId,
    });

    await this.audit.record(ctx, {
      action: 'create',
      entityType: 'employee',
      entityId: employee.id,
      summary: `Alta de colaborador ${employee.fullName}`,
      after: employee,
    });

    return employee;
  }

  async nextEmployeeCode(companyId: string): Promise<string> {
    const count = await this.prisma.employee.count({ where: { companyId } });
    let candidate = `EMP-${String(count + 1).padStart(5, '0')}`;
    let attempt = count + 1;
    // Codes are unique per company; skip the ones already taken.
    while (
      await this.prisma.employee.findFirst({
        where: { companyId, employeeCode: candidate },
        select: { id: true },
      })
    ) {
      attempt += 1;
      candidate = `EMP-${String(attempt).padStart(5, '0')}`;
    }
    return candidate;
  }

  /* ------------------------------- update ------------------------------- */

  async update(ctx: RequestContext, id: string, input: Record<string, any>) {
    await this.scope.assertEmployeeInScope(ctx, 'people.employee.update', id);
    const before = await this.prisma.employee.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!before) throw BusinessException.notFound('Colaborador');

    const { customFields, ...rest } = input;
    const data: Record<string, unknown> = defined({
      ...rest,
      ...(rest.email ? { email: String(rest.email).toLowerCase() } : {}),
      ...(rest.birthDate !== undefined
        ? { birthDate: rest.birthDate ? new Date(rest.birthDate) : null }
        : {}),
      ...(rest.hiredAt ? { hiredAt: new Date(rest.hiredAt) } : {}),
      updatedById: ctx.userId,
    });

    if (rest.firstName || rest.lastName || rest.secondLastName !== undefined) {
      data.fullName = buildFullName({
        firstName: rest.firstName ?? before.firstName,
        lastName: rest.lastName ?? before.lastName,
        secondLastName: rest.secondLastName ?? before.secondLastName,
      });
    }

    const employee = await this.prisma.employee.update({ where: { id }, data: data as never });

    if (customFields) {
      await this.saveCustomFields(ctx.companyId, 'employee', id, customFields);
    }

    await this.audit.record(ctx, {
      action: 'update',
      entityType: 'employee',
      entityId: id,
      summary: `Actualizacion de ${employee.fullName}`,
      before,
      after: employee,
    });
    await this.events.emitAsync(DOMAIN_EVENTS.EMPLOYEE_UPDATED, {
      companyId: ctx.companyId,
      employeeId: id,
    });

    return employee;
  }

  /** Saves the encrypted personal data block. */
  async updatePersonalData(ctx: RequestContext, id: string, input: Record<string, any>) {
    this.scope.requirePermission(ctx, 'people.employee.update');
    await this.scope.assertEmployeeInScope(ctx, 'people.employee.update', id);

    const encrypted = this.encryption.encryptFields(input, [...SENSITIVE_PERSONAL_FIELDS]);
    const data: Record<string, unknown> = defined({ ...encrypted, updatedById: ctx.userId });

    const record = await this.prisma.employeePersonalData.upsert({
      where: { employeeId: id },
      create: { companyId: ctx.companyId, employeeId: id, ...(data as object) },
      update: data as never,
    });

    await this.audit.record(ctx, {
      action: 'update',
      entityType: 'employee_personal_data',
      entityId: id,
      summary: 'Actualizacion de datos personales sensibles',
    });

    return EncryptionService.maskFields(record, [...SENSITIVE_PERSONAL_FIELDS]);
  }

  /* ---------------------------- termination ----------------------------- */

  async terminate(
    ctx: RequestContext,
    id: string,
    input: { terminatedAt: string; exitReason: string; notes?: string | null },
  ) {
    this.scope.requirePermission(ctx, 'people.employee.update');
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!employee) throw BusinessException.notFound('Colaborador');

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        status: 'inactive',
        terminatedAt: new Date(input.terminatedAt),
        exitReason: input.exitReason,
        updatedById: ctx.userId,
      },
    });

    await this.prisma.employmentContract.updateMany({
      where: { employeeId: id, isCurrent: true },
      data: { isCurrent: false, endDate: new Date(input.terminatedAt) },
    });

    if (employee.userId) {
      await this.prisma.user.update({
        where: { id: employee.userId },
        data: { status: 'inactive' },
      });
      await this.prisma.session.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.EMPLOYEE_TERMINATED, {
      companyId: ctx.companyId,
      employeeId: id,
      exitReason: input.exitReason,
      terminatedAt: input.terminatedAt,
    });
    await this.audit.record(ctx, {
      action: 'update',
      entityType: 'employee',
      entityId: id,
      summary: `Retiro de ${employee.fullName} (${input.exitReason})`,
      before: employee,
      after: updated,
    });

    return updated;
  }

  /* ----------------------------- movements ------------------------------ */

  /** Applies an approved movement to the employee record. */
  async applyMovement(companyId: string, movementId: string): Promise<void> {
    const movement = await this.prisma.employeeMovement.findFirst({
      where: { id: movementId, companyId },
    });
    if (!movement || movement.status === 'applied') return;

    await this.prisma.employee.update({
      where: { id: movement.employeeId },
      data: defined({
        positionId: movement.newPositionId ?? undefined,
        departmentId: movement.newDepartmentId ?? undefined,
        locationId: movement.newLocationId ?? undefined,
        managerId: movement.newManagerId ?? undefined,
        workModality: movement.newWorkModality ?? undefined,
      }) as never,
    });

    await this.prisma.employeeMovement.update({
      where: { id: movement.id },
      data: { status: 'applied', appliedAt: new Date() },
    });

    await this.events.emitAsync(DOMAIN_EVENTS.EMPLOYEE_MOVED, {
      companyId,
      employeeId: movement.employeeId,
      movementId: movement.id,
      movementType: movement.movementType,
    });
  }

  /* ------------------------- self service changes ------------------------ */

  /** Fields a collaborator may change without approval. */
  private static readonly SELF_EDITABLE = new Set([
    'phone',
    'mobile',
    'personalEmail',
    'address',
    'city',
    'hideCelebrations',
    'directoryVisible',
  ]);

  /** Fields that always require HR approval. */
  private static readonly APPROVAL_REQUIRED = new Set([
    'firstName',
    'lastName',
    'secondLastName',
    'documentType',
    'documentNumber',
    'birthDate',
    'gender',
    'nationality',
  ]);

  async selfUpdate(ctx: RequestContext, input: Record<string, unknown>) {
    if (!ctx.employeeId)
      throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    const employee = await this.prisma.employee.findFirst({
      where: { id: ctx.employeeId, companyId: ctx.companyId },
    });
    if (!employee) throw BusinessException.notFound('Colaborador');

    const direct: Record<string, unknown> = {};
    const requiresApproval: Record<string, unknown> = {};
    const previous: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (PeopleService.SELF_EDITABLE.has(key)) direct[key] = value;
      else if (PeopleService.APPROVAL_REQUIRED.has(key)) {
        requiresApproval[key] = value;
        previous[key] = (employee as Record<string, unknown>)[key];
      }
    }

    if (Object.keys(direct).length) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { ...direct, updatedById: ctx.userId } as never,
      });
      await this.audit.record(ctx, {
        action: 'update',
        entityType: 'employee',
        entityId: employee.id,
        summary: 'Autoservicio: actualizacion de datos de contacto',
        after: direct,
      });
    }

    let changeRequestId: string | null = null;
    if (Object.keys(requiresApproval).length) {
      const request = await this.prisma.employeeChangeRequest.create({
        data: {
          companyId: ctx.companyId,
          employeeId: employee.id,
          changes: requiresApproval as object,
          previous: previous as object,
          status: 'pending',
        },
      });
      changeRequestId = request.id;
    }

    return {
      applied: Object.keys(direct),
      pendingApproval: Object.keys(requiresApproval),
      changeRequestId,
    };
  }

  async decideChangeRequest(
    ctx: RequestContext,
    id: string,
    decision: 'approved' | 'rejected',
    comment?: string | null,
  ) {
    this.scope.requirePermission(ctx, 'people.changerequest.approve');
    const request = await this.prisma.employeeChangeRequest.findFirst({
      where: { id, companyId: ctx.companyId, status: 'pending' },
    });
    if (!request) throw BusinessException.notFound('Solicitud de cambio');

    if (decision === 'approved') {
      const changes = request.changes as Record<string, unknown>;
      const data: Record<string, unknown> = { ...changes };
      if (typeof data.birthDate === 'string') data.birthDate = new Date(data.birthDate);
      const employee = await this.prisma.employee.update({
        where: { id: request.employeeId },
        data: data as never,
      });
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: {
          fullName: buildFullName({
            firstName: employee.firstName,
            lastName: employee.lastName,
            secondLastName: employee.secondLastName,
          }),
        },
      });
    }

    const updated = await this.prisma.employeeChangeRequest.update({
      where: { id: request.id },
      data: {
        status: decision,
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        comment: comment ?? null,
      },
    });

    await this.audit.record(ctx, {
      action: decision === 'approved' ? 'approve' : 'reject',
      entityType: 'employee_change_request',
      entityId: request.id,
      summary: `Solicitud de cambio de datos ${decision === 'approved' ? 'aprobada' : 'rechazada'}`,
      after: request.changes,
    });

    return updated;
  }

  /* ------------------------------ headcount ----------------------------- */

  async headcountSummary(ctx: RequestContext) {
    const [byDepartment, byLocation, byStatus, total] = await Promise.all([
      this.prisma.employee.groupBy({
        by: ['departmentId'],
        where: { companyId: ctx.companyId, deletedAt: null, status: 'active' },
        _count: { _all: true },
      }),
      this.prisma.employee.groupBy({
        by: ['locationId'],
        where: { companyId: ctx.companyId, deletedAt: null, status: 'active' },
        _count: { _all: true },
      }),
      this.prisma.employee.groupBy({
        by: ['status'],
        where: { companyId: ctx.companyId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.employee.count({
        where: { companyId: ctx.companyId, deletedAt: null, status: 'active' },
      }),
    ]);

    const [departments, locations] = await Promise.all([
      this.prisma.department.findMany({
        where: { companyId: ctx.companyId },
        select: { id: true, name: true },
      }),
      this.prisma.location.findMany({
        where: { companyId: ctx.companyId },
        select: { id: true, name: true },
      }),
    ]);
    const departmentName = new Map(departments.map((d) => [d.id, d.name]));
    const locationName = new Map(locations.map((l) => [l.id, l.name]));

    return {
      total,
      byDepartment: byDepartment.map((row) => ({
        id: row.departmentId,
        label: row.departmentId ? (departmentName.get(row.departmentId) ?? 'Sin area') : 'Sin area',
        value: row._count._all,
      })),
      byLocation: byLocation.map((row) => ({
        id: row.locationId,
        label: row.locationId ? (locationName.get(row.locationId) ?? 'Sin sede') : 'Sin sede',
        value: row._count._all,
      })),
      byStatus: byStatus.map((row) => ({ label: row.status, value: row._count._all })),
    };
  }
}
