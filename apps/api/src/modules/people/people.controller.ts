import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  employmentContractSchema,
  employeeMovementSchema,
  isoDate,
  MODULES,
  uuid,
} from '@talento/shared';
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
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { paged, parsePage } from '../../common/utils/pagination';
import { ScopeService } from '../../core/access/scope.service';
import { FilesService } from '../../core/files/files.service';
import { WorkflowsService } from '../../core/workflows/workflows.service';
import { PeopleService } from './people.service';

const personalDataSchema = z.object({
  maritalStatus: z.string().max(40).nullable().optional(),
  bloodType: z.string().max(10).nullable().optional(),
  eps: z.string().max(120).nullable().optional(),
  arl: z.string().max(120).nullable().optional(),
  pensionFund: z.string().max(120).nullable().optional(),
  severanceFund: z.string().max(120).nullable().optional(),
  bankName: z.string().max(120).nullable().optional(),
  bankAccountType: z.string().max(40).nullable().optional(),
  bankAccountNumber: z.string().max(60).nullable().optional(),
  baseSalary: z.number().nonnegative().nullable().optional(),
  disability: z.string().max(1000).nullable().optional(),
  medicalNotes: z.string().max(2000).nullable().optional(),
  shirtSize: z.string().max(10).nullable().optional(),
  pantsSize: z.string().max(10).nullable().optional(),
  shoeSize: z.string().max(10).nullable().optional(),
});

