import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, permissionMatches } from '@talento/shared';
import { IS_PUBLIC_KEY, MODULE_KEY, PERMISSIONS_KEY } from '../decorators';
import { BusinessException } from '../exceptions/business.exception';
import type { RequestContext } from '../types/request-context';

/**
 * Enforces `@RequirePermission()` and `@RequireModule()`.
 * The frontend hides what the user cannot do; this guard is what actually
 * blocks it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const moduleKey = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const ctx = context.switchToHttp().getRequest<{ ctx?: RequestContext }>().ctx;
    if (!ctx) throw BusinessException.unauthorized();
    if (ctx.isSuperadmin) return true;

    if (moduleKey && !ctx.modules.includes(moduleKey)) {
      throw new BusinessException(
        ERROR_CODES.MODULE_DISABLED,
        'El modulo no esta activo o no esta asignado a su usuario',
        403,
        { module: moduleKey },
      );
    }

    if (!required?.length) return true;

    for (const permission of required) {
      const granted = ctx.permissions.some((p) => permissionMatches(p.code, permission));
      if (!granted) throw BusinessException.permissionDenied(permission);
    }

    return true;
  }
}
