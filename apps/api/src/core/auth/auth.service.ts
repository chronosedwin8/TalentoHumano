import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_TIMEZONE,
  ERROR_CODES,
  type LoginInput,
  type SessionUser,
} from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { AccessControlService } from '../access/access-control.service';
import { AuditService } from '../audit/audit.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../notifications/mail.service';
import type { AccessTokenClaims } from '../../common/guards/jwt-auth.guard';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessControlService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------- login -------------------------------- */

  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), deletedAt: null },
      include: {
        companyUsers: {
          where: { isActive: true, deletedAt: null },
          include: { company: { select: { id: true, name: true, slug: true, isActive: true } } },
        },
      },
    });

    if (!user || !user.passwordHash) {
      // Same error and timing shape for unknown users and wrong passwords.
      await argon2.hash('timing-equalizer').catch(() => undefined);
      throw BusinessException.unauthorized(ERROR_CODES.INVALID_CREDENTIALS, 'Credenciales invalidas');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw BusinessException.unauthorized(
        ERROR_CODES.ACCOUNT_LOCKED,
        'La cuenta esta bloqueada temporalmente por intentos fallidos',
      );
    }

    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!valid) {
      await this.registerFailedAttempt(user.id, user.failedLoginAttempts);
      throw BusinessException.unauthorized(ERROR_CODES.INVALID_CREDENTIALS, 'Credenciales invalidas');
    }

    if (user.status === 'inactive') {
      throw BusinessException.unauthorized(ERROR_CODES.ACCOUNT_INACTIVE, 'La cuenta esta inactiva');
    }

    if (user.twoFactorEnabled) {
      if (!input.twoFactorCode) {
        throw BusinessException.unauthorized(
          ERROR_CODES.TWO_FACTOR_REQUIRED,
          'Ingrese el codigo de verificacion de dos pasos',
        );
      }
      const secret = this.encryption.decrypt(user.twoFactorSecret);
      const ok = secret ? authenticator.check(input.twoFactorCode, secret) : false;
      if (!ok) {
        throw BusinessException.unauthorized(
          ERROR_CODES.TWO_FACTOR_INVALID,
          'El codigo de verificacion no es valido',
        );
      }
    }

    const memberships = user.companyUsers.filter((cu) => cu.company.isActive);
    if (!memberships.length && !user.isSuperadmin) {
      throw BusinessException.forbidden('El usuario no pertenece a ninguna empresa activa');
    }

    const target =
      memberships.find((cu) => cu.companyId === input.companyId) ??
      memberships.find((cu) => cu.companyId === user.lastCompanyId) ??
      memberships.find((cu) => cu.isDefault) ??
      memberships[0];

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastCompanyId: target?.companyId ?? null,
      },
    });

    const result = await this.issueSession(user.id, target?.companyId ?? null, meta);
    await this.audit.record(
      { userId: user.id, email: user.email, companyId: target?.companyId, ...meta },
      { action: 'login', entityType: 'user', entityId: user.id, summary: 'Inicio de sesion' },
    );
    return result;
  }

  private async registerFailedAttempt(userId: string, current: number): Promise<void> {
    const max = this.config.get<number>('env.MAX_LOGIN_ATTEMPTS') ?? 5;
    const minutes = this.config.get<number>('env.LOCKOUT_MINUTES') ?? 15;
    const attempts = current + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= max ? new Date(Date.now() + minutes * 60_000) : null,
      },
    });
  }

  /* ------------------------------ sessions ------------------------------ */

  async issueSession(
    userId: string,
    companyId: string | null,
    meta: RequestMeta,
    impersonatedBy?: string | null,
  ): Promise<LoginResult> {
    const refreshToken = this.encryption.randomToken(48);
    const ttlDays = this.parseDays(this.config.get<string>('env.JWT_REFRESH_TTL') ?? '30d');

    const session = await this.prisma.session.create({
      data: {
        userId,
        companyId,
        refreshTokenHash: this.encryption.hash(refreshToken),
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
        ip: meta.ip ?? null,
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
        impersonatedBy: impersonatedBy ?? null,
      },
    });

    const accessToken = await this.signAccessToken(userId, companyId, session.id, impersonatedBy);
    const user = await this.buildSessionUser(userId, companyId, impersonatedBy);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseSeconds(this.config.get<string>('env.JWT_ACCESS_TTL') ?? '15m'),
      user,
    };
  }

  private async signAccessToken(
    userId: string,
    companyId: string | null,
    sessionId: string,
    impersonatedBy?: string | null,
  ): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { email: true, isSuperadmin: true },
    });
    const companyUser = companyId
      ? await this.prisma.companyUser.findFirst({
          where: { companyId, userId },
          select: { id: true },
        })
      : null;
    const employee = companyId
      ? await this.prisma.employee.findFirst({
          where: { companyId, userId, deletedAt: null },
          select: { id: true },
        })
      : null;

    const claims: AccessTokenClaims = {
      sub: userId,
      email: user?.email ?? '',
      cid: companyId ?? '',
      cuid: companyUser?.id ?? '',
      sid: sessionId,
      eid: employee?.id ?? null,
      sa: user?.isSuperadmin ?? false,
      imp: impersonatedBy ?? null,
    };

    return this.jwt.signAsync(claims, {
      secret: this.config.get<string>('env.JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('env.JWT_ACCESS_TTL') ?? '15m',
    });
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<LoginResult> {
    const hash = this.encryption.hash(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) {
      throw BusinessException.unauthorized(ERROR_CODES.REFRESH_TOKEN_INVALID, 'Sesion no valida');
    }

    // Rotation: the used token is revoked and a brand new one is issued.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    return this.issueSession(session.userId, session.companyId, meta, session.impersonatedBy);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        impersonatedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async switchCompany(ctx: RequestContext, companyId: string, meta: RequestMeta): Promise<LoginResult> {
    const membership = await this.prisma.companyUser.findFirst({
      where: { userId: ctx.userId, companyId, isActive: true, deletedAt: null },
      include: { company: { select: { isActive: true } } },
    });
    if (!membership?.company.isActive && !ctx.isSuperadmin) {
      throw BusinessException.forbidden('No tiene acceso a esa empresa');
    }
    await this.prisma.session.updateMany({
      where: { id: ctx.sessionId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: ctx.userId },
      data: { lastCompanyId: companyId },
    });
    return this.issueSession(ctx.userId, companyId, meta);
  }

  /* ------------------------------ identity ------------------------------ */

  async buildSessionUser(
    userId: string,
    companyId: string | null,
    impersonatedBy?: string | null,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        companyUsers: {
          where: { isActive: true, deletedAt: null },
          include: { company: { select: { id: true, name: true, slug: true, isActive: true } } },
        },
      },
    });
    if (!user) throw BusinessException.notFound('Usuario');

    const membership = user.companyUsers.find((cu) => cu.companyId === companyId);
    const access = membership
      ? await this.access.effectiveFor(membership.id, user.isSuperadmin)
      : { roles: [], permissions: [], modules: [] };

    const company = companyId
      ? await this.prisma.company.findFirst({
          where: { id: companyId },
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            timezone: true,
            locale: true,
          },
        })
      : null;

    const employee = companyId
      ? await this.prisma.employee.findFirst({
          where: { companyId, userId, deletedAt: null },
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            managerId: true,
            hiredAt: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
            location: { select: { name: true } },
          },
        })
      : null;

    let impersonator: { id: string; email: string } | null = null;
    if (impersonatedBy) {
      const row = await this.prisma.user.findFirst({
        where: { id: impersonatedBy },
        select: { id: true, email: true },
      });
      impersonator = row ?? null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      isSuperadmin: user.isSuperadmin,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
      roles: access.roles,
      permissions: access.permissions,
      modules: access.modules,
      company: company
        ? {
            id: company.id,
            name: company.name,
            slug: company.slug,
            logoUrl: company.logoUrl,
            primaryColor: company.primaryColor,
            timezone: company.timezone ?? DEFAULT_TIMEZONE,
            locale: company.locale,
            modules: access.modules,
          }
        : null,
      companies: user.companyUsers
        .filter((cu) => cu.company.isActive)
        .map((cu) => ({ id: cu.company.id, name: cu.company.name, slug: cu.company.slug })),
      employee: employee
        ? {
            id: employee.id,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            positionName: employee.position?.name ?? null,
            departmentName: employee.department?.name ?? null,
            locationName: employee.location?.name ?? null,
            managerId: employee.managerId,
            photoUrl: null,
            hiredAt: employee.hiredAt ? employee.hiredAt.toISOString().slice(0, 10) : null,
          }
        : null,
      impersonatedBy: impersonator,
    };
  }

  /* ----------------------------- passwords ------------------------------ */

  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async changePassword(ctx: RequestContext, current: string, next: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: ctx.userId } });
    if (!user?.passwordHash) throw BusinessException.notFound('Usuario');
    const valid = await argon2.verify(user.passwordHash, current).catch(() => false);
    if (!valid) {
      throw BusinessException.unauthorized(ERROR_CODES.INVALID_CREDENTIALS, 'La contrasena actual no es correcta');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await AuthService.hashPassword(next),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    await this.logoutAll(user.id, ctx.sessionId);
    await this.audit.record(ctx, {
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      summary: 'Cambio de contrasena',
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    // Always answer 204 so the endpoint cannot be used to enumerate accounts.
    if (!user) return;

    const token = this.encryption.randomToken(32);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.encryption.hash(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const webUrl = (this.config.get<string>('env.WEB_URL') ?? '').replace(/\/$/, '');
    const link = `${webUrl}/auth/restablecer?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Restablecer su contrasena en TALENTO',
      html: this.mail.render({
        title: 'Restablecer contrasena',
        body: `<p>Hola ${user.firstName},</p><p>Recibimos una solicitud para restablecer su contrasena. El enlace es valido por una hora y solo puede usarse una vez.</p>`,
        actionUrl: link,
        actionLabel: 'Crear nueva contrasena',
      }),
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: this.encryption.hash(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) {
      throw BusinessException.validation('El enlace de restablecimiento no es valido o ya expiro');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await AuthService.hashPassword(password),
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: 'active',
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /* --------------------------- two factor auth -------------------------- */

  async startTwoFactor(ctx: RequestContext): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: ctx.userId },
      data: { twoFactorSecret: this.encryption.encrypt(secret) },
    });
    const appName = this.config.get<string>('env.APP_NAME') ?? 'TALENTO';
    return { secret, otpauthUrl: authenticator.keyuri(ctx.email, appName, secret) };
  }

  async confirmTwoFactor(ctx: RequestContext, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findFirst({ where: { id: ctx.userId } });
    const secret = this.encryption.decrypt(user?.twoFactorSecret);
    if (!secret || !authenticator.check(code, secret)) {
      throw BusinessException.unauthorized(ERROR_CODES.TWO_FACTOR_INVALID, 'El codigo no es valido');
    }
    const recoveryCodes = Array.from({ length: 8 }, () => randomUUID().slice(0, 8).toUpperCase());
    await this.prisma.user.update({
      where: { id: ctx.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorRecovery: this.encryption.encrypt(JSON.stringify(recoveryCodes)),
      },
    });
    await this.audit.record(ctx, {
      action: 'update',
      entityType: 'user',
      entityId: ctx.userId,
      summary: 'Doble factor activado',
    });
    return { recoveryCodes };
  }

  async disableTwoFactor(ctx: RequestContext, password: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: ctx.userId } });
    const valid = user?.passwordHash
      ? await argon2.verify(user.passwordHash, password).catch(() => false)
      : false;
    if (!valid) {
      throw BusinessException.unauthorized(ERROR_CODES.INVALID_CREDENTIALS, 'Contrasena incorrecta');
    }
    await this.prisma.user.update({
      where: { id: ctx.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: null },
    });
  }

  /* ---------------------------- impersonation --------------------------- */

  async impersonate(ctx: RequestContext, targetUserId: string, meta: RequestMeta): Promise<LoginResult> {
    if (!ctx.isSuperadmin && !ctx.roles.includes('company_admin')) {
      throw BusinessException.forbidden('Solo un administrador de empresa puede suplantar usuarios');
    }
    const target = await this.prisma.companyUser.findFirst({
      where: { companyId: ctx.companyId, userId: targetUserId, isActive: true },
    });
    if (!target) throw BusinessException.notFound('Usuario de la empresa');

    await this.audit.record(ctx, {
      action: 'impersonate',
      entityType: 'user',
      entityId: targetUserId,
      summary: `${ctx.email} suplanto al usuario ${targetUserId}`,
    });

    return this.issueSession(targetUserId, ctx.companyId, meta, ctx.userId);
  }

  /* ------------------------------- helpers ------------------------------ */

  private parseSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }

  private parseDays(ttl: string): number {
    return Math.max(1, Math.ceil(this.parseSeconds(ttl) / 86_400));
  }
}
