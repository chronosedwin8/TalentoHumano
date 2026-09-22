import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MODULES, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission, SensitiveAccess } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { paged, parsePage } from '../../common/utils/pagination';
import { EthicsService } from './ethics.service';

const openCaseSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  leadUserId: uuid.nullable().optional(),
  excludedUserIds: z.array(uuid).default([]),
  investigationPlan: z.string().max(20000).nullable().optional(),
});

const closeCaseSchema = z.object({
  conclusions: z.string().trim().min(10).max(20000),
  measures: z.string().max(20000).nullable().optional(),
  dismissed: z.boolean().default(false),
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().max(1000).nullable().optional(),
  slaDays: z.number().int().min(1).max(365).default(15),
  defaultSeverity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

@ApiTags('canal de denuncias')
@Controller({ path: 'ethics', version: '1' })
@RequireModule(MODULES.ETHICS)
export class EthicsController {
  constructor(
    private readonly ethics: EthicsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('reports')
  @RequirePermission('ethics.report.read')
  @SensitiveAccess('ethics_report')
  @ApiOperation({ summary: 'Denuncias recibidas (acceso restringido y trazado)' })
  async reports(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total } = await this.ethics.listReports(ctx, { page, limit, status: query.status });
    return paged(rows, total, page, limit);
  }

  @Get('reports/:id')
  @RequirePermission('ethics.report.read')
  @SensitiveAccess('ethics_report')
  @ApiOperation({ summary: 'Detalle de una denuncia y su caso' })
  async report(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.ethics.readReport(ctx, id);
  }

  @Post('reports/:id/case')
  @RequirePermission('ethics.case.create')
  @Audit({ entityType: 'ethics_case' })
  @ApiOperation({ summary: 'Abre el caso de investigacion' })
  async openCase(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(openCaseSchema)) dto: z.infer<typeof openCaseSchema>,
  ) {
    return this.ethics.openCase(ctx, id, dto);
  }

  @Post('reports/:id/reply')
  @RequirePermission('ethics.case.update')
  @Audit({ entityType: 'ethics_report_message' })
  @ApiOperation({ summary: 'Responde al denunciante por el buzon anonimo' })
  async reply(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ message: z.string().trim().min(2).max(8000) })))
    dto: { message: string },
  ) {
    return this.ethics.replyToReporter(ctx, id, dto.message);
  }

  @Post('cases/:id/actions')
  @RequirePermission('ethics.case.update')
  @Audit({ entityType: 'ethics_case_action' })
  @ApiOperation({ summary: 'Registra una accion del plan de investigacion' })
  async addAction(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          kind: z.string().max(40),
          title: z.string().trim().min(2).max(260),
          detail: z.string().max(20000).nullable().optional(),
          dueDate: z.string().nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.ethicsCaseAction.create({
      data: {
        companyId: ctx.companyId,
        caseId: id,
        kind: dto.kind,
        title: dto.title,
        detail: dto.detail ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        actorUserId: ctx.userId,
      },
    });
  }

  @Post('cases/:id/close')
  @RequirePermission('ethics.case.close')
  @Audit({ entityType: 'ethics_case', action: 'update' })
  @ApiOperation({ summary: 'Cierra el caso con conclusiones y medidas' })
  async closeCase(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(closeCaseSchema)) dto: z.infer<typeof closeCaseSchema>,
  ) {
    return this.ethics.closeCase(ctx, id, dto);
  }

  @Get('statistics')
  @RequirePermission('ethics.stats.read')
  @ApiOperation({ summary: 'Estadisticas agregadas del canal (nunca el detalle)' })
  async statistics(@Ctx() ctx: RequestContext) {
    return this.ethics.statistics(ctx);
  }

  @Get('categories')
  @RequirePermission('ethics.report.read')
  @ApiOperation({ summary: 'Categorias del canal de denuncias' })
  async categories(@Ctx() ctx: RequestContext) {
    return this.prisma.ethicsCategory.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { position: 'asc' },
    });
  }

  @Post('categories')
  @RequirePermission('ethics.category.manage')
  @Audit({ entityType: 'ethics_category' })
  @ApiOperation({ summary: 'Crea una categoria con su plazo legal' })
  async createCategory(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(categorySchema)) dto: z.infer<typeof categorySchema>,
  ) {
    return this.prisma.ethicsCategory.create({ data: { companyId: ctx.companyId, ...dto } });
  }

  @Get('access-log')
  @RequirePermission('ethics.case.read')
  @ApiOperation({ summary: 'Registro de accesos a los casos' })
  async accessLog(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    const { page, limit, skip, take } = parsePage(query);
    const where = { companyId: ctx.companyId };
    const [rows, total] = await Promise.all([
      this.prisma.ethicsAccessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.ethicsAccessLog.count({ where }),
    ]);
    return paged(rows, total, page, limit);
  }
}
