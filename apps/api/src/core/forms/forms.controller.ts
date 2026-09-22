import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged } from '../../common/utils/crud';

const fieldSchema: z.ZodType<any> = z.object({
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
    'file',
    'rating',
    'section',
    'employee',
    'boolean',
  ]),
  label: z.string().min(1).max(1000),
  description: z.string().max(1000).optional(),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string(), score: z.number().optional() })).optional(),
  rows: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  scaleLabels: z.array(z.string()).optional(),
  conditions: z
    .array(
      z.object({
        fieldKey: z.string(),
        operator: z.enum(['eq', 'neq', 'in', 'gt', 'lt', 'answered']),
        value: z.any().optional(),
      }),
    )
    .optional(),
  dimension: z.string().max(80).optional(),
  weight: z.number().optional(),
});

const formSchemaShape = z.object({
  title: z.string().min(1).max(260),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema),
});

const upsertFormSchema = z.object({
  key: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(200),
  purpose: z.enum(['survey', 'review', 'checklist', 'application', 'inspection', 'exit', 'generic']),
  description: z.string().max(500).nullable().optional(),
  schema: formSchemaShape,
  publish: z.boolean().default(true),
});

const submissionSchema = z.object({
  entityType: z.string().max(80).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  answers: z.record(z.unknown()),
});

/** Dynamic form engine shared by surveys, reviews, checklists and inspections. */
@ApiTags('formularios')
@Controller({ path: 'forms', version: '1' })
export class FormsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('settings.form.manage')
  @ApiOperation({ summary: 'Formularios dinamicos configurados' })
  async list(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string; purpose?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).dynamicForm, query, {
      where: { deletedAt: null, ...(query.purpose ? { purpose: query.purpose } : {}) },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      sortable: ['name', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }

  @Get(':key')
  @ApiOperation({ summary: 'Version publicada de un formulario' })
  async findByKey(@Ctx() ctx: RequestContext, @Param('key') key: string) {
    const form = await this.prisma.forCompany(ctx.companyId).dynamicForm.findFirst({
      where: { key, deletedAt: null },
      include: { versions: { where: { isPublished: true }, orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!form) throw BusinessException.notFound('Formulario');
    return { ...form, currentVersion: form.versions[0] ?? null };
  }

  @Post()
  @RequirePermission('settings.form.manage')
  @Audit({ entityType: 'form' })
  @ApiOperation({ summary: 'Crea o publica una nueva version de un formulario' })
  async upsert(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(upsertFormSchema)) dto: z.infer<typeof upsertFormSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const form = await db.dynamicForm.upsert({
      where: { companyId_key: { companyId: ctx.companyId, key: dto.key } },
      create: {
        key: dto.key,
        name: dto.name,
        purpose: dto.purpose,
        description: dto.description ?? null,
        createdById: ctx.userId,
      },
      update: { name: dto.name, purpose: dto.purpose, description: dto.description ?? null, deletedAt: null },
    });

    const last = await db.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { version: 'desc' },
    });
    const version = await db.formVersion.create({
      data: {
        formId: form.id,
        version: (last?.version ?? 0) + 1,
        schema: dto.schema as object,
        isPublished: dto.publish,
        publishedAt: dto.publish ? new Date() : null,
        createdById: ctx.userId,
      },
    });

    if (dto.publish) {
      await db.formVersion.updateMany({
        where: { formId: form.id, id: { not: version.id } },
        data: { isPublished: false },
      });
    }

    return { form, version };
  }

  @Post(':key/submissions')
  @ApiOperation({ summary: 'Guarda una respuesta del formulario' })
  async submit(
    @Ctx() ctx: RequestContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(submissionSchema)) dto: z.infer<typeof submissionSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const form = await db.dynamicForm.findFirst({
      where: { key, deletedAt: null },
      include: { versions: { where: { isPublished: true }, orderBy: { version: 'desc' }, take: 1 } },
    });
    const version = form?.versions[0];
    if (!version) throw BusinessException.notFound('Version publicada del formulario');

    return db.formSubmission.create({
      data: {
        formVersionId: version.id,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        submittedById: ctx.userId,
        answers: dto.answers as object,
      },
    });
  }

  @Get(':key/submissions')
  @RequirePermission('settings.form.manage')
  @ApiOperation({ summary: 'Respuestas recibidas de un formulario' })
  async submissions(
    @Ctx() ctx: RequestContext,
    @Param('key') key: string,
    @Query() query: { page?: string; limit?: string; entityId?: string },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const form = await db.dynamicForm.findFirst({ where: { key }, include: { versions: true } });
    if (!form) throw BusinessException.notFound('Formulario');
    return listPaged(db.formSubmission, query, {
      where: {
        formVersionId: { in: form.versions.map((v) => v.id) },
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      defaultSort: { createdAt: 'desc' },
    });
  }
}
