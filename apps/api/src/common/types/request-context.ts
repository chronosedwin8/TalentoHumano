import type { Scope } from '@talento/shared';

export interface AuthPermission {
  code: string;
  scope: Scope;
}

/** Everything the guards and services need about the caller. */
export interface RequestContext {
  userId: string;
  email: string;
  companyId: string;
  companyUserId: string;
  employeeId: string | null;
  /** Direct + indirect reports, resolved lazily by ScopeService. */
  roles: string[];
  permissions: AuthPermission[];
  modules: string[];
  isSuperadmin: boolean;
  sessionId: string;
  impersonatedBy?: string | null;
  ip?: string;
  userAgent?: string;
}

export interface AuthenticatedRequest extends Request {
  ctx: RequestContext;
}
