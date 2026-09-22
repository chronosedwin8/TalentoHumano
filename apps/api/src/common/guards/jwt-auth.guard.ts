import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@talento/shared';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, SKIP_TENANT_KEY } from '../decorators';
import { BusinessException } from '../exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../../core/access/access-control.service';
import type { RequestContext } from '../types/request-context';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  /** Active company. */
  cid: string;
  /** company_users row id. */
  cuid: string;
  /** Session id (refresh family). */
  sid: string;
  /** Employee id, when the user is a collaborator. */
  eid?: string | null;
  sa?: boolean;
  imp?: string | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { ctx?: RequestContext }>();

    const token = this.extractToken(request);
    if (!token) {
      if (isPublic) return true;
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'Debe iniciar sesion');
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.get<string>('env.JWT_ACCESS_SECRET'),
      });
    } catch {
      if (isPublic) return true;
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'La sesion expiro');
    }

    const session = await this.prisma.session.findFirst({
      where: { id: claims.sid, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!session) {
      if (isPublic) return true;
      throw BusinessException.unauthorized(ERROR_CODES.UNAUTHENTICATED, 'La sesion fue cerrada');
    }

    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const access = claims.cuid
      ? await this.access.effectiveFor(claims.cuid, Boolean(claims.sa))
      : { roles: [], permissions: [], modules: [] };

    if (!claims.cid && !skipTenant && !isPublic) {
      throw BusinessException.forbidden('Seleccione una empresa activa');
    }

    request.ctx = {
      userId: claims.sub,
      email: claims.email,
      companyId: claims.cid,
      companyUserId: claims.cuid,
      employeeId: claims.eid ?? null,
      roles: access.roles,
      permissions: access.permissions,
      modules: access.modules,
      isSuperadmin: Boolean(claims.sa),
      sessionId: claims.sid,
      impersonatedBy: claims.imp ?? null,
      ip: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookie = (request as unknown as { cookies?: Record<string, string> }).cookies?.[
      'talento_access'
    ];
    return cookie ?? null;
  }

  private clientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
    return request.ip ?? '';
  }
}
