import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { blockDocumentSchema, isoDate, MODULES, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, Public, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { DocumentsService } from './documents.service';

const templateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(60),
  kind: z.enum(['letter', 'certificate', 'act', 'contract', 'memo']).default('letter'),
  description: z.string().max(500).nullable().optional(),
  blocks: blockDocumentSchema.optional(),
  bodyHtml: z.string().max(200000).nullable().optional(),
  variables: z.array(z.string().max(80)).default([]),
  isSelfService: z.boolean().default(false),
  requiresSignature: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const policySchema = z.object({
  title: z.string().trim().min(2).max(260),
  code: z.string().trim().min(2).max(60),
  category: z.string().max(80).nullable().optional(),
  summary: z.string().max(1000).nullable().optional(),
  requiresAck: z.boolean().default(true),
  requiresSignature: z.boolean().default(false),
  blocks: blockDocumentSchema,
  effectiveFrom: isoDate.nullable().optional(),
  changeNote: z.string().max(500).nullable().optional(),
});

@ApiTags('documentos y politicas')
@Controller({ path: 'documents', version: '1' })
@RequireModule(MODULES.DOCUMENTS)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  /* ------------------------------ templates ----------------------------- */

  @Get('templates')
  @RequirePermission('documents.template.read')
  @ApiOperation({ summary: 'Plantillas de documentos' })
  async templates(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).documentTemplate, query, {
      where: { deletedAt: null },
      defaultSort: { name: 'asc' },
      sortable: ['name', 'createdAt'],
    });
  }

  @Get('templates/variables')
  @RequirePermission('documents.template.read')
  @ApiOperation({ summary: 'Variables disponibles para las plantillas' })
  async variables(@Ctx() ctx: RequestContext) {
    const context = await this.documents.templateContext(ctx.companyId, ctx.employeeId);
    const flatten = (object: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(object).flatMap(([key, value]) =>
        value && typeof value === 'object'
          ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    return flatten(context as Record<string, unknown>).map((path) => ({
      variable: `{{${path}}}`,
      path,
    }));
  }

  @Post('templates')
  @RequirePermission('documents.template.create')
  @Audit({ entityType: 'document_template' })
  @ApiOperation({ summary: 'Crea una plantilla de documento' })
  async createTemplate(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(templateSchema)) dto: z.infer<typeof templateSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).documentTemplate.create({
      data: {
        ...dto,
        blocks: (dto.blocks ?? { version: 1, blocks: [] }) as object,
        createdById: ctx.userId,
      } as never,
    });
  }

  @Patch('templates/:id')
  @RequirePermission('documents.template.update')
  @Audit({ entityType: 'document_template' })
  @ApiOperation({ summary: 'Actualiza una plantilla' })
  async updateTemplate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(templateSchema.partial())) dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.documentTemplate.updateMany({
      where: { id },
      data: {
        ...defined(dto),
        ...(dto.blocks ? { blocks: dto.blocks as object } : {}),
      } as never,
    });
    return db.documentTemplate.findFirst({ where: { id } });
  }

  @Delete('templates/:id')
  @RequirePermission('documents.template.delete')
  @Audit({ entityType: 'document_template', action: 'delete' })
  @ApiOperation({ summary: 'Elimina una plantilla' })
  async removeTemplate(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).documentTemplate, id, ctx.userId);
  }

  /* -------------------------- generated documents ----------------------- */

  @Post('generate')
  @RequirePermission('documents.generated.create')
  @Audit({ entityType: 'generated_document' })
  @ApiOperation({ summary: 'Genera un documento a partir de una plantilla' })
  async generate(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          templateId: uuid,
          employeeId: uuid.nullable().optional(),
          extraVariables: z.record(z.unknown()).optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.documents.generate(ctx, dto as never);
  }

  @Post('generate/bulk')
  @RequirePermission('documents.generated.create')
  @Audit({ entityType: 'generated_document', summary: 'Generacion masiva de documentos' })
  @ApiOperation({ summary: 'Genera un documento para varios colaboradores' })
  async generateBulk(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(z.object({ templateId: uuid, employeeIds: z.array(uuid).min(1).max(500) })))
    dto: { templateId: string; employeeIds: string[] },
  ) {
    const results = [];
    for (const employeeId of dto.employeeIds) {
      const document = await this.documents.generate(ctx, {
        templateId: dto.templateId,
        employeeId,
      });
      results.push({ employeeId, documentId: document.id, code: document.verificationCode });
    }
    return { generated: results.length, documents: results };
  }

  @Post('self-service/certificate')
  @RequirePermission('documents.certificate.create')
  @Audit({ entityType: 'generated_document', summary: 'Certificado laboral de autoservicio' })
  @ApiOperation({ summary: 'El colaborador genera su certificado laboral' })
  async selfServiceCertificate(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(z.object({ templateId: uuid.optional() })))
    dto: { templateId?: string },
  ) {
    if (!ctx.employeeId) throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    const template = dto.templateId
      ? await this.prisma.documentTemplate.findFirst({
          where: { id: dto.templateId, companyId: ctx.companyId, isSelfService: true, deletedAt: null },
        })
      : await this.prisma.documentTemplate.findFirst({
          where: { companyId: ctx.companyId, isSelfService: true, kind: 'certificate', deletedAt: null },
        });
    if (!template) {
      throw BusinessException.notFound('Plantilla de certificado habilitada para autoservicio');
    }
    return this.documents.generate(ctx, {
      templateId: template.id,
      employeeId: ctx.employeeId,
      isSelfService: true,
    });
  }

  @Get('generated')
  @RequirePermission('documents.generated.read')
  @ApiOperation({ summary: 'Documentos generados' })
  async generated(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).generatedDocument, query, {
      where: { ...(query.employeeId ? { employeeId: query.employeeId } : {}) },
      select: {
        id: true,
        title: true,
        verificationCode: true,
        employeeId: true,
        isSelfService: true,
        createdAt: true,
      },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Get('generated/:id')
  @RequirePermission('documents.generated.read')
  @ApiOperation({ summary: 'Contenido HTML listo para imprimir o convertir a PDF' })
  async generatedOne(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!document) throw BusinessException.notFound('Documento');
    return document;
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verificacion publica de un documento por su codigo QR' })
  async verify(@Param('code') code: string) {
    return this.documents.verify(code);
  }

  /* ------------------------------- policies ----------------------------- */

  @Get('policies')
  @RequirePermission('documents.policy.read')
  @ApiOperation({ summary: 'Politicas y reglamentos' })
  async policies(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).policy, query, {
      where: { deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        _count: { select: { acknowledgements: true } },
      },
      defaultSort: { createdAt: 'desc' },
      sortable: ['title', 'createdAt'],
    });
  }

  @Post('policies')
  @RequirePermission('documents.policy.create')
  @Audit({ entityType: 'policy' })
  @ApiOperation({ summary: 'Crea una politica con su primera version' })
  async createPolicy(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(policySchema)) dto: z.infer<typeof policySchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const policy = await db.policy.create({
      data: {
        title: dto.title,
        code: dto.code,
        category: dto.category ?? null,
        summary: dto.summary ?? null,
        requiresAck: dto.requiresAck,
        requiresSignature: dto.requiresSignature,
        createdById: ctx.userId,
      },
    });
    const version = await db.policyVersion.create({
      data: {
        policyId: policy.id,
        version: 1,
        blocks: dto.blocks as object,
        changeNote: dto.changeNote ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        createdById: ctx.userId,
      },
    });
    return { policy, version };
  }

  @Post('policies/:id/versions')
  @RequirePermission('documents.policy.update')
  @Audit({ entityType: 'policy_version' })
  @ApiOperation({ summary: 'Crea una nueva version de la politica' })
  async newPolicyVersion(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          blocks: blockDocumentSchema,
          changeNote: z.string().max(500).nullable().optional(),
          effectiveFrom: isoDate.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const last = await db.policyVersion.findFirst({
      where: { policyId: id },
      orderBy: { version: 'desc' },
    });
    const version = await db.policyVersion.create({
      data: {
        policyId: id,
        version: (last?.version ?? 0) + 1,
        blocks: dto.blocks as object,
        changeNote: dto.changeNote ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        createdById: ctx.userId,
      },
    });
    await db.policy.update({
      where: { id },
      data: { currentVersion: version.version },
    });
    return version;
  }

  @Post('policies/:id/publish')
  @RequirePermission('documents.policy.publish')
  @Audit({ entityType: 'policy', action: 'publish' })
  @ApiOperation({ summary: 'Publica la politica y solicita el acuse de lectura' })
  async publishPolicy(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ versionId: uuid }))) dto: { versionId: string },
  ) {
    return this.documents.publishPolicy(ctx, id, dto.versionId);
  }

  @Get('policies/mine')
  @RequirePermission('documents.policy.read')
  @ApiOperation({ summary: 'Politicas pendientes de acuse del colaborador' })
  async myPolicies(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.policyAcknowledgement.findMany({
      where: { companyId: ctx.companyId, employeeId: ctx.employeeId },
      include: {
        policy: { select: { id: true, title: true, summary: true, requiresSignature: true } },
        version: { select: { id: true, version: true, blocks: true, effectiveFrom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('policies/versions/:versionId/acknowledge')
  @RequirePermission('documents.policy.read')
  @Audit({ entityType: 'policy_acknowledgement' })
  @ApiOperation({ summary: 'Registra el acuse de lectura y la firma simple' })
  async acknowledge(
    @Ctx() ctx: RequestContext,
    @Param('versionId', new ZodValidationPipe(uuid)) versionId: string,
    @Body(new ZodValidationPipe(z.object({ sign: z.boolean().default(false) })))
    dto: { sign: boolean },
  ) {
    return this.documents.acknowledgePolicy(ctx, versionId, dto.sign);
  }

  @Get('policies/:id/acknowledgements')
  @RequirePermission('documents.acknowledgement.read')
  @ApiOperation({ summary: 'Reporte de acuses de una politica' })
  async acknowledgements(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Query() query: { page?: string; limit?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).policyAcknowledgement, query, {
      where: { policyId: id },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      defaultSort: { createdAt: 'desc' },
    });
  }

  /* ------------------------------ signatures ---------------------------- */

  @Get('signatures')
  @RequirePermission('documents.signature.read')
  @ApiOperation({ summary: 'Solicitudes de firma' })
  async signatures(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).signatureRequest, query, {
      include: { signatures: true },
      defaultSort: { createdAt: 'desc' },
    });
  }
}
