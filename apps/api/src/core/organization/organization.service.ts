import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';

export interface OrgChartNode {
  id: string;
  name: string;
  employeeCode: string;
  positionName: string | null;
  departmentName: string | null;
  locationName: string | null;
  photoUrl: string | null;
  directReports: number;
  children: OrgChartNode[];
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /* ------------------------------ locations ----------------------------- */

  async listLocations(ctx: RequestContext, includeInactive = false) {
    return this.prisma.location.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /* ----------------------------- departments ---------------------------- */

  async listDepartments(ctx: RequestContext, includeInactive = false) {
    return this.prisma.department.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Departments as a tree, with the headcount of each node. */
  async departmentTree(ctx: RequestContext) {
    const departments = await this.prisma.department.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });

    type Node = {
      id: string;
      name: string;
      code: string | null;
      managerId: string | null;
      headcount: number;
      children: Node[];
    };
    const byId = new Map<string, Node>();
    for (const d of departments) {
      byId.set(d.id, {
        id: d.id,
        name: d.name,
        code: d.code,
        managerId: d.managerId,
        headcount: d._count.employees,
        children: [],
      });
    }
    const roots: Node[] = [];
    for (const d of departments) {
      const node = byId.get(d.id)!;
      if (d.parentId && byId.has(d.parentId)) byId.get(d.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  /** Rebuilds the materialised `path` column after a hierarchy change. */
  async refreshDepartmentPaths(companyId: string): Promise<void> {
    const departments = await this.prisma.department.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
    });
    const byId = new Map(departments.map((d) => [d.id, d]));
    for (const department of departments) {
      const parts: string[] = [];
      let current: (typeof departments)[number] | undefined = department;
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        parts.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      await this.prisma.department.update({
        where: { id: department.id },
        data: { path: parts.join(' / ').slice(0, 500) },
      });
    }
  }

  /** Prevents cycles when reparenting a department. */
  async assertNoDepartmentCycle(
    companyId: string,
    id: string,
    parentId: string | null | undefined,
  ) {
    if (!parentId) return;
    if (parentId === id) throw BusinessException.validation('Un area no puede ser su propio padre');
    const departments = await this.prisma.department.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byId = new Map(departments.map((d) => [d.id, d.parentId]));
    let cursor: string | null | undefined = parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === id)
        throw BusinessException.validation('La jerarquia de areas quedaria ciclica');
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = byId.get(cursor) ?? null;
    }
  }

  /* ------------------------------ positions ----------------------------- */

  async listPositions(ctx: RequestContext, includeInactive = false) {
    const positions = await this.prisma.position.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
    const canSeeSalary = ctx.permissions.some((p) => p.code === 'people.sensitive.read');
    return positions.map((p) => ({
      ...p,
      salaryRangeMin: canSeeSalary ? this.encryption.decryptNumber(p.salaryRangeMin) : null,
      salaryRangeMax: canSeeSalary ? this.encryption.decryptNumber(p.salaryRangeMax) : null,
    }));
  }

  /* ------------------------------ org chart ----------------------------- */

  /** Hierarchy of managers, starting from `rootId` or from the top. */
  async orgChart(ctx: RequestContext, rootId?: string): Promise<OrgChartNode[]> {
    const employees = await this.prisma.employee.findMany({
      where: { companyId: ctx.companyId, deletedAt: null, status: { in: ['active', 'on_leave'] } },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        managerId: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const nodes = new Map<string, OrgChartNode>();
    for (const e of employees) {
      nodes.set(e.id, {
        id: e.id,
        name: e.fullName,
        employeeCode: e.employeeCode,
        positionName: e.position?.name ?? null,
        departmentName: e.department?.name ?? null,
        locationName: e.location?.name ?? null,
        photoUrl: null,
        directReports: 0,
        children: [],
      });
    }

    const roots: OrgChartNode[] = [];
    for (const e of employees) {
      const node = nodes.get(e.id)!;
      const parent = e.managerId ? nodes.get(e.managerId) : undefined;
      if (parent) {
        parent.children.push(node);
        parent.directReports += 1;
      } else {
        roots.push(node);
      }
    }

    if (rootId) {
      const node = nodes.get(rootId);
      return node ? [node] : [];
    }
    return roots;
  }

  /** Flat employee directory with the visibility flag applied. */
  async directory(
    ctx: RequestContext,
    params: {
      search?: string;
      departmentId?: string;
      locationId?: string;
      page: number;
      limit: number;
    },
  ) {
    const where: Prisma.EmployeeWhereInput = {
      companyId: ctx.companyId,
      deletedAt: null,
      directoryVisible: true,
      status: { in: ['active', 'on_leave'] },
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.locationId ? { locationId: params.locationId } : {}),
      ...(params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' as const } },
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { position: { name: { contains: params.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          extension: true,
          photoFileId: true,
          position: { select: { name: true } },
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { rows, total };
  }
}
