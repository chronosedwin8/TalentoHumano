import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  blockDocumentSchema,
  DOMAIN_EVENTS,
  isoDate,
  MODULES,
  slugify,
  uuid,
} from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { CommunicationService } from './communication.service';

const postSchema = z.object({
  title: z.string().trim().min(2).max(260),
  kind: z.enum(['news', 'announcement', 'event', 'policy']).default('news'),
  blocks: blockDocumentSchema,
  excerpt: z.string().max(500).nullable().optional(),
  coverFileId: uuid.nullable().optional(),
  isPinned: z.boolean().default(false),
  requiresAck: z.boolean().default(false),
  allowComments: z.boolean().default(true),
  allowReactions: z.boolean().default(true),
  surveyId: uuid.nullable().optional(),
  publishAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  audiences: z
    .array(
      z.object({
        targetType: z.enum(['all', 'location', 'department', 'role', 'position']),
        targetId: uuid.nullable().optional(),
      }),
    )
    .default([{ targetType: 'all' }]),
});

const eventSchema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().max(8000).nullable().optional(),
  kind: z.string().max(40).default('general'),
  startsAt: z.string(),
  endsAt: z.string().nullable().optional(),
  locationText: z.string().max(300).nullable().optional(),
  meetingUrl: z.string().max(500).nullable().optional(),
  locationId: uuid.nullable().optional(),
  capacity: z.number().int().min(1).max(10000).nullable().optional(),
  requiresRegistration: z.boolean().default(false),
  coverFileId: uuid.nullable().optional(),
});

const recognitionSchema = z.object({
  toEmployeeId: uuid,
  valueId: uuid.nullable().optional(),
  message: z.string().trim().min(3).max(2000),
  points: z.number().int().min(0).max(1000).default(10),
  isPublic: z.boolean().default(true),
});

const benefitSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.string().max(80).nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  provider: z.string().max(200).nullable().optional(),
  contactInfo: z.string().max(300).nullable().optional(),
  requiresEnrollment: z.boolean().default(false),
  coverFileId: uuid.nullable().optional(),
  validFrom: isoDate.nullable().optional(),
  validTo: isoDate.nullable().optional(),
  isActive: z.boolean().default(true),
});

const wikiSchema = z.object({
  categoryId: uuid.nullable().optional(),
  title: z.string().trim().min(2).max(260),
  summary: z.string().max(1000).nullable().optional(),
  blocks: blockDocumentSchema,
  tags: z.array(z.string().max(40)).default([]),
  publish: z.boolean().default(false),
});

@ApiTags('comunicacion y cultura')
@Controller({ path: 'communication', version: '1' })
@RequireModule(MODULES.COMMUNICATION)
export class CommunicationController {
  constructor(
    private readonly communication: CommunicationService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  /* --------------------------------- feed ------------------------------- */

  @Get('feed')
  @RequirePermission('communication.post.read')
  @ApiOperation({ summary: 'Muro de la empresa filtrado por audiencia' })
  async feed(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return this.communication.feedFor(ctx, query);
  }

  @Get('posts/:id')
  @RequirePermission('communication.post.read')
  @ApiOperation({ summary: 'Detalle de una publicacion' })
  async post(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const post = await this.prisma.forCompany(ctx.companyId).post.findFirst({
      where: { id, deletedAt: null },
      include: {
        audiences: true,
        comments: { where: { deletedAt: null, isHidden: false }, orderBy: { createdAt: 'asc' } },
        reactions: true,
        _count: { select: { reads: true } },
      },
    });
    if (!post) throw BusinessException.notFound('Publicacion');
    await this.communication.markRead(ctx, id, false);
    return post;
  }

  @Post('posts')
  @RequirePermission('communication.post.create')
  @Audit({ entityType: 'post' })
  @ApiOperation({ summary: 'Crea una publicacion (con editor por bloques)' })
  async createPost(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(postSchema)) dto: z.infer<typeof postSchema>,
  ) {
    return this.communication.createPost(ctx, dto);
  }

  @Post('posts/:id/publish')
  @RequirePermission('communication.post.update')
  @Audit({ entityType: 'post', action: 'update' })
  @ApiOperation({ summary: 'Publica la entrada y notifica a la audiencia' })
  async publishPost(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.communication.publishPost(ctx, id);
  }

  @Post('posts/:id/acknowledge')
  @RequirePermission('communication.post.read')
  @ApiOperation({ summary: 'Confirma la lectura obligatoria de un comunicado' })
  async acknowledge(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.communication.markRead(ctx, id, true);
  }

