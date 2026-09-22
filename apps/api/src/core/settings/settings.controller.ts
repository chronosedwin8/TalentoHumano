import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CATALOG_LABELS,
  MODULE_CATALOG,
  MODULES,
  PERMISSION_CATALOG,
  uuid,
} from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, softDelete } from '../../common/utils/crud';
import { AccessControlService } from '../access/access-control.service';

const companySettingsSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  legalName: z.string().max(200).nullable().optional(),
  taxId: z.string().max(40).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  faviconUrl: z.string().max(500).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  country: z.string().length(2).optional(),
  timezone: z.string().max(60).optional(),
  locale: z.enum(['es', 'en', 'de']).optional(),
  address: z.string().max(240).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  website: z.string().max(240).nullable().optional(),
  privacyPolicy: z.string().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

const catalogItemSchema = z.object({
  catalogKey: z.string().trim().min(2).max(60),
  code: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

const customFieldSchema = z.object({
  entityType: z.enum(['employee', 'candidate', 'asset', 'ticket']),
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,59}$/, 'Use minusculas, numeros y guion bajo'),
  label: z.string().trim().min(1).max(200),
  fieldType: z.enum(['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'boolean', 'file']),
  options: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  isRequired: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  employeeEditable: z.boolean().default(false),
  helpText: z.string().max(400).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const moduleMatrixSchema = z.object({
  companyModules: z.array(z.object({ moduleKey: z.string(), isEnabled: z.boolean() })).default([]),
  roleModules: z
    .array(z.object({ roleId: z.string().uuid(), moduleKey: z.string(), isVisible: z.boolean() }))
    .default([]),
  userModules: z
    .array(z.object({ userId: z.string().uuid(), moduleKey: z.string(), isVisible: z.boolean().nullable() }))
    .default([]),
});

@ApiTags('configuracion')
@Controller({ path: 'settings', version: '1' })
@RequireModule(MODULES.SETTINGS)
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  /* ------------------------------- company ------------------------------ */

  @Get('company')
  @RequirePermission('settings.company.read')
  @ApiOperation({ summary: 'Datos y marca de la empresa activa' })
  async company(@Ctx() ctx: RequestContext) {
    return this.prisma.company.findFirst({ where: { id: ctx.companyId } });
  }

  @Patch('company')
  @RequirePermission('settings.company.update')
  @Audit({ entityType: 'company' })
  @ApiOperation({ summary: 'Actualiza la configuracion y el white-label' })
  async updateCompany(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(companySettingsSchema)) dto: Record<string, unknown>,
  ) {
    const before = await this.prisma.company.findFirst({ where: { id: ctx.companyId } });
    const updated = await this.prisma.company.update({
      where: { id: ctx.companyId },
      data: { ...defined(dto), updatedById: ctx.userId } as never,
    });
    return { data: updated, meta: { changed: Object.keys(defined(dto)), previousName: before?.name } };
  }

  /* ------------------------------ catalogs ------------------------------ */

  @Get('catalogs')
  @RequirePermission('settings.catalog.manage')
  @ApiOperation({ summary: 'Catalogos configurables disponibles' })
  async catalogs() {
    return Object.entries(CATALOG_LABELS).map(([key, label]) => ({ key, label }));
  }

  @Get('catalogs/:key')
  @RequirePermission('settings.catalog.manage')
  @ApiOperation({ summary: 'Elementos de un catalogo' })
  async catalogItems(@Ctx() ctx: RequestContext, @Param('key') key: string) {
    return this.prisma.forCompany(ctx.companyId).catalogItem.findMany({
      where: { catalogKey: key, deletedAt: null },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });
  }

  @Post('catalogs')
  @RequirePermission('settings.catalog.manage')
  @Audit({ entityType: 'catalog_item' })
  @ApiOperation({ summary: 'Crea un elemento de catalogo' })
  async createCatalogItem(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(catalogItemSchema)) dto: z.infer<typeof catalogItemSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).catalogItem.create({
      data: { ...dto, metadata: dto.metadata as object, createdById: ctx.userId },
    });
  }

  @Patch('catalogs/:id')
  @RequirePermission('settings.catalog.manage')
  @Audit({ entityType: 'catalog_item' })
  @ApiOperation({ summary: 'Actualiza un elemento de catalogo' })
  async updateCatalogItem(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(catalogItemSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.catalogItem.updateMany({
      where: { id },
      data: { ...defined(dto), updatedById: ctx.userId } as never,
    });
    return db.catalogItem.findFirst({ where: { id } });
  }

  @Delete('catalogs/:id')
  @RequirePermission('settings.catalog.manage')
  @Audit({ entityType: 'catalog_item', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un elemento de catalogo' })
  async removeCatalogItem(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).catalogItem, id, ctx.userId);
  }

  /* --------------------------- custom fields ---------------------------- */

  @Get('custom-fields')
  @RequirePermission('settings.customfield.manage')
  @ApiOperation({ summary: 'Campos personalizados por entidad' })
  async customFields(@Ctx() ctx: RequestContext, @Query('entityType') entityType?: string) {
    return this.prisma.forCompany(ctx.companyId).customFieldDefinition.findMany({
      where: { deletedAt: null, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: 'asc' }, { position: 'asc' }],
    });
  }

  @Post('custom-fields')
  @RequirePermission('settings.customfield.manage')
  @Audit({ entityType: 'custom_field_definition' })
  @ApiOperation({ summary: 'Crea un campo personalizado' })
  async createCustomField(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(customFieldSchema)) dto: z.infer<typeof customFieldSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).customFieldDefinition.create({
      data: { ...dto, options: dto.options as object },
    });
  }

  @Patch('custom-fields/:id')
  @RequirePermission('settings.customfield.manage')
  @Audit({ entityType: 'custom_field_definition' })
  @ApiOperation({ summary: 'Actualiza un campo personalizado' })
  async updateCustomField(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(customFieldSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.customFieldDefinition.updateMany({ where: { id }, data: defined(dto) as never });
    return db.customFieldDefinition.findFirst({ where: { id } });
  }

  @Delete('custom-fields/:id')
  @RequirePermission('settings.customfield.manage')
  @Audit({ entityType: 'custom_field_definition', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un campo personalizado' })
  async removeCustomField(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).customFieldDefinition, id, ctx.userId);
  }

  /* --------------------------- modules matrix --------------------------- */

  @Get('modules')
  @RequirePermission('settings.module.manage')
  @ApiOperation({ summary: 'Matriz de modulos por empresa, rol y usuario' })
  async modules(@Ctx() ctx: RequestContext) {
    const [companyModules, roles, userModules] = await Promise.all([
      this.prisma.companyModule.findMany({
        where: { companyId: ctx.companyId },
        include: { module: true },
      }),
      this.prisma.role.findMany({
        where: { companyId: ctx.companyId, deletedAt: null },
        include: { modules: { include: { module: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.userModule.findMany({
        where: { companyId: ctx.companyId },
        include: { module: true },
      }),
    ]);

    return {
      catalog: MODULE_CATALOG,
      company: companyModules.map((cm) => ({ moduleKey: cm.module.key, isEnabled: cm.isEnabled })),
      roles: roles.map((role) => ({
        roleId: role.id,
        roleKey: role.key,
        roleName: role.name,
        modules: role.modules.map((rm) => ({ moduleKey: rm.module.key, isVisible: rm.isVisible })),
      })),
      users: userModules.map((um) => ({
        userId: um.userId,
        moduleKey: um.module.key,
        isVisible: um.isVisible,
      })),
    };
  }

  @Post('modules')
  @RequirePermission('settings.module.manage')
  @Audit({ entityType: 'company_module' })
  @ApiOperation({ summary: 'Guarda la matriz de modulos' })
  async updateModules(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(moduleMatrixSchema)) dto: z.infer<typeof moduleMatrixSchema>,
  ) {
    const modules = await this.prisma.appModule.findMany();
    const byKey = new Map(modules.map((m) => [m.key, m.id]));

    for (const entry of dto.companyModules) {
      const moduleId = byKey.get(entry.moduleKey);
      if (!moduleId) continue;
      await this.prisma.companyModule.upsert({
        where: { companyId_moduleId: { companyId: ctx.companyId, moduleId } },
        create: { companyId: ctx.companyId, moduleId, isEnabled: entry.isEnabled },
        update: { isEnabled: entry.isEnabled },
      });
    }

    for (const entry of dto.roleModules) {
      const moduleId = byKey.get(entry.moduleKey);
      if (!moduleId) continue;
      await this.prisma.roleModule.upsert({
        where: { roleId_moduleId: { roleId: entry.roleId, moduleId } },
        create: { roleId: entry.roleId, moduleId, isVisible: entry.isVisible },
        update: { isVisible: entry.isVisible },
      });
    }

    for (const entry of dto.userModules) {
      const moduleId = byKey.get(entry.moduleKey);
      if (!moduleId) continue;
      if (entry.isVisible === null) {
        await this.prisma.userModule.deleteMany({
          where: { companyId: ctx.companyId, userId: entry.userId, moduleId },
        });
        continue;
      }
      await this.prisma.userModule.upsert({
        where: {
          companyId_userId_moduleId: { companyId: ctx.companyId, userId: entry.userId, moduleId },
        },
        create: { companyId: ctx.companyId, userId: entry.userId, moduleId, isVisible: entry.isVisible },
        update: { isVisible: entry.isVisible },
      });
    }

    this.access.invalidate();
    return { updated: true };
  }

  /* ---------------------------- permissions ----------------------------- */

  @Get('permissions')
  @RequirePermission('settings.role.read')
  @ApiOperation({ summary: 'Catalogo completo de permisos agrupado por modulo' })
  async permissions() {
    return PERMISSION_CATALOG;
  }
}
