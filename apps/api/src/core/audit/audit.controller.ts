import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditAction } from '@prisma/client';
import { MODULES } from '@talento/shared';
import { Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import type { RequestContext } from '../../common/types/request-context';
import { paged, parsePage } from '../../common/utils/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from './audit.service';

@ApiTags('auditoria')
@Controller({ path: 'audit', version: '1' })
@RequireModule(MODULES.SETTINGS)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('logs')
  @RequirePermission('settings.audit.read')
  @ApiOperation({ summary: 'Bitacora de auditoria con filtros' })
  async logs(
    @Ctx() ctx: RequestContext,
    @Query()
    query: {
      page?: string;
      limit?: string;
      entityType?: string;
      entityId?: string;
      actorId?: string;
      action?: AuditAction;
      from?: string;
      to?: string;
    },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.audit.list(ctx.companyId, {
      page,
      limit,
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return paged(rows, total, page, limit);
  }

  @Get('sensitive-access')
  @RequirePermission('settings.audit.read')
  @ApiOperation({ summary: 'Registro de accesos a datos sensibles' })
  async sensitive(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; entityType?: string },
  ) {
    const { page, limit, skip, take } = parsePage(query);
    const where = {
      companyId: ctx.companyId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.sensitiveAccessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.sensitiveAccessLog.count({ where }),
    ]);
    return paged(rows, total, page, limit);
  }

  @Get('entity-types')
  @RequirePermission('settings.audit.read')
  @ApiOperation({ summary: 'Tipos de entidad presentes en la auditoria' })
  async entityTypes(@Ctx() ctx: RequestContext) {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['entityType'],
      where: { companyId: ctx.companyId },
      _count: { _all: true },
      orderBy: { _count: { entityType: 'desc' } },
      take: 100,
    });
    return rows.map((r) => ({ entityType: r.entityType, count: r._count._all }));
  }
}
