import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { blockDocumentSchema, MODULES, slugify, ticketMessageSchema, ticketSchema, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { ScopeService } from '../../core/access/scope.service';
import { HelpdeskService } from './helpdesk.service';

const categorySchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(60),
  description: z.string().max(500).nullable().optional(),
  parentId: uuid.nullable().optional(),
  slaPolicyId: uuid.nullable().optional(),
  defaultAssigneeEmployeeId: uuid.nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const slaSchema = z.object({
  name: z.string().trim().min(2).max(160),
  firstResponseMinutes: z.number().int().min(5).max(20160).default(240),
  resolutionMinutes: z.number().int().min(15).max(86400).default(2880),
  businessHoursOnly: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

const kbSchema = z.object({
  title: z.string().trim().min(2).max(260),
  categoryId: uuid.nullable().optional(),
  summary: z.string().max(1000).nullable().optional(),
  blocks: blockDocumentSchema,
  tags: z.array(z.string().max(40)).default([]),
  publish: z.boolean().default(false),
});

@ApiTags('servicio al colaborador')
@Controller({ path: 'helpdesk', version: '1' })
@RequireModule(MODULES.HELPDESK)
export class HelpdeskController {
  constructor(
    private readonly helpdesk: HelpdeskService,
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /* -------------------------------- tickets ----------------------------- */

  @Get('tickets')
  @RequirePermission('helpdesk.ticket.read')
  @ApiOperation({ summary: 'Bandeja de tickets' })
  async tickets(
    @Ctx() ctx: RequestContext,
    @Query()
    query: {
      page?: string;
      limit?: string;
      status?: string;
      priority?: string;
      categoryId?: string;
      assigneeId?: string;
      mine?: string;
      search?: string;
    },
  ) {
    const canSeeAll = this.scope.scopeFor(ctx, 'helpdesk.ticket.read') === 'company';
    return listPaged(this.prisma.forCompany(ctx.companyId).ticket, query, {
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.assigneeId ? { assigneeEmployeeId: query.assigneeId } : {}),
        ...(query.mine === 'true' || !canSeeAll
          ? { OR: [{ requesterUserId: ctx.userId }, { assigneeEmployeeId: ctx.employeeId ?? '-' }] }
          : {}),
        ...(query.search ? { subject: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, fullName: true } },
        assignee: { select: { id: true, fullName: true } },
      },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'number', 'priority', 'status'],
    });
  }

  @Get('tickets/:id')
  @RequirePermission('helpdesk.ticket.read')
  @ApiOperation({ summary: 'Detalle del ticket con su conversacion' })
  async ticket(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const ticket = await this.prisma.forCompany(ctx.companyId).ticket.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        requester: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        csat: true,
      },
    });
    if (!ticket) throw BusinessException.notFound('Ticket');

    const isOwn = ticket.requesterUserId === ctx.userId || ticket.assigneeEmployeeId === ctx.employeeId;
    const canSeeAll = this.scope.scopeFor(ctx, 'helpdesk.ticket.read') === 'company';
    if (!isOwn && !canSeeAll) throw BusinessException.outOfScope();

    return {
      ...ticket,
      messages: isOwn || canSeeAll ? ticket.messages.filter((m) => canSeeAll || !m.isInternal) : [],
    };
  }

  @Post('tickets')
  @RequirePermission('helpdesk.ticket.create')
  @Audit({ entityType: 'ticket' })
  @ApiOperation({ summary: 'Crea un ticket' })
  async createTicket(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(ticketSchema)) dto: z.infer<typeof ticketSchema>,
  ) {
    return this.helpdesk.createTicket(ctx, dto);
  }

  @Post('tickets/:id/messages')
  @RequirePermission('helpdesk.ticket.read')
  @Audit({ entityType: 'ticket_message' })
  @ApiOperation({ summary: 'Agrega un mensaje al ticket' })
  async addMessage(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(ticketMessageSchema)) dto: z.infer<typeof ticketMessageSchema>,
  ) {
    if (dto.isInternal) this.scope.requirePermission(ctx, 'helpdesk.ticket.update');
    return this.helpdesk.addMessage(ctx, id, dto);
  }

  @Patch('tickets/:id')
  @RequirePermission('helpdesk.ticket.update')
  @Audit({ entityType: 'ticket' })
  @ApiOperation({ summary: 'Actualiza estado, prioridad o categoria' })
  async updateTicket(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          status: z
            .enum(['new', 'open', 'pending_requester', 'on_hold', 'resolved', 'closed'])
            .optional(),
          priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
          categoryId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.ticket.updateMany({ where: { id }, data: defined(dto) as never });
    return db.ticket.findFirst({ where: { id } });
  }

  @Post('tickets/:id/assign')
  @RequirePermission('helpdesk.ticket.assign')
  @Audit({ entityType: 'ticket', action: 'assign' })
  @ApiOperation({ summary: 'Asigna el ticket a un agente' })
  async assign(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ assigneeEmployeeId: uuid })))
    dto: { assigneeEmployeeId: string },
  ) {
    return this.prisma.forCompany(ctx.companyId).ticket.update({
      where: { id },
      data: { assigneeEmployeeId: dto.assigneeEmployeeId, status: 'open' },
    });
  }

  @Post('tickets/:id/close')
  @RequirePermission('helpdesk.ticket.close')
  @Audit({ entityType: 'ticket', action: 'close' })
  @ApiOperation({ summary: 'Resuelve y cierra el ticket' })
  async close(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ resolutionNote: z.string().max(8000).nullable().optional() })))
    dto: { resolutionNote?: string | null },
  ) {
    return this.helpdesk.closeTicket(ctx, id, dto.resolutionNote);
  }

  @Post('tickets/:id/csat')
  @RequirePermission('helpdesk.ticket.read')
  @ApiOperation({ summary: 'Califica la atencion recibida (CSAT)' })
  async csat(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          rating: z.number().int().min(1).max(5),
          comment: z.string().max(2000).nullable().optional(),
        }),
      ),
    )
    dto: { rating: number; comment?: string | null },
  ) {
    return this.prisma.forCompany(ctx.companyId).csatResponse.upsert({
      where: { ticketId: id },
      create: { ticketId: id, rating: dto.rating, comment: dto.comment ?? null },
      update: { rating: dto.rating, comment: dto.comment ?? null },
    });
  }

  /* ------------------------------ categories ---------------------------- */

  @Get('categories')
  @RequirePermission('helpdesk.ticket.read')
  @ApiOperation({ summary: 'Categorias de ticket' })
  async categories(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).ticketCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  @Post('categories')
  @RequirePermission('helpdesk.category.manage')
  @Audit({ entityType: 'ticket_category' })
  @ApiOperation({ summary: 'Crea una categoria con su SLA' })
  async createCategory(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(categorySchema)) dto: z.infer<typeof categorySchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).ticketCategory.create({ data: dto as never });
  }

  @Get('sla-policies')
  @RequirePermission('helpdesk.sla.manage')
  @ApiOperation({ summary: 'Politicas de SLA' })
  async slaPolicies(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).slaPolicy.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('sla-policies')
  @RequirePermission('helpdesk.sla.manage')
  @Audit({ entityType: 'sla_policy' })
  @ApiOperation({ summary: 'Crea una politica de SLA' })
  async createSla(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(slaSchema)) dto: z.infer<typeof slaSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    if (dto.isDefault) {
      await db.slaPolicy.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return db.slaPolicy.create({ data: dto });
  }

  /* -------------------------------- macros ------------------------------ */

  @Get('macros')
  @RequirePermission('helpdesk.ticket.read')
  @ApiOperation({ summary: 'Macros de respuesta' })
  async macros(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).macro.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  @Post('macros')
  @RequirePermission('helpdesk.macro.manage')
  @Audit({ entityType: 'macro' })
  @ApiOperation({ summary: 'Crea una macro de respuesta' })
  async createMacro(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(160),
          body: z.string().min(2).max(20000),
          categoryId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).macro.create({ data: dto as never });
  }

  /* ------------------------- knowledge base ----------------------------- */

  @Get('kb')
  @RequirePermission('helpdesk.kb.read')
  @ApiOperation({ summary: 'Base de conocimiento' })
  async kb(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; search?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).kbArticle, query, {
      where: {
        deletedAt: null,
        status: 'published',
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      defaultSort: { viewCount: 'desc' },
      sortable: ['title', 'viewCount', 'createdAt'],
    });
  }

  @Get('kb/suggest')
  @RequirePermission('helpdesk.kb.read')
  @ApiOperation({ summary: 'Sugiere articulos antes de crear un ticket' })
  async suggest(@Ctx() ctx: RequestContext, @Query('q') q: string) {
    return this.helpdesk.suggestArticles(ctx.companyId, q);
  }

  @Post('kb')
  @RequirePermission('helpdesk.kb.create')
  @Audit({ entityType: 'kb_article' })
  @ApiOperation({ summary: 'Crea un articulo de la base de conocimiento' })
  async createKb(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(kbSchema)) dto: z.infer<typeof kbSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    let slug = slugify(dto.title);
    let suffix = 1;
    while (await db.kbArticle.findFirst({ where: { slug } })) {
      suffix += 1;
      slug = `${slugify(dto.title)}-${suffix}`;
    }
    return db.kbArticle.create({
      data: {
        title: dto.title,
        slug,
        categoryId: dto.categoryId ?? null,
        summary: dto.summary ?? null,
        blocks: dto.blocks as object,
        tags: dto.tags,
        status: dto.publish ? 'published' : 'draft',
      },
    });
  }

  /* ------------------------------- channels ----------------------------- */

  @Get('channels')
  @RequirePermission('helpdesk.channel.manage')
  @ApiOperation({ summary: 'Canales conectados (correo, WhatsApp, redes)' })
  async channels(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).channel.findMany({ orderBy: { kind: 'asc' } });
  }

  @Post('channels')
  @RequirePermission('helpdesk.channel.manage')
  @Audit({ entityType: 'channel' })
  @ApiOperation({ summary: 'Registra un canal conectable' })
  async createChannel(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          kind: z.enum(['gmail', 'outlook', 'whatsapp', 'messenger', 'instagram', 'webchat']),
          name: z.string().trim().min(2).max(160),
          config: z.record(z.unknown()).default({}),
          isActive: z.boolean().default(false),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).channel.create({
      data: { ...dto, config: dto.config as object } as never,
    });
  }

  @Get('metrics')
  @RequirePermission('helpdesk.ticket.read')
  @ApiOperation({ summary: 'Indicadores del centro de ayuda' })
  async metrics(@Ctx() ctx: RequestContext) {
    return this.helpdesk.metrics(ctx);
  }
}
