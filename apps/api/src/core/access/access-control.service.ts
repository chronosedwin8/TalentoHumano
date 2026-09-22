import { Injectable, Logger } from '@nestjs/common';
import { SCOPE_RANK, type Scope } from '@talento/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthPermission } from '../../common/types/request-context';

export interface EffectiveAccess {
  roles: string[];
  permissions: AuthPermission[];
  modules: string[];
}

interface CacheEntry {
  value: EffectiveAccess;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

/**
 * Resolves the effective permissions, data scopes and visible modules of a
 * company user: system and custom roles, per-user overrides and active
 * delegations, plus the module x role matrix with per-user overrides.
 *
 * Results are cached for one minute; every mutation of roles, overrides,
 * delegations or module visibility calls `invalidate()`.
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  invalidate(companyUserId?: string): void {
    if (companyUserId) this.cache.delete(companyUserId);
    else this.cache.clear();
  }

  async effectiveFor(companyUserId: string, isSuperadmin = false): Promise<EffectiveAccess> {
    const cached = this.cache.get(companyUserId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = await this.compute(companyUserId, isSuperadmin);
    this.cache.set(companyUserId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  private async compute(companyUserId: string, isSuperadmin: boolean): Promise<EffectiveAccess> {
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
                modules: { include: { module: true } },
              },
            },
          },
        },
      },
    });

    if (!companyUser) return { roles: [], permissions: [], modules: [] };

    const permissionMap = new Map<string, Scope>();
    const moduleSet = new Set<string>();
    const roles: string[] = [];

    for (const userRole of companyUser.roles) {
      const role = userRole.role;
      roles.push(role.key);
      for (const rp of role.permissions) {
        this.mergePermission(permissionMap, rp.permission.code, rp.scope as Scope);
      }
      for (const rm of role.modules) {
        if (rm.isVisible) moduleSet.add(rm.module.key);
      }
    }

    // Per-user permission overrides (grant or revoke), honouring expiry.
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: {
        companyId: companyUser.companyId,
        userId: companyUser.userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { permission: true },
    });
    for (const override of overrides) {
      if (override.granted) {
        this.mergePermission(permissionMap, override.permission.code, override.scope as Scope);
      } else {
        permissionMap.delete(override.permission.code);
      }
    }

    // Temporary delegations received from other users.
    const now = new Date();
    const delegations = await this.prisma.delegation.findMany({
      where: {
        companyId: companyUser.companyId,
        toUserId: companyUser.userId,
        isActive: true,
        deletedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });
    for (const delegation of delegations) {
      for (const code of delegation.permissions) {
        this.mergePermission(permissionMap, code, 'company');
      }
    }

    // Per-user module visibility overrides.
    const userModules = await this.prisma.userModule.findMany({
      where: { companyId: companyUser.companyId, userId: companyUser.userId },
      include: { module: true },
    });
    for (const um of userModules) {
      if (um.isVisible) moduleSet.add(um.module.key);
      else moduleSet.delete(um.module.key);
    }

    // Modules the company has switched off are never visible.
    const companyModules = await this.prisma.companyModule.findMany({
      where: { companyId: companyUser.companyId },
      include: { module: true },
    });
    const enabled = new Set(companyModules.filter((cm) => cm.isEnabled).map((cm) => cm.module.key));
    const modules = [...moduleSet].filter((key) => enabled.has(key));

    if (isSuperadmin) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      for (const p of all) permissionMap.set(p.code, 'company');
      return {
        roles: [...new Set([...roles, 'superadmin'])],
        permissions: [...permissionMap].map(([code, scope]) => ({ code, scope })),
        modules: companyModules.map((cm) => cm.module.key),
      };
    }

    return {
      roles,
      permissions: [...permissionMap].map(([code, scope]) => ({ code, scope })),
      modules,
    };
  }

  /** Keeps the widest scope when the same permission arrives from many roles. */
  private mergePermission(map: Map<string, Scope>, code: string, scope: Scope): void {
    const current = map.get(code);
    if (!current || SCOPE_RANK[scope] > SCOPE_RANK[current]) map.set(code, scope);
  }
}
