import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SYSTEM_ROLES } from '@talento/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { AccessControlService } from '../access/access-control.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../notifications/mail.service';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  locale?: string;
  roleIds: string[];
  employeeId?: string | null;
  sendInvitation?: boolean;
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly mail: MailService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async list(
    ctx: RequestContext,
    params: { page: number; limit: number; search?: string; status?: string; roleId?: string },
  ) {
    const where = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(params.roleId ? { roles: { some: { roleId: params.roleId } } } : {}),
      user: {
        deletedAt: null,
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.search
          ? {
              OR: [
                { email: { contains: params.search, mode: 'insensitive' as const } },
                { firstName: { contains: params.search, mode: 'insensitive' as const } },
                { lastName: { contains: params.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.companyUser.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              status: true,
              twoFactorEnabled: true,
              lastLoginAt: true,
              isSuperadmin: true,
            },
          },
          roles: { include: { role: { select: { id: true, key: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.companyUser.count({ where }),
    ]);

    const employees = await this.prisma.employee.findMany({
      where: { companyId: ctx.companyId, userId: { in: rows.map((r) => r.userId) } },
      select: { id: true, userId: true, fullName: true, employeeCode: true },
    });
    const byUser = new Map(employees.map((e) => [e.userId!, e]));

    return {
      rows: rows.map((row) => ({
        companyUserId: row.id,
        isActive: row.isActive,
        ...row.user,
        roles: row.roles.map((r) => r.role),
        employee: byUser.get(row.userId) ?? null,
      })),
      total,
    };
  }

  async create(ctx: RequestContext, input: CreateUserInput) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({ where: { email } });

    const temporaryPassword = input.password ?? this.generatePassword();
    const user =
      existing ??
      (await this.prisma.user.create({
        data: {
          email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
          locale: input.locale ?? 'es',
          status: 'invited',
          mustChangePassword: true,
          passwordHash: await AuthService.hashPassword(temporaryPassword),
        },
      }));

    const membership = await this.prisma.companyUser.upsert({
      where: { companyId_userId: { companyId: ctx.companyId, userId: user.id } },
      create: { companyId: ctx.companyId, userId: user.id, isActive: true, isDefault: !existing },
      update: { isActive: true, deletedAt: null },
    });

    await this.assignRoles(ctx, membership.id, input.roleIds);

    if (input.employeeId) {
      await this.prisma.employee.updateMany({
        where: { id: input.employeeId, companyId: ctx.companyId },
        data: { userId: user.id },
      });
    }

    if (input.sendInvitation !== false) {
      await this.sendInvitation(ctx.companyId, user.id, temporaryPassword);
    }

    this.access.invalidate(membership.id);
    return { userId: user.id, companyUserId: membership.id, temporaryPassword: existing ? null : temporaryPassword };
  }

  async assignRoles(ctx: RequestContext, companyUserId: string, roleIds: string[]): Promise<void> {
    const membership = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId: ctx.companyId },
    });
    if (!membership) throw BusinessException.notFound('Usuario de la empresa');

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, OR: [{ companyId: ctx.companyId }, { companyId: null }], deletedAt: null },
      select: { id: true, key: true },
    });
    if (roles.some((r) => r.key === SYSTEM_ROLES.SUPERADMIN) && !ctx.isSuperadmin) {
      throw BusinessException.forbidden('Solo un superadministrador puede asignar ese rol');
    }

    await this.prisma.userRole.deleteMany({ where: { companyUserId } });
    if (roles.length) {
      await this.prisma.userRole.createMany({
        data: roles.map((role) => ({ companyUserId, roleId: role.id })),
        skipDuplicates: true,
      });
    }
    this.access.invalidate(companyUserId);
  }

  async setStatus(ctx: RequestContext, userId: string, status: 'active' | 'inactive') {
    const membership = await this.prisma.companyUser.findFirst({
      where: { companyId: ctx.companyId, userId },
    });
    if (!membership) throw BusinessException.notFound('Usuario');
    if (userId === ctx.userId && status === 'inactive') {
      throw BusinessException.validation('No puede desactivar su propio usuario');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    await this.prisma.companyUser.update({
      where: { id: membership.id },
      data: { isActive: status === 'active' },
    });
    if (status === 'inactive') {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.access.invalidate(membership.id);
    return { userId, status };
  }

  async forcePasswordChange(ctx: RequestContext, userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { userId };
  }

  async resetPassword(ctx: RequestContext, userId: string) {
    const membership = await this.prisma.companyUser.findFirst({
      where: { companyId: ctx.companyId, userId },
    });
    if (!membership) throw BusinessException.notFound('Usuario');
    const password = this.generatePassword();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await AuthService.hashPassword(password),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.sendInvitation(ctx.companyId, userId, password);
    return { userId, temporaryPassword: password };
  }

  private async sendInvitation(companyId: string, userId: string, password: string): Promise<void> {
    const [user, company] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId } }),
      this.prisma.company.findFirst({
        where: { id: companyId },
        select: { name: true, primaryColor: true },
      }),
    ]);
    if (!user) return;
    const webUrl = (this.config.get<string>('env.WEB_URL') ?? '').replace(/\/$/, '');
    await this.mail.send({
      to: user.email,
      subject: `Su acceso a TALENTO - ${company?.name ?? ''}`.trim(),
      html: this.mail.render({
        title: 'Bienvenido a TALENTO',
        body: `<p>Hola ${user.firstName},</p>
               <p>Se creo su acceso a la plataforma de gestion de talento humano de ${company?.name ?? 'su empresa'}.</p>
               <p><strong>Usuario:</strong> ${user.email}<br/>
                  <strong>Contrasena temporal:</strong> ${password}</p>
               <p>Se le pedira cambiarla la primera vez que ingrese.</p>`,
        actionUrl: `${webUrl}/auth/ingresar`,
        actionLabel: 'Ingresar',
        companyName: company?.name,
        primaryColor: company?.primaryColor ?? undefined,
      }),
    });
  }

  private generatePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (base.length < 12) base.push(pick(all));
    return base.sort(() => Math.random() - 0.5).join('');
  }

  /* ------------------------------- roles -------------------------------- */

  async listRoles(ctx: RequestContext) {
    return this.prisma.role.findMany({
      where: { OR: [{ companyId: ctx.companyId }, { companyId: null }], deletedAt: null },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
        modules: { include: { module: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async upsertRole(
    ctx: RequestContext,
    input: {
      id?: string;
      key?: string;
      name: string;
      description?: string | null;
      scope: 'own' | 'team' | 'area' | 'company';
      permissions: Array<{ code: string; scope?: 'own' | 'team' | 'area' | 'company' }>;
      modules: string[];
    },
  ) {
    const existing = input.id
      ? await this.prisma.role.findFirst({ where: { id: input.id, companyId: ctx.companyId } })
      : null;
    if (input.id && !existing) throw BusinessException.notFound('Rol');
    if (existing?.isSystem) {
      throw BusinessException.validation('Los roles del sistema no se pueden modificar');
    }

    const key = existing?.key ?? input.key ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const role = existing
      ? await this.prisma.role.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            description: input.description ?? null,
            scope: input.scope,
            updatedById: ctx.userId,
          },
        })
      : await this.prisma.role.create({
          data: {
            companyId: ctx.companyId,
            key,
            name: input.name,
            description: input.description ?? null,
            scope: input.scope,
            isSystem: false,
            createdById: ctx.userId,
          },
        });

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: input.permissions.map((p) => p.code) } },
      select: { id: true, code: true },
    });
    const byCode = new Map(permissions.map((p) => [p.code, p.id]));

    await this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permission of input.permissions) {
      const permissionId = byCode.get(permission.code);
      if (!permissionId) continue;
      await this.prisma.rolePermission.create({
        data: { roleId: role.id, permissionId, scope: permission.scope ?? input.scope },
      });
    }

    const modules = await this.prisma.appModule.findMany({ where: { key: { in: input.modules } } });
    await this.prisma.roleModule.deleteMany({ where: { roleId: role.id } });
    if (modules.length) {
      await this.prisma.roleModule.createMany({
        data: modules.map((m) => ({ roleId: role.id, moduleId: m.id, isVisible: true })),
      });
    }

    this.access.invalidate();
    return role;
  }

  async deleteRole(ctx: RequestContext, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: ctx.companyId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw BusinessException.notFound('Rol');
    if (role.isSystem) throw BusinessException.validation('Los roles del sistema no se pueden eliminar');
    if (role._count.users > 0) {
      throw BusinessException.conflict('El rol tiene usuarios asignados; reasignelos primero');
    }
    await this.prisma.role.update({ where: { id: role.id }, data: { deletedAt: new Date() } });
    this.access.invalidate();
    return { id: role.id };
  }

  /* ---------------------------- delegations ----------------------------- */

  async listDelegations(ctx: RequestContext) {
    return this.prisma.delegation.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { startsAt: 'desc' },
    });
  }

  async createDelegation(
    ctx: RequestContext,
    input: {
      fromUserId: string;
      toUserId: string;
      permissions: string[];
      startsAt: string;
      endsAt: string;
      reason?: string | null;
    },
  ) {
    if (input.fromUserId === input.toUserId) {
      throw BusinessException.validation('No puede delegar en si mismo');
    }
    const delegation = await this.prisma.delegation.create({
      data: {
        companyId: ctx.companyId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        permissions: input.permissions,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        reason: input.reason ?? null,
        createdById: ctx.userId,
      },
    });
    this.access.invalidate();
    return delegation;
  }

  async revokeDelegation(ctx: RequestContext, id: string) {
    await this.prisma.delegation.updateMany({
      where: { id, companyId: ctx.companyId },
      data: { isActive: false, deletedAt: new Date() },
    });
    this.access.invalidate();
    return { id };
  }
}
