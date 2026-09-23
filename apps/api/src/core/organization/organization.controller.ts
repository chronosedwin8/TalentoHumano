import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { departmentSchema, locationSchema, MODULES, positionSchema, uuid } from '@talento/shared';
import { z } from 'zod';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, softDelete } from '../../common/utils/crud';
import { paged, parsePage } from '../../common/utils/pagination';
import { OrganizationService } from './organization.service';

const costCenterSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(1).max(40),
  description: z.string().max(400).nullable().optional(),
  isActive: z.boolean().default(true),
});

@ApiTags('organizacion')
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(
    private readonly organization: OrganizationService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /* ------------------------------ locations ----------------------------- */

  @Get('locations')
  @RequirePermission('settings.location.read')
  @ApiOperation({ summary: 'Sedes de la empresa' })
  async locations(@Ctx() ctx: RequestContext, @Query('includeInactive') includeInactive?: string) {
    return this.organization.listLocations(ctx, includeInactive === 'true');
  }

  @Post('locations')
  @RequirePermission('settings.location.create')
  @Audit({ entityType: 'location' })
  @ApiOperation({ summary: 'Crea una sede' })
  async createLocation(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(locationSchema)) dto: z.infer<typeof locationSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).location.create({
      data: { ...dto, createdById: ctx.userId },
    });
  }

  @Patch('locations/:id')
  @RequirePermission('settings.location.update')
  @Audit({ entityType: 'location' })
  @ApiOperation({ summary: 'Actualiza una sede' })
  async updateLocation(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(locationSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.location.updateMany({
      where: { id },
      data: { ...defined(dto), updatedById: ctx.userId },
    });
    return db.location.findFirst({ where: { id } });
  }

  @Delete('locations/:id')
  @RequirePermission('settings.location.delete')
  @Audit({ entityType: 'location', action: 'delete' })
  @ApiOperation({ summary: 'Elimina logicamente una sede' })
  async removeLocation(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return softDelete(this.prisma.forCompany(ctx.companyId).location, id, ctx.userId);
  }

  /* ----------------------------- departments ---------------------------- */

  @Get('departments')
  @RequirePermission('settings.department.read')
  @ApiOperation({ summary: 'Areas de la empresa' })
  async departments(
    @Ctx() ctx: RequestContext,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.organization.listDepartments(ctx, includeInactive === 'true');
  }

  @Get('departments/tree')
  @RequirePermission('settings.department.read')
  @ApiOperation({ summary: 'Areas en forma de arbol con headcount' })
  async departmentTree(@Ctx() ctx: RequestContext) {
    return this.organization.departmentTree(ctx);
  }

  @Post('departments')
  @RequirePermission('settings.department.create')
  @Audit({ entityType: 'department' })
  @ApiOperation({ summary: 'Crea un area' })
  async createDepartment(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(departmentSchema)) dto: z.infer<typeof departmentSchema>,
  ) {
    const created = await this.prisma.forCompany(ctx.companyId).department.create({
      data: { ...dto, createdById: ctx.userId },
    });
    await this.organization.refreshDepartmentPaths(ctx.companyId);
    return created;
  }

  @Patch('departments/:id')
  @RequirePermission('settings.department.update')
  @Audit({ entityType: 'department' })
  @ApiOperation({ summary: 'Actualiza un area' })
  async updateDepartment(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(departmentSchema.partial())) dto: Record<string, unknown>,
  ) {
    await this.organization.assertNoDepartmentCycle(
      ctx.companyId,
      id,
      dto.parentId as string | null | undefined,
    );
    const db = this.prisma.forCompany(ctx.companyId);
    await db.department.updateMany({
      where: { id },
      data: { ...defined(dto), updatedById: ctx.userId },
    });
    await this.organization.refreshDepartmentPaths(ctx.companyId);
    return db.department.findFirst({ where: { id } });
  }

  @Delete('departments/:id')
  @RequirePermission('settings.department.delete')
  @Audit({ entityType: 'department', action: 'delete' })
  @ApiOperation({ summary: 'Elimina logicamente un area' })
  async removeDepartment(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return softDelete(this.prisma.forCompany(ctx.companyId).department, id, ctx.userId);
  }

  /* ------------------------------ positions ----------------------------- */

  @Get('positions')
  @RequirePermission('settings.position.read')
  @ApiOperation({ summary: 'Cargos de la empresa' })
  async positions(@Ctx() ctx: RequestContext, @Query('includeInactive') includeInactive?: string) {
    return this.organization.listPositions(ctx, includeInactive === 'true');
  }

  @Get('positions/:id')
  @RequirePermission('settings.position.read')
  @ApiOperation({ summary: 'Detalle de un cargo con sus competencias' })
  async position(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const position = await this.prisma.forCompany(ctx.companyId).position.findFirst({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        competencies: { include: { competency: true } },
      },
    });
    if (!position) return null;
    const canSeeSalary = ctx.permissions.some((p) => p.code === 'people.sensitive.read');
    return {
      ...position,
      salaryRangeMin: canSeeSalary ? this.encryption.decryptNumber(position.salaryRangeMin) : null,
      salaryRangeMax: canSeeSalary ? this.encryption.decryptNumber(position.salaryRangeMax) : null,
    };
  }

  @Post('positions')
  @RequirePermission('settings.position.create')
  @Audit({ entityType: 'position' })
  @ApiOperation({ summary: 'Crea un cargo (el rango salarial se guarda cifrado)' })
  async createPosition(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(positionSchema)) dto: z.infer<typeof positionSchema>,
  ) {
    const { salaryRangeMin, salaryRangeMax, ...rest } = dto;
    return this.prisma.forCompany(ctx.companyId).position.create({
      data: {
        ...rest,
        salaryRangeMin: this.encryption.encryptNumber(salaryRangeMin ?? null),
        salaryRangeMax: this.encryption.encryptNumber(salaryRangeMax ?? null),
        createdById: ctx.userId,
      },
    });
  }

  @Patch('positions/:id')
  @RequirePermission('settings.position.update')
  @Audit({ entityType: 'position' })
  @ApiOperation({ summary: 'Actualiza un cargo' })
  async updatePosition(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(positionSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { salaryRangeMin, salaryRangeMax, ...rest } = dto as Record<string, any>;
    await db.position.updateMany({
      where: { id },
      data: {
        ...defined(rest),
        ...(salaryRangeMin !== undefined
          ? { salaryRangeMin: this.encryption.encryptNumber(salaryRangeMin) }
          : {}),
        ...(salaryRangeMax !== undefined
          ? { salaryRangeMax: this.encryption.encryptNumber(salaryRangeMax) }
          : {}),
        updatedById: ctx.userId,
      },
    });
    return db.position.findFirst({ where: { id } });
  }

  @Delete('positions/:id')
  @RequirePermission('settings.position.delete')
  @Audit({ entityType: 'position', action: 'delete' })
  @ApiOperation({ summary: 'Elimina logicamente un cargo' })
  async removePosition(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return softDelete(this.prisma.forCompany(ctx.companyId).position, id, ctx.userId);
  }

  @Post('positions/:id/competencies')
  @RequirePermission('settings.position.update')
  @Audit({ entityType: 'position_competency' })
  @ApiOperation({ summary: 'Define las competencias requeridas del cargo' })
  async setCompetencies(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          competencies: z.array(
            z.object({
              competencyId: z.string().uuid(),
              requiredLevel: z.number().int().min(1).max(5).default(3),
              weight: z.number().int().min(1).max(10).default(1),
            }),
          ),
        }),
      ),
    )
    dto: { competencies: Array<{ competencyId: string; requiredLevel: number; weight: number }> },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.positionCompetency.deleteMany({ where: { positionId: id } });
    if (dto.competencies.length) {
      await db.positionCompetency.createMany({
        data: dto.competencies.map((c) => ({ positionId: id, ...c })),
      });
    }
    return db.positionCompetency.findMany({
      where: { positionId: id },
      include: { competency: true },
    });
  }

  /* ---------------------------- cost centers ---------------------------- */

  @Get('cost-centers')
  @RequirePermission('settings.costcenter.read')
  @ApiOperation({ summary: 'Centros de costo (solo referencia informativa)' })
  async costCenters(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).costCenter.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  @Post('cost-centers')
  @RequirePermission('settings.costcenter.create')
  @Audit({ entityType: 'cost_center' })
  @ApiOperation({ summary: 'Crea un centro de costo' })
  async createCostCenter(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(costCenterSchema)) dto: z.infer<typeof costCenterSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).costCenter.create({ data: dto });
  }

  @Patch('cost-centers/:id')
  @RequirePermission('settings.costcenter.update')
  @Audit({ entityType: 'cost_center' })
  @ApiOperation({ summary: 'Actualiza un centro de costo' })
  async updateCostCenter(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(costCenterSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.costCenter.updateMany({ where: { id }, data: defined(dto) });
    return db.costCenter.findFirst({ where: { id } });
  }

  @Delete('cost-centers/:id')
  @RequirePermission('settings.costcenter.delete')
  @Audit({ entityType: 'cost_center', action: 'delete' })
  @ApiOperation({ summary: 'Elimina logicamente un centro de costo' })
  async removeCostCenter(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return softDelete(this.prisma.forCompany(ctx.companyId).costCenter, id);
  }

  /* --------------------------- chart and people -------------------------- */

  @Get('org-chart')
  @RequirePermission('people.orgchart.read')
  @ApiOperation({ summary: 'Organigrama jerarquico' })
  async orgChart(@Ctx() ctx: RequestContext, @Query('rootId') rootId?: string) {
    return this.organization.orgChart(ctx, rootId);
  }

  @Get('directory')
  @RequirePermission('people.directory.read')
  @RequireModule(MODULES.PEOPLE)
  @ApiOperation({ summary: 'Directorio de colaboradores' })
  async directory(
    @Ctx() ctx: RequestContext,
    @Query()
    query: {
      search?: string;
      departmentId?: string;
      locationId?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.organization.directory(ctx, {
      search: query.search,
      departmentId: query.departmentId,
      locationId: query.locationId,
      page,
      limit,
    });
    return paged(rows, total, page, limit);
  }
}
