import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { emailSchema, MODULES, SCOPES, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestContext } from '../../common/types/request-context';
import { paged, parsePage } from '../../common/utils/pagination';
import { UsersService } from './users.service';

const createUserSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().max(40).nullable().optional(),
  locale: z.enum(['es', 'en', 'de']).default('es'),
  roleIds: z.array(z.string().uuid()).min(1, 'Asigne al menos un rol'),
  employeeId: z.string().uuid().nullable().optional(),
  sendInvitation: z.boolean().default(true),
});

const roleSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().max(60).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  scope: z.enum(SCOPES).default('company'),
  permissions: z
    .array(z.object({ code: z.string().min(3), scope: z.enum(SCOPES).optional() }))
    .default([]),
  modules: z.array(z.string()).default([]),
});

const delegationSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  permissions: z.array(z.string()).min(1),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string().max(500).nullable().optional(),
});

@ApiTags('usuarios y roles')
@Controller({ path: 'users', version: '1' })
@RequireModule(MODULES.SETTINGS)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('settings.user.read')
  @ApiOperation({ summary: 'Usuarios de la empresa con sus roles' })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; search?: string; status?: string; roleId?: string },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.users.list(ctx, {
      page,
      limit,
      search: query.search,
      status: query.status,
      roleId: query.roleId,
    });
    return paged(rows, total, page, limit);
  }

  @Post()
  @RequirePermission('settings.user.create')
  @Audit({ entityType: 'user' })
  @ApiOperation({ summary: 'Crea e invita a un usuario' })
  async create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(createUserSchema)) dto: z.infer<typeof createUserSchema>,
  ) {
    return this.users.create(ctx, dto);
  }

  @Post(':userId/roles')
  @RequirePermission('settings.user.update')
  @Audit({ entityType: 'user_role', idParam: 'userId' })
  @ApiOperation({ summary: 'Reasigna los roles de un usuario' })
  async setRoles(
    @Ctx() ctx: RequestContext,
    @Param('userId', new ZodValidationPipe(uuid)) userId: string,
    @Body(new ZodValidationPipe(z.object({ companyUserId: z.string().uuid(), roleIds: z.array(z.string().uuid()) })))
    dto: { companyUserId: string; roleIds: string[] },
  ) {
    await this.users.assignRoles(ctx, dto.companyUserId, dto.roleIds);
    return { userId, roleIds: dto.roleIds };
  }

  @Patch(':userId/status')
  @RequirePermission('settings.user.update')
  @Audit({ entityType: 'user', idParam: 'userId' })
  @ApiOperation({ summary: 'Activa o desactiva un usuario' })
  async setStatus(
    @Ctx() ctx: RequestContext,
    @Param('userId', new ZodValidationPipe(uuid)) userId: string,
    @Body(new ZodValidationPipe(z.object({ status: z.enum(['active', 'inactive']) })))
    dto: { status: 'active' | 'inactive' },
  ) {
    return this.users.setStatus(ctx, userId, dto.status);
  }

  @Post(':userId/reset-password')
  @RequirePermission('settings.user.update')
  @Audit({ entityType: 'user', idParam: 'userId', summary: 'Restablecimiento de contrasena por administrador' })
  @ApiOperation({ summary: 'Genera una contrasena temporal y la envia por correo' })
  async resetPassword(
    @Ctx() ctx: RequestContext,
    @Param('userId', new ZodValidationPipe(uuid)) userId: string,
  ) {
    return this.users.resetPassword(ctx, userId);
  }

  @Post(':userId/force-password-change')
  @RequirePermission('settings.user.update')
  @Audit({ entityType: 'user', idParam: 'userId' })
  @ApiOperation({ summary: 'Obliga a cambiar la contrasena en el proximo ingreso' })
  async forcePasswordChange(
    @Ctx() ctx: RequestContext,
    @Param('userId', new ZodValidationPipe(uuid)) userId: string,
  ) {
    return this.users.forcePasswordChange(ctx, userId);
  }

  /* -------------------------------- roles ------------------------------- */

  @Get('roles/all')
  @RequirePermission('settings.role.read')
  @ApiOperation({ summary: 'Roles del sistema y personalizados' })
  async roles(@Ctx() ctx: RequestContext) {
    return this.users.listRoles(ctx);
  }

  @Post('roles')
  @RequirePermission('settings.role.create')
  @Audit({ entityType: 'role' })
  @ApiOperation({ summary: 'Crea o actualiza un rol personalizado' })
  async upsertRole(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(roleSchema)) dto: z.infer<typeof roleSchema>,
  ) {
    return this.users.upsertRole(ctx, dto);
  }

  @Delete('roles/:id')
  @RequirePermission('settings.role.delete')
  @Audit({ entityType: 'role', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un rol personalizado' })
  async deleteRole(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.users.deleteRole(ctx, id);
  }

  /* ----------------------------- delegations ---------------------------- */

  @Get('delegations/all')
  @RequirePermission('settings.delegation.manage')
  @ApiOperation({ summary: 'Delegaciones temporales de permisos' })
  async delegations(@Ctx() ctx: RequestContext) {
    return this.users.listDelegations(ctx);
  }

  @Post('delegations')
  @RequirePermission('settings.delegation.manage')
  @Audit({ entityType: 'delegation' })
  @ApiOperation({ summary: 'Crea una delegacion temporal' })
  async createDelegation(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(delegationSchema)) dto: z.infer<typeof delegationSchema>,
  ) {
    return this.users.createDelegation(ctx, dto);
  }

  @Delete('delegations/:id')
  @RequirePermission('settings.delegation.manage')
  @Audit({ entityType: 'delegation', action: 'delete' })
  @ApiOperation({ summary: 'Revoca una delegacion' })
  async revokeDelegation(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.users.revokeDelegation(ctx, id);
  }
}