  @Post('posts/:id/reactions')
  @RequirePermission('communication.post.read')
  @ApiOperation({ summary: 'Reacciona a una publicacion' })
  async react(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ emoji: z.string().max(30).default('like') })))
    dto: { emoji: string },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const existing = await db.postReaction.findFirst({
      where: { postId: id, userId: ctx.userId, emoji: dto.emoji },
    });
    if (existing) {
      await db.postReaction.delete({ where: { id: existing.id } });
      return { removed: true };
    }
    await db.postReaction.create({ data: { postId: id, userId: ctx.userId, emoji: dto.emoji } });
    return { added: true };
  }

  @Post('posts/:id/comments')
  @RequirePermission('communication.post.read')
  @ApiOperation({ summary: 'Comenta una publicacion' })
  async comment(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({ body: z.string().trim().min(1).max(4000), parentId: uuid.nullable().optional() }),
      ),
    )
    dto: { body: string; parentId?: string | null },
  ) {
    return this.prisma.forCompany(ctx.companyId).postComment.create({
      data: { postId: id, userId: ctx.userId, body: dto.body, parentId: dto.parentId ?? null },
    });
  }

  @Delete('comments/:id')
  @RequirePermission('communication.post.moderate')
  @Audit({ entityType: 'post_comment', action: 'delete' })
  @ApiOperation({ summary: 'Oculta un comentario (moderacion)' })
  async hideComment(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.prisma.forCompany(ctx.companyId).postComment.updateMany({
      where: { id },
      data: { isHidden: true },
    });
    return { id };
  }

  @Get('posts/:id/read-report')
  @RequirePermission('communication.post.update')
  @ApiOperation({ summary: 'Reporte de lectura y acuses de un comunicado' })
  async readReport(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.communication.readReport(ctx, id);
  }

  /* -------------------------------- events ------------------------------ */

  @Get('events')
  @RequirePermission('communication.event.read')
  @ApiOperation({ summary: 'Calendario de eventos' })
  async events_(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).companyEvent, query, {
      where: { deletedAt: null },
      include: { _count: { select: { registrations: true } } },
      defaultSort: { startsAt: 'asc' },
      sortable: ['startsAt'],
    });
  }

  @Post('events')
  @RequirePermission('communication.event.create')
  @Audit({ entityType: 'company_event' })
  @ApiOperation({ summary: 'Crea un evento' })
  async createEvent(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(eventSchema)) dto: z.infer<typeof eventSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).companyEvent.create({
      data: {
        ...dto,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        createdById: ctx.userId,
      } as never,
    });
  }

  @Post('events/:id/register')
  @RequirePermission('communication.event.read')
  @ApiOperation({ summary: 'Inscribe al colaborador en un evento' })
  async registerEvent(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    if (!ctx.employeeId) throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    return this.prisma.forCompany(ctx.companyId).eventRegistration.upsert({
      where: { eventId_employeeId: { eventId: id, employeeId: ctx.employeeId } },
      create: { eventId: id, employeeId: ctx.employeeId },
      update: { status: 'registered' },
    });
  }

  /* ---------------------------- recognitions ---------------------------- */

  @Get('recognitions')
  @RequirePermission('communication.recognition.read')
  @ApiOperation({ summary: 'Muro de reconocimientos' })
  async recognitions(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).recognition, query, {
      where: {
        deletedAt: null,
        isPublic: true,
        ...(query.employeeId ? { toEmployeeId: query.employeeId } : {}),
      },
      include: {
        from: { select: { id: true, fullName: true } },
        to: { select: { id: true, fullName: true } },
        value: { select: { id: true, name: true, color: true, icon: true } },
      },
      defaultSort: { createdAt: 'desc' },
    });
  }

  @Post('recognitions')
  @RequirePermission('communication.recognition.create')
  @Audit({ entityType: 'recognition' })
  @ApiOperation({ summary: 'Reconoce a un colaborador asociandolo a un valor' })
  async recognize(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(recognitionSchema)) dto: z.infer<typeof recognitionSchema>,
  ) {
    if (dto.toEmployeeId === ctx.employeeId) {
      throw BusinessException.validation('No puede reconocerse a si mismo');
    }
    const recognition = await this.prisma.forCompany(ctx.companyId).recognition.create({
      data: {
        fromEmployeeId: ctx.employeeId,
        toEmployeeId: dto.toEmployeeId,
        valueId: dto.valueId ?? null,
        message: dto.message,
        points: dto.points,
        isPublic: dto.isPublic,
      },
    });
    const target = await this.prisma.employee.findFirst({
      where: { id: dto.toEmployeeId },
      select: { userId: true },
    });
    if (target?.userId) {
      await this.notifications.notify({
        companyId: ctx.companyId,
        userIds: [target.userId],
        eventKey: DOMAIN_EVENTS.RECOGNITION_GIVEN,
        title: 'Recibio un reconocimiento',
        body: dto.message,
        url: '/communication/recognitions',
        entityType: 'recognition',
        entityId: recognition.id,
      });
    }
    await this.events.emitAsync(DOMAIN_EVENTS.RECOGNITION_GIVEN, {
      companyId: ctx.companyId,
      recognitionId: recognition.id,
      toEmployeeId: dto.toEmployeeId,
    });
    return recognition;
  }

  @Get('values')
  @RequirePermission('communication.recognition.read')
  @ApiOperation({ summary: 'Valores corporativos' })
  async values(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).companyValue.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  @Post('values')
  @RequirePermission('communication.value.manage')
  @Audit({ entityType: 'company_value' })
  @ApiOperation({ summary: 'Crea un valor corporativo' })
  async createValue(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(120),
          description: z.string().max(1000).nullable().optional(),
          icon: z.string().max(60).nullable().optional(),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
          position: z.number().int().min(0).default(0),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).companyValue.create({ data: dto as never });
  }

  @Get('celebrations')
  @RequirePermission('communication.post.read')
  @ApiOperation({ summary: 'Cumpleanos y aniversarios del mes' })
  async celebrations(@Ctx() ctx: RequestContext, @Query('month') month?: string) {
    return this.communication.celebrations(ctx, month ? Number(month) : new Date().getUTCMonth() + 1);
  }

  /* ------------------------------- benefits ----------------------------- */

  @Get('benefits')
  @RequirePermission('communication.benefit.read')
  @ApiOperation({ summary: 'Catalogo de beneficios' })
  async benefits(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).benefit, query, {
      where: { deletedAt: null, isActive: true },
      defaultSort: { name: 'asc' },
      sortable: ['name', 'createdAt'],
    });
  }

  @Post('benefits')
  @RequirePermission('communication.benefit.create')
  @Audit({ entityType: 'benefit' })
  @ApiOperation({ summary: 'Crea un beneficio' })
  async createBenefit(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(benefitSchema)) dto: z.infer<typeof benefitSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).benefit.create({
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      } as never,
    });
  }

  @Post('benefits/:id/enroll')
  @RequirePermission('communication.benefit.read')
  @ApiOperation({ summary: 'Solicita la inscripcion a un beneficio' })
  async enrollBenefit(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    if (!ctx.employeeId) throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    return this.prisma.forCompany(ctx.companyId).benefitEnrollment.upsert({
      where: { benefitId_employeeId: { benefitId: id, employeeId: ctx.employeeId } },
      create: { benefitId: id, employeeId: ctx.employeeId },
      update: { status: 'requested' },
    });
  }

  /* --------------------------------- wiki ------------------------------- */

  @Get('wiki')
  @RequirePermission('communication.wiki.read')
  @ApiOperation({ summary: 'Articulos de la wiki' })
  async wiki(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; categoryId?: string; search?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).wikiArticle, query, {
      where: {
        deletedAt: null,
        status: 'published',
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      defaultSort: { publishedAt: 'desc' },
      sortable: ['title', 'publishedAt', 'viewCount'],
    });
  }

  @Get('wiki/:slug')
  @RequirePermission('communication.wiki.read')
  @ApiOperation({ summary: 'Articulo de la wiki por slug' })
  async wikiArticle(@Ctx() ctx: RequestContext, @Param('slug') slug: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const article = await db.wikiArticle.findFirst({
      where: { slug, deletedAt: null },
      include: { category: true },
    });
    if (!article) throw BusinessException.notFound('Articulo');
    await db.wikiArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    return article;
  }

  @Post('wiki')
  @RequirePermission('communication.wiki.create')
  @Audit({ entityType: 'wiki_article' })
  @ApiOperation({ summary: 'Crea un articulo de la wiki' })
  async createWiki(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(wikiSchema)) dto: z.infer<typeof wikiSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    let slug = slugify(dto.title);
    let suffix = 1;
    while (await db.wikiArticle.findFirst({ where: { slug } })) {
      suffix += 1;
      slug = `${slugify(dto.title)}-${suffix}`;
    }
    return db.wikiArticle.create({
      data: {
        categoryId: dto.categoryId ?? null,
        title: dto.title,
        slug,
        summary: dto.summary ?? null,
        blocks: dto.blocks as object,
        tags: dto.tags,
        status: dto.publish ? 'published' : 'draft',
        publishedAt: dto.publish ? new Date() : null,
        createdById: ctx.userId,
      },
    });
  }

  @Patch('wiki/:id')
  @RequirePermission('communication.wiki.update')
  @Audit({ entityType: 'wiki_article' })
  @ApiOperation({ summary: 'Actualiza un articulo y sube su version' })
  async updateWiki(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(wikiSchema.partial())) dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { publish, blocks, ...rest } = dto;
    await db.wikiArticle.updateMany({
      where: { id },
      data: {
        ...defined(rest),
        ...(blocks ? { blocks: blocks as object, version: { increment: 1 } } : {}),
        ...(publish !== undefined
          ? { status: publish ? 'published' : 'draft', publishedAt: publish ? new Date() : null }
          : {}),
        updatedById: ctx.userId,
      } as never,
    });
    return db.wikiArticle.findFirst({ where: { id } });
  }

  @Get('wiki-categories')
  @RequirePermission('communication.wiki.read')
  @ApiOperation({ summary: 'Categorias de la wiki' })
  async wikiCategories(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).wikiCategory.findMany({
      where: { deletedAt: null },
      orderBy: { position: 'asc' },
    });
  }

  @Post('wiki-categories')
  @RequirePermission('communication.wiki.create')
  @ApiOperation({ summary: 'Crea una categoria de la wiki' })
  async createWikiCategory(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(160),
          parentId: uuid.nullable().optional(),
          icon: z.string().max(60).nullable().optional(),
          position: z.number().int().min(0).default(0),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).wikiCategory.create({
      data: { ...dto, slug: slugify(dto.name) } as never,
    });
  }
}
