import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MODULES, surveyResponseSchema, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged, softDelete } from '../../common/utils/crud';
import { SurveysService } from './surveys.service';

const fieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_]+$/),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'date',
    'select',
    'multiselect',
    'radio',
    'checkbox',
    'likert',
    'nps',
    'matrix',
    'ranking',
    'rating',
    'section',
    'boolean',
  ]),
  label: z.string().min(1).max(1000),
  description: z.string().max(1000).optional(),
  required: z.boolean().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string(), score: z.number().optional() }))
    .optional(),
  rows: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  scaleLabels: z.array(z.string()).optional(),
  dimension: z.string().max(80).optional(),
  conditions: z
    .array(
      z.object({
        fieldKey: z.string(),
        operator: z.enum(['eq', 'neq', 'in', 'gt', 'lt', 'answered']),
        value: z.any().optional(),
      }),
    )
    .optional(),
});

const surveySchema = z.object({
  title: z.string().trim().min(2).max(260),
  description: z.string().max(4000).nullable().optional(),
  kind: z
    .enum(['climate', 'enps', 'pulse', 'onboarding', 'exit', 'course', 'custom'])
    .default('climate'),
  isAnonymous: z.boolean().default(true),
  minSegmentResponses: z.number().int().min(1).max(100).default(5),
  opensAt: z.string().nullable().optional(),
  closesAt: z.string().nullable().optional(),
  recurrence: z.string().max(40).nullable().optional(),
  reminderDays: z.array(z.number().int().min(1).max(60)).default([]),
  schema: z.object({
    title: z.string().min(1).max(260),
    description: z.string().max(2000).optional(),
    fields: z.array(fieldSchema).min(1),
  }),
  audiences: z
    .array(
      z.object({
        targetType: z.enum(['all', 'location', 'department', 'position']),
        targetId: uuid.nullable().optional(),
        filters: z.record(z.unknown()).default({}),
      }),
    )
    .default([{ targetType: 'all', filters: {} }]),
});

@ApiTags('encuestas y clima')
@Controller({ path: 'surveys', version: '1' })
@RequireModule(MODULES.SURVEYS)
export class SurveysController {
  constructor(
    private readonly surveys: SurveysService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission('surveys.survey.read')
  @ApiOperation({ summary: 'Encuestas configuradas' })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string; kind?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).survey, query, {
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      },
      include: { _count: { select: { invitations: true, responses: true } } },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'title', 'closesAt'],
    });
  }

  @Get('mine')
  @RequirePermission('surveys.response.submit')
  @ApiOperation({ summary: 'Encuestas pendientes del colaborador' })
  async mine(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    const invitations = await this.prisma.surveyInvitation.findMany({
      where: {
        companyId: ctx.companyId,
        employeeId: ctx.employeeId,
        respondedAt: null,
        survey: { status: 'open', deletedAt: null },
      },
      include: {
        survey: {
          select: {
            id: true,
            title: true,
            description: true,
            kind: true,
            closesAt: true,
            isAnonymous: true,
          },
        },
      },
    });
    return invitations.map((invitation) => ({
      invitationId: invitation.id,
      token: invitation.token,
      ...invitation.survey,
    }));
  }

  @Get(':id')
  @RequirePermission('surveys.survey.read')
  @ApiOperation({ summary: 'Detalle de una encuesta con su esquema vigente' })
  async findOne(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).survey.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        audiences: true,
        _count: { select: { invitations: true, responses: true } },
      },
    });
  }

  @Post()
  @RequirePermission('surveys.survey.create')
  @Audit({ entityType: 'survey' })
  @ApiOperation({ summary: 'Crea una encuesta con su constructor de preguntas' })
  async create(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(surveySchema)) dto: z.infer<typeof surveySchema>,
  ) {
    return this.surveys.createSurvey(ctx, dto);
  }

  @Post(':id/publish')
  @RequirePermission('surveys.survey.publish')
  @Audit({ entityType: 'survey', action: 'publish' })
  @ApiOperation({ summary: 'Publica la encuesta y genera las invitaciones' })
  async publish(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.surveys.publish(ctx, id);
  }

  @Post(':id/close')
  @RequirePermission('surveys.survey.publish')
  @Audit({ entityType: 'survey', action: 'update' })
  @ApiOperation({ summary: 'Cierra la encuesta' })
  async close(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).survey.update({
      where: { id },
      data: { status: 'closed', closesAt: new Date() },
    });
  }

  @Post(':id/responses')
  @RequirePermission('surveys.response.submit')
  @ApiOperation({ summary: 'Envia la respuesta del colaborador' })
  async respond(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(surveyResponseSchema)) dto: z.infer<typeof surveyResponseSchema>,
  ) {
    return this.surveys.submitResponse(ctx, id, dto.answers, dto.invitationToken);
  }

  @Get(':id/results')
  @RequirePermission('surveys.result.read')
  @ApiOperation({ summary: 'Resultados agregados con umbral de anonimato' })
  async results(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Query('segmentBy') segmentBy?: string,
  ) {
    return this.surveys.results(ctx, id, segmentBy);
  }

  @Get(':id/text-analysis')
  @RequirePermission('surveys.result.read')
  @ApiOperation({ summary: 'Nube de palabras de las respuestas abiertas' })
  async textAnalysis(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Query('questionKey') questionKey: string,
  ) {
    return this.surveys.textAnalysis(ctx, id, questionKey);
  }

  @Delete(':id')
  @RequirePermission('surveys.survey.delete')
  @Audit({ entityType: 'survey', action: 'delete' })
  @ApiOperation({ summary: 'Archiva una encuesta' })
  async remove(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).survey, id, ctx.userId);
  }

  @Get('templates/all')
  @RequirePermission('surveys.survey.read')
  @ApiOperation({ summary: 'Plantillas de encuesta disponibles' })
  async templates(@Ctx() ctx: RequestContext) {
    return this.prisma.surveyTemplate.findMany({
      where: { OR: [{ companyId: ctx.companyId }, { companyId: null }] },
      orderBy: { name: 'asc' },
    });
  }
}
