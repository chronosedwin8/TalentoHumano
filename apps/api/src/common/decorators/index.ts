import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { RequestContext } from '../types/request-context';

export const IS_PUBLIC_KEY = 'talento:isPublic';
export const PERMISSIONS_KEY = 'talento:permissions';
export const MODULE_KEY = 'talento:module';
export const AUDIT_KEY = 'talento:audit';
export const SENSITIVE_KEY = 'talento:sensitive';
export const SKIP_TENANT_KEY = 'talento:skipTenant';

/** Endpoint reachable without a session (public portals, health, auth). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Endpoint reachable by an authenticated user with no active company. */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);

/**
 * Requires every listed permission (`module.resource.action`).
 * The effective data scope of the first permission is exposed to the service
 * through `ctx`, so listing endpoints can narrow their results.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Requires the module to be enabled for the company and visible to the user. */
export const RequireModule = (moduleKey: string) => SetMetadata(MODULE_KEY, moduleKey);

export interface AuditMetadata {
  entityType: string;
  action?:
    | 'create'
    | 'update'
    | 'delete'
    | 'read'
    | 'export'
    | 'approve'
    | 'reject'
    | 'download'
    | 'publish'
    | 'assign'
    | 'close';
  /** Route param holding the entity id. */
  idParam?: string;
  summary?: string;
}

/** Records the call in `audit_logs` with a diff when the payload allows it. */
export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_KEY, metadata);

/** Records the read in `sensitive_access_logs`. */
export const SensitiveAccess = (entityType: string) => SetMetadata(SENSITIVE_KEY, entityType);

/** Injects the resolved request context. */
export const Ctx = createParamDecorator((_data: unknown, context: ExecutionContext): RequestContext => {
  const request = context.switchToHttp().getRequest();
  return request.ctx;
});

/** Injects the raw client IP, honouring the reverse proxy header. */
export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest();
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return request.ip ?? '';
});
