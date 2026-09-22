import { Injectable } from '@nestjs/common';
import { permissionMatches, SCOPE_RANK, type Scope } from '@talento/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { RequestContext } from '../../common/types/request-context';

/** `all` means the caller may see every employee of the company. */
export type EmployeeScope = { kind: 'all' } | { kind: 'ids'; ids: string[] };

/**
 * Turns the data scope of a permission (`own | team | area | company`) into a
 * concrete set of employee ids, so every listing endpoint can narrow its query
 * the same way.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Widest scope granted to `ctx` for the given permission. */
  scopeFor(ctx: RequestContext, permission: string): Scope | null {
    let best: Scope | null = null;
    for (const granted of ctx.permissions) {
      if (!permissionMatches(granted.code, permission)) continue;
      if (!best || SCOPE_RANK[granted.scope] > SCOPE_RANK[best]) best = granted.scope;
    }
    return best;
  }

  has(ctx: RequestContext, permission: string): boolean {
    return ctx.permissions.some((p) => permissionMatches(p.code, permission));
  }

  requirePermission(ctx: RequestContext, permission: string): void {
    if (!this.has(ctx, permission)) throw BusinessException.permissionDenied(permission);
  }

  /** Employee ids visible to `ctx` under the scope of `permission`. */
  async employeeScope(ctx: RequestContext, permission: string): Promise<EmployeeScope> {
    if (ctx.isSuperadmin) return { kind: 'all' };
    const scope = this.scopeFor(ctx, permission);
    if (!scope) throw BusinessException.permissionDenied(permission);
    return this.resolveScope(ctx, scope);
  }

  async resolveScope(ctx: RequestContext, scope: Scope): Promise<EmployeeScope> {
    switch (scope) {
      case 'company':
        return { kind: 'all' };
      case 'area':
        return { kind: 'ids', ids: await this.areaEmployeeIds(ctx) };
      case 'team':
        return { kind: 'ids', ids: await this.teamEmployeeIds(ctx) };
      case 'own':
      default:
        return { kind: 'ids', ids: ctx.employeeId ? [ctx.employeeId] : [] };
    }
  }

  /** Prisma `where` fragment for an employee id column. */
  whereEmployee(scope: EmployeeScope, field = 'employeeId'): Record<string, unknown> {
    if (scope.kind === 'all') return {};
    return { [field]: { in: scope.ids.length ? scope.ids : ['00000000-0000-0000-0000-000000000000'] } };
  }

  /** The caller plus every direct and indirect report. */
  async teamEmployeeIds(ctx: RequestContext): Promise<string[]> {
    if (!ctx.employeeId) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE team AS (
        SELECT id FROM employees
          WHERE id = ${ctx.employeeId}::uuid AND company_id = ${ctx.companyId}::uuid
        UNION ALL
        SELECT e.id FROM employees e
          INNER JOIN team t ON e.manager_id = t.id
          WHERE e.company_id = ${ctx.companyId}::uuid AND e.deleted_at IS NULL
      )
      SELECT id FROM team;
    `;
    return rows.map((r) => r.id);
  }

  /** Everyone in the caller's department subtree, plus the caller. */
  async areaEmployeeIds(ctx: RequestContext): Promise<string[]> {
    if (!ctx.employeeId) return [];
    const me = await this.prisma.employee.findFirst({
      where: { id: ctx.employeeId, companyId: ctx.companyId },
      select: { departmentId: true },
    });
    if (!me?.departmentId) return this.teamEmployeeIds(ctx);

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE areas AS (
        SELECT id FROM departments
          WHERE id = ${me.departmentId}::uuid AND company_id = ${ctx.companyId}::uuid
        UNION ALL
        SELECT d.id FROM departments d
          INNER JOIN areas a ON d.parent_id = a.id
          WHERE d.company_id = ${ctx.companyId}::uuid AND d.deleted_at IS NULL
      )
      SELECT e.id FROM employees e
        WHERE e.company_id = ${ctx.companyId}::uuid
          AND e.deleted_at IS NULL
          AND (e.department_id IN (SELECT id FROM areas) OR e.id = ${ctx.employeeId}::uuid);
    `;
    return rows.map((r) => r.id);
  }

  /** Throws unless `employeeId` falls inside the scope of `permission`. */
  async assertEmployeeInScope(
    ctx: RequestContext,
    permission: string,
    employeeId: string,
  ): Promise<void> {
    const scope = await this.employeeScope(ctx, permission);
    if (scope.kind === 'all') return;
    if (!scope.ids.includes(employeeId)) throw BusinessException.outOfScope({ employeeId });
  }

  /** Direct reports of the caller, used by the manager dashboards. */
  async directReportIds(ctx: RequestContext): Promise<string[]> {
    if (!ctx.employeeId) return [];
    const rows = await this.prisma.employee.findMany({
      where: { companyId: ctx.companyId, managerId: ctx.employeeId, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