const documentSchema = z.object({
  employeeId: uuid,
  documentTypeId: uuid,
  fileId: uuid.nullable().optional(),
  name: z.string().trim().min(2).max(260),
  issuedAt: isoDate.nullable().optional(),
  expiresAt: isoDate.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const documentTypeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(60),
  description: z.string().max(500).nullable().optional(),
  isRequired: z.boolean().default(false),
  hasExpiration: z.boolean().default(false),
  expirationAlertDays: z.number().int().min(1).max(365).default(30),
  visibleToEmployee: z.boolean().default(true),
  visibleToManager: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const assetSchema = z.object({
  assetType: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(1).max(60),
  serialNumber: z.string().max(120).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
  purchaseDate: isoDate.nullable().optional(),
  locationId: uuid.nullable().optional(),
  status: z.string().max(30).default('available'),
  notes: z.string().max(1000).nullable().optional(),
});

const assignmentSchema = z.object({
  assetId: uuid,
  employeeId: uuid,
  assignedAt: isoDate,
  conditionOut: z.string().max(300).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const terminateSchema = z.object({
  terminatedAt: isoDate,
  exitReason: z.string().trim().min(2).max(80),
  notes: z.string().max(2000).nullable().optional(),
});

const importSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(2000),
  dryRun: z.boolean().default(true),
});

@ApiTags('personas')
@Controller({ path: 'people', version: '1' })
@RequireModule(MODULES.PEOPLE)
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly scope: ScopeService,
    private readonly encryption: EncryptionService,
    private readonly workflows: WorkflowsService,
  ) {}

  /* ----------------------------- employees ------------------------------ */

  @Get('employees')
  @RequirePermission('people.employee.read')
  @ApiOperation({ summary: 'Lista de colaboradores segun el alcance del permiso' })
  async list(
    @Ctx() ctx: RequestContext,
    @Query()
    query: {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      departmentId?: string;
      locationId?: string;
      positionId?: string;
      managerId?: string;
      sort?: string;
    },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.people.list(ctx, {
      page,
      limit,
      search: query.search,
      status: query.status as never,
      departmentId: query.departmentId,
      locationId: query.locationId,
      positionId: query.positionId,
      managerId: query.managerId,
      sort: query.sort,
    });
    return paged(rows, total, page, limit);
  }

  @Get('employees/headcount')
  @RequirePermission('people.employee.read')
  @ApiOperation({ summary: 'Resumen de headcount por area, sede y estado' })
  async headcount(@Ctx() ctx: RequestContext) {
    return this.people.headcountSummary(ctx);
  }

  @Get('employees/:id')
  @RequirePermission('people.employee.read')
  @SensitiveAccess('employee')
  @ApiOperation({ summary: 'Ficha 360 del colaborador' })
  async findOne(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.people.findOne(ctx, id);
  }

  @Post('employees')
  @RequirePermission('people.employee.create')
  @Audit({ entityType: 'employee' })
  @ApiOperation({ summary: 'Crea un colaborador y opcionalmente su usuario' })
  async create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(employeeCreateSchema)) dto: z.infer<typeof employeeCreateSchema>,
  ) {
    return this.people.create(ctx, dto);
  }

  @Patch('employees/:id')
  @RequirePermission('people.employee.update')
  @Audit({ entityType: 'employee' })
  @ApiOperation({ summary: 'Actualiza los datos del colaborador' })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(employeeUpdateSchema)) dto: Record<string, unknown>,
  ) {
    return this.people.update(ctx, id, dto);
  }

  @Delete('employees/:id')
  @RequirePermission('people.employee.delete')
  @Audit({ entityType: 'employee', action: 'delete' })
  @ApiOperation({ summary: 'Elimina logicamente un colaborador' })
  async remove(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).employee, id, ctx.userId);
  }

  @Patch('employees/:id/personal-data')
  @RequirePermission('people.employee.update')
  @Audit({ entityType: 'employee_personal_data' })
  @ApiOperation({ summary: 'Actualiza los datos personales sensibles (cifrados)' })
  async updatePersonalData(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(personalDataSchema)) dto: Record<string, unknown>,
  ) {
    return this.people.updatePersonalData(ctx, id, dto);
  }

  @Post('employees/:id/terminate')
  @RequirePermission('people.employee.update')
  @Audit({ entityType: 'employee', summary: 'Retiro de colaborador' })
  @ApiOperation({ summary: 'Registra el retiro del colaborador' })
  async terminate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(terminateSchema)) dto: z.infer<typeof terminateSchema>,
  ) {
    return this.people.terminate(ctx, id, dto);
  }

  /* ------------------------------ contracts ----------------------------- */

  @Get('employees/:id/contracts')
  @RequirePermission('people.contract.read')
  @ApiOperation({ summary: 'Historial de vinculos del colaborador' })
  async contracts(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.scope.assertEmployeeInScope(ctx, 'people.contract.read', id);
    const canSeeSalary = this.scope.has(ctx, 'people.sensitive.read');
    const rows = await this.prisma.employmentContract.findMany({
      where: { companyId: ctx.companyId, employeeId: id, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => ({
      ...row,
      baseSalary: canSeeSalary ? this.encryption.decryptNumber(row.baseSalary) : null,
    }));
  }

  @Post('contracts')
  @RequirePermission('people.contract.create')
  @Audit({ entityType: 'employment_contract' })
  @ApiOperation({ summary: 'Registra un contrato (salario informativo cifrado)' })
  async createContract(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(employmentContractSchema)) dto: z.infer<typeof employmentContractSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    if (dto.isCurrent) {
      await db.employmentContract.updateMany({
        where: { employeeId: dto.employeeId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    return db.employmentContract.create({
      data: {
        employeeId: dto.employeeId,
        contractType: dto.contractType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        probationEndsAt: dto.probationEndsAt ? new Date(dto.probationEndsAt) : null,
        positionId: dto.positionId ?? null,
        departmentId: dto.departmentId ?? null,
        locationId: dto.locationId ?? null,
        workModality: dto.workModality,
        weeklyHours: dto.weeklyHours ?? null,
        baseSalary: this.encryption.encryptNumber(dto.baseSalary ?? null),
        isCurrent: dto.isCurrent,
        notes: dto.notes ?? null,
        createdById: ctx.userId,
      },
    });
  }

  @Get('contracts/expiring')
  @RequirePermission('people.contract.read')
  @ApiOperation({ summary: 'Contratos por vencer en los proximos dias' })
  async expiringContracts(@Ctx() ctx: RequestContext, @Query('days') days = '60') {
    const until = new Date(Date.now() + Number(days) * 86_400_000);
    return this.prisma.employmentContract.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        isCurrent: true,
        endDate: { not: null, lte: until, gte: new Date() },
      },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  /* ------------------------------ movements ----------------------------- */

  @Get('movements')
  @RequirePermission('people.movement.read')
  @ApiOperation({ summary: 'Movimientos de personal' })
  async movements(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string; status?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).employeeMovement, query, {
      where: {
        deletedAt: null,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      defaultSort: { effectiveDate: 'desc' },
      sortable: ['effectiveDate', 'createdAt'],
    });
  }

  @Post('movements')
  @RequirePermission('people.movement.create')
  @Audit({ entityType: 'employee_movement' })
  @ApiOperation({ summary: 'Registra un movimiento (promocion, traslado, cambio de jefe)' })
  async createMovement(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(employeeMovementSchema)) dto: z.infer<typeof employeeMovementSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const employee = await db.employee.findFirst({ where: { id: dto.employeeId } });
    if (!employee) return null;

    const movement = await db.employeeMovement.create({
      data: {
        employeeId: dto.employeeId,
        movementType: dto.movementType,
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason ?? null,
        previousPositionId: employee.positionId,
        newPositionId: dto.newPositionId ?? null,
        previousDepartmentId: employee.departmentId,
        newDepartmentId: dto.newDepartmentId ?? null,
        previousLocationId: employee.locationId,
        newLocationId: dto.newLocationId ?? null,
        previousManagerId: employee.managerId,
        newManagerId: dto.newManagerId ?? null,
        newWorkModality: dto.newWorkModality ?? null,
        status: 'pending_approval',
        createdById: ctx.userId,
      },
    });

    const { status } = await this.workflows.start({
      companyId: ctx.companyId,
      entityType: 'employee_movement',
      entityId: movement.id,
      title: `Movimiento de personal: ${employee.fullName}`,
      summary: dto.movementType,
      requestedByUserId: ctx.userId,
      subjectEmployeeId: dto.employeeId,
      context: { movementType: dto.movementType },
      url: `/people/movements/${movement.id}`,
    });

    if (status === 'approved') await this.people.applyMovement(ctx.companyId, movement.id);
    return db.employeeMovement.findFirst({ where: { id: movement.id } });
  }

  /* ------------------------------ documents ----------------------------- */

  @Get('document-types')
  @RequirePermission('people.document.read')
  @ApiOperation({ summary: 'Tipos de documento del legajo' })
  async documentTypes(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).documentType.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  @Post('document-types')
  @RequirePermission('people.documenttype.manage')
  @Audit({ entityType: 'document_type' })
  @ApiOperation({ summary: 'Crea un tipo de documento' })
  async createDocumentType(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(documentTypeSchema)) dto: z.infer<typeof documentTypeSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).documentType.create({ data: dto });
  }

  @Get('employees/:id/documents')
  @RequirePermission('people.document.read')
  @ApiOperation({ summary: 'Legajo digital del colaborador' })
  async documents(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.scope.assertEmployeeInScope(ctx, 'people.document.read', id);
    const rows = await this.prisma.employeeDocument.findMany({
      where: { companyId: ctx.companyId, employeeId: id, deletedAt: null },
      include: { documentType: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        file: row.fileId
          ? await this.files.present(await this.files.findById(ctx.companyId, row.fileId))
          : null,
      })),
    );
  }

  @Post('documents')
  @RequirePermission('people.document.create')
  @Audit({ entityType: 'employee_document' })
  @ApiOperation({ summary: 'Agrega un documento al legajo' })
  async createDocument(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(documentSchema)) dto: z.infer<typeof documentSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const previous = await db.employeeDocument.findFirst({
      where: { employeeId: dto.employeeId, documentTypeId: dto.documentTypeId, deletedAt: null },
      orderBy: { version: 'desc' },
    });
    const document = await db.employeeDocument.create({
      data: {
        employeeId: dto.employeeId,
        documentTypeId: dto.documentTypeId,
        fileId: dto.fileId ?? null,
        name: dto.name,
        version: (previous?.version ?? 0) + 1,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        notes: dto.notes ?? null,
        status: dto.expiresAt && new Date(dto.expiresAt) < new Date() ? 'expired' : 'valid',
        createdById: ctx.userId,
      },
    });
    if (dto.fileId) {
      await this.files.link(ctx.companyId, dto.fileId, 'employee_document', document.id);
    }
    await db.documentRequest.updateMany({
      where: { employeeId: dto.employeeId, documentTypeId: dto.documentTypeId, status: 'pending' },
      data: { status: 'completed', fulfilledAt: new Date() },
    });
    return document;
  }

  @Delete('documents/:id')
  @RequirePermission('people.document.delete')
  @Audit({ entityType: 'employee_document', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un documento del legajo' })
  async removeDocument(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).employeeDocument, id, ctx.userId);
  }

  @Get('documents/expiring')
  @RequirePermission('people.document.read')
  @ApiOperation({ summary: 'Documentos vencidos o por vencer' })
  async expiringDocuments(@Ctx() ctx: RequestContext, @Query('days') days = '30') {
    const until = new Date(Date.now() + Number(days) * 86_400_000);
    return this.prisma.employeeDocument.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        expiresAt: { not: null, lte: until },
      },
      include: {
        documentType: { select: { name: true } },
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take: 200,
    });
  }

  @Post('document-requests')
  @RequirePermission('people.document.request')
  @Audit({ entityType: 'document_request' })
  @ApiOperation({ summary: 'Solicita documentos faltantes a un colaborador' })
  async requestDocuments(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          employeeId: uuid,
          documentTypeIds: z.array(uuid).min(1),
          dueDate: isoDate.nullable().optional(),
          note: z.string().max(1000).nullable().optional(),
        }),
      ),
    )
    dto: { employeeId: string; documentTypeIds: string[]; dueDate?: string | null; note?: string | null },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const created = [];
    for (const documentTypeId of dto.documentTypeIds) {
      created.push(
        await db.documentRequest.create({
          data: {
            employeeId: dto.employeeId,
            documentTypeId,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            note: dto.note ?? null,
            createdById: ctx.userId,
          },
        }),
      );
    }
    return created;
  }

  /* -------------------------------- assets ------------------------------ */

  @Get('assets')
  @RequirePermission('people.asset.read')
  @ApiOperation({ summary: 'Inventario de activos' })
  async assets(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string; search?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).asset, query, {
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { serialNumber: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        assignments: {
          where: { returnedAt: null },
          include: { employee: { select: { id: true, fullName: true } } },
        },
      },
      sortable: ['name', 'code', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }

  @Post('assets')
  @RequirePermission('people.asset.create')
  @Audit({ entityType: 'asset' })
  @ApiOperation({ summary: 'Registra un activo' })
  async createAsset(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(assetSchema)) dto: z.infer<typeof assetSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).asset.create({
      data: {
        ...dto,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        createdById: ctx.userId,
      },
    });
  }

  @Post('assets/assign')
  @RequirePermission('people.asset.update')
  @Audit({ entityType: 'asset_assignment' })
  @ApiOperation({ summary: 'Asigna un activo a un colaborador' })
  async assignAsset(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(assignmentSchema)) dto: z.infer<typeof assignmentSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const assignment = await db.assetAssignment.create({
      data: {
        assetId: dto.assetId,
        employeeId: dto.employeeId,
        assignedAt: new Date(dto.assignedAt),
        conditionOut: dto.conditionOut ?? null,
        notes: dto.notes ?? null,
        createdById: ctx.userId,
      },
    });
    await db.asset.updateMany({ where: { id: dto.assetId }, data: { status: 'assigned' } });
    return assignment;
  }

  @Post('assets/assignments/:id/return')
  @RequirePermission('people.asset.update')
  @Audit({ entityType: 'asset_assignment' })
  @ApiOperation({ summary: 'Registra la devolucion de un activo' })
  async returnAsset(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({ returnedAt: isoDate, conditionIn: z.string().max(300).nullable().optional() }),
      ),
    )
    dto: { returnedAt: string; conditionIn?: string | null },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const assignment = await db.assetAssignment.findFirst({ where: { id } });
    if (!assignment) return null;
    await db.assetAssignment.update({
      where: { id },
      data: { returnedAt: new Date(dto.returnedAt), conditionIn: dto.conditionIn ?? null },
    });
    await db.asset.updateMany({ where: { id: assignment.assetId }, data: { status: 'available' } });
    return { id };
  }

  /* -------------------------- change requests --------------------------- */

  @Get('change-requests')
  @RequirePermission('people.changerequest.read')
  @ApiOperation({ summary: 'Solicitudes de cambio de datos pendientes' })
  async changeRequests(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).employeeChangeRequest, query, {
      where: { status: (query.status as never) ?? 'pending' },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('change-requests/:id/decide')
  @RequirePermission('people.changerequest.approve')
  @Audit({ entityType: 'employee_change_request', action: 'approve' })
  @ApiOperation({ summary: 'Aprueba o rechaza una solicitud de cambio de datos' })
  async decideChangeRequest(
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
    return this.people.decideChangeRequest(ctx, id, dto.decision, dto.comment);
  }

  /* ------------------------- profile sub-resources ---------------------- */

  @Post('employees/:id/education')
  @RequirePermission('people.employee.update')
  @ApiOperation({ summary: 'Agrega formacion academica' })
  async addEducation(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          level: z.string().max(60),
          institution: z.string().max(200),
          degree: z.string().max(200).nullable().optional(),
          fieldOfStudy: z.string().max(200).nullable().optional(),
          startDate: isoDate.nullable().optional(),
          endDate: isoDate.nullable().optional(),
          isCompleted: z.boolean().default(true),
          fileId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).education.create({
      data: {
        employeeId: id,
        ...defined(dto),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      } as never,
    });
  }

  @Post('employees/:id/emergency-contacts')
  @RequirePermission('people.employee.update')
  @ApiOperation({ summary: 'Agrega un contacto de emergencia' })
  async addEmergencyContact(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().max(160),
          relationship: z.string().max(60),
          phone: z.string().max(40),
          altPhone: z.string().max(40).nullable().optional(),
          address: z.string().max(240).nullable().optional(),
          isPrimary: z.boolean().default(false),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).emergencyContact.create({
      data: { employeeId: id, ...dto },
    });
  }

  @Post('employees/:id/skills')
  @RequirePermission('people.employee.update')
  @ApiOperation({ summary: 'Actualiza las habilidades del colaborador' })
  async setSkills(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          skills: z.array(z.object({ name: z.string().max(120), level: z.number().int().min(1).max(5) })),
        }),
      ),
    )
    dto: { skills: Array<{ name: string; level: number }> },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.employeeSkill.deleteMany({ where: { employeeId: id } });
    for (const entry of dto.skills) {
      const skill = await db.skill.upsert({
        where: { companyId_name: { companyId: ctx.companyId, name: entry.name } },
        create: { name: entry.name },
        update: { deletedAt: null },
      });
      await db.employeeSkill.create({
        data: { employeeId: id, skillId: skill.id, level: entry.level },
      });
    }
    return db.employeeSkill.findMany({ where: { employeeId: id }, include: { skill: true } });
  }

  /* ---------------------------- bulk import ----------------------------- */

  @Post('employees/import')
  @RequirePermission('people.employee.import')
  @Audit({ entityType: 'employee', action: 'create', summary: 'Importacion masiva de colaboradores' })
  @ApiOperation({ summary: 'Importa colaboradores desde Excel con validacion linea a linea' })
  async importEmployees(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(importSchema)) dto: z.infer<typeof importSchema>,
  ) {
    const results: Array<{ row: number; status: 'ok' | 'error'; message?: string; id?: string }> = [];

    for (const [index, raw] of dto.rows.entries()) {
      const parsed = employeeCreateSchema.safeParse({
        ...raw,
        createUserAccount: false,
      });
      if (!parsed.success) {
        results.push({
          row: index + 1,
          status: 'error',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
        continue;
      }
      if (dto.dryRun) {
        results.push({ row: index + 1, status: 'ok' });
        continue;
      }
      try {
        const employee = await this.people.create(ctx, parsed.data);
        results.push({ row: index + 1, status: 'ok', id: employee.id });
      } catch (error) {
        results.push({ row: index + 1, status: 'error', message: (error as Error).message });
      }
    }

    return {
      data: results,
      meta: {
        dryRun: dto.dryRun,
        total: results.length,
        ok: results.filter((r) => r.status === 'ok').length,
        errors: results.filter((r) => r.status === 'error').length,
      },
    };
  }

  @Get('employees/import/template')
  @RequirePermission('people.employee.import')
  @ApiOperation({ summary: 'Columnas esperadas por la plantilla de importacion' })
  async importTemplate() {
    return {
      columns: [
        { key: 'firstName', label: 'Nombres', required: true },
        { key: 'lastName', label: 'Apellidos', required: true },
        { key: 'secondLastName', label: 'Segundo apellido', required: false },
        { key: 'documentType', label: 'Tipo de documento', required: false, example: 'CC' },
        { key: 'documentNumber', label: 'Numero de documento', required: true },
        { key: 'email', label: 'Correo corporativo', required: true },
        { key: 'personalEmail', label: 'Correo personal', required: false },
        { key: 'phone', label: 'Telefono', required: false },
        { key: 'birthDate', label: 'Fecha de nacimiento (AAAA-MM-DD)', required: false },
        { key: 'gender', label: 'Genero (male/female/other/undisclosed)', required: false },
        { key: 'hiredAt', label: 'Fecha de ingreso (AAAA-MM-DD)', required: true },
        { key: 'positionId', label: 'Id del cargo', required: false },
        { key: 'departmentId', label: 'Id del area', required: false },
        { key: 'locationId', label: 'Id de la sede', required: false },
        { key: 'managerId', label: 'Id del jefe', required: false },
      ],
    };
  }
}
