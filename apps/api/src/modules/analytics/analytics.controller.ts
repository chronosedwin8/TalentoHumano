import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MODULES, uuid, type AnalyticsFilters } from '@talento/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged, softDelete } from '../../common/utils/crud';
import { AnalyticsService, DATASETS } from './analytics.service';

const reportSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().max(1000).nullable().optional(),
  dataset: z.string().min(2).max(60),
  columns: z.array(z.string().max(60)).default([]),
  filters: z.record(z.unknown()).default({}),
  groupBy: z.array(z.string().max(60)).default([]),
  chartType: z.enum(['table', 'bar', 'line', 'pie', 'area']).default('table'),
  isShared: z.boolean().default(false),
});

@ApiTags('analitica')
@Controller({ path: 'analytics', version: '1' })
@RequireModule(MODULES.ANALYTICS)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('executive')
  @RequirePermission('analytics.dashboard.read')
  @ApiOperation({ summary: 'Tablero ejecutivo con KPIs, demografia y series' })
  async executive(@Ctx() ctx: RequestContext, @Query() query: AnalyticsFilters) {
    return this.analytics.executiveDashboard(ctx, query);
  }

  @Get('team')
  @RequirePermission('dashboard.team.read')
  @ApiOperation({ summary: 'Tablero del jefe con su equipo' })
  async team(@Ctx() ctx: RequestContext) {
    return this.analytics.teamDashboard(ctx);
  }

  @Get('headcount-series')
  @RequirePermission('analytics.dashboard.read')
  @ApiOperation({ summary: 'Serie historica de headcount' })
  async headcountSeries(@Ctx() ctx: RequestContext, @Query('months') months = '12') {
    return this.analytics.headcountSeries(ctx.companyId, Number(months));
  }

  @Post('snapshots/run')
  @RequirePermission('analytics.dashboard.read')
  @Audit({ entityType: 'hr_snapshot', summary: 'Snapshot diario de analitica' })
  @ApiOperation({ summary: 'Ejecuta el snapshot diario de indicadores' })
  async snapshot(@Ctx() ctx: RequestContext) {
    return this.analytics.takeSnapshot(ctx.companyId);
  }

  /* -------------------------------- alerts ------------------------------ */

  @Get('alerts')
  @RequirePermission('analytics.alert.read')
  @ApiOperation({ summary: 'Alertas activas (vencimientos, riesgos, saldos)' })
  async alerts(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; kind?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).analyticsAlert, query, {
      where: { isResolved: false, ...(query.kind ? { kind: query.kind } : {}) },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'severity', 'dueDate'],
    });
  }

  @Post('alerts/run')
  @RequirePermission('analytics.alert.manage')
  @ApiOperation({ summary: 'Recalcula alertas de vencimiento y riesgo de rotacion' })
  async runAlerts(@Ctx() ctx: RequestContext) {
    const [expiry, risk] = await Promise.all([
      this.analytics.computeExpiryAlerts(ctx.companyId),
      this.analytics.computeTurnoverRisk(ctx.companyId),
    ]);
    return { expiryAlerts: expiry.created, turnoverRisks: risk.length };
  }

  @Get('turnover-risk')
  @RequirePermission('analytics.alert.read')
  @ApiOperation({ summary: 'Riesgo de rotacion por colaborador (heuristica)' })
  async turnoverRisk(@Ctx() ctx: RequestContext) {
    return this.analytics.computeTurnoverRisk(ctx.companyId);
  }

  @Post('alerts/:id/resolve')
  @RequirePermission('analytics.alert.manage')
  @Audit({ entityType: 'analytics_alert', action: 'update' })
  @ApiOperation({ summary: 'Marca una alerta como resuelta' })
  async resolveAlert(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).analyticsAlert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  }

  /* --------------------------- report builder --------------------------- */

  @Get('datasets')
  @RequirePermission('analytics.report.read')
  @ApiOperation({ summary: 'Catalogo de datasets seguros del constructor' })
  async datasets() {
    return Object.entries(DATASETS).map(([key, value]) => ({
      key,
      label: value.label,
      columns: value.columns,
    }));
  }

  @Get('reports')
  @RequirePermission('analytics.report.read')
  @ApiOperation({ summary: 'Reportes guardados' })
  async reports(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).reportDefinition, query, {
      where: {
        deletedAt: null,
        OR: [{ createdById: ctx.userId }, { isShared: true }],
      },
      defaultSort: { createdAt: 'desc' },
      sortable: ['name', 'createdAt'],
    });
  }

  @Post('reports')
  @RequirePermission('analytics.report.create')
  @Audit({ entityType: 'report_definition' })
  @ApiOperation({ summary: 'Guarda una definicion de reporte' })
  async createReport(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(reportSchema)) dto: z.infer<typeof reportSchema>,
  ) {
    if (!DATASETS[dto.dataset]) throw BusinessException.validation('Dataset no valido');
    return this.prisma.forCompany(ctx.companyId).reportDefinition.create({
      data: { ...dto, filters: dto.filters as object, createdById: ctx.userId },
    });
  }

  @Post('reports/run')
  @RequirePermission('analytics.report.run')
  @ApiOperation({ summary: 'Ejecuta un reporte ad hoc' })
  async runAdHoc(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          dataset: z.string().min(2).max(60),
          columns: z.array(z.string().max(60)).default([]),
          filters: z.record(z.unknown()).default({}),
          groupBy: z.array(z.string().max(60)).default([]),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.analytics.runReport(ctx, dto as never);
  }

  @Get('reports/:id/run')
  @RequirePermission('analytics.report.run')
  @ApiOperation({ summary: 'Ejecuta un reporte guardado' })
  async runSaved(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const definition = await this.prisma.reportDefinition.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!definition) throw BusinessException.notFound('Reporte');
    const result = await this.analytics.runReport(ctx, {
      dataset: definition.dataset,
      columns: definition.columns,
      filters: definition.filters as Record<string, unknown>,
      groupBy: definition.groupBy,
    });
    await this.prisma.reportRun.create({
      data: {
        companyId: ctx.companyId,
        definitionId: definition.id,
        status: 'success',
        rowCount: result.rows.length,
        startedAt: new Date(),
        finishedAt: new Date(),
        createdById: ctx.userId,
      },
    });
    return result;
  }

  @Get('reports/:id/export')
  @RequirePermission('analytics.export.execute')
  @Audit({ entityType: 'report_definition', action: 'export' })
  @ApiOperation({ summary: 'Exporta un reporte a CSV' })
  async exportReport(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const definition = await this.prisma.reportDefinition.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
    });
    if (!definition) throw BusinessException.notFound('Reporte');
    const result = await this.analytics.runReport(ctx, {
      dataset: definition.dataset,
      columns: definition.columns,
      filters: definition.filters as Record<string, unknown>,
      groupBy: definition.groupBy,
    });
    const csv = [
      result.columns.join(';'),
      ...result.rows.map((row) =>
        result.columns.map((column) => String(row[column] ?? '').replace(/;/g, ',')).join(';'),
      ),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${definition.name}.csv"`);
    return `﻿${csv}`;
  }

  @Delete('reports/:id')
  @RequirePermission('analytics.report.delete')
  @Audit({ entityType: 'report_definition', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un reporte guardado' })
  async removeReport(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).reportDefinition, id, ctx.userId);
  }

  @Post('reports/:id/schedule')
  @RequirePermission('analytics.schedule.manage')
  @Audit({ entityType: 'report_schedule' })
  @ApiOperation({ summary: 'Programa el envio periodico de un reporte' })
  async schedule(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          cron: z.string().min(9).max(80),
          format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
          recipients: z.array(z.string().email()).min(1),
          isActive: z.boolean().default(true),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).reportSchedule.create({
      data: { definitionId: id, ...dto } as never,
    });
  }
}
