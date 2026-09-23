import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { NotificationChannel } from '@prisma/client';
import { uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { paged, parsePage } from '../../common/utils/pagination';
import { NotificationsService, TEMPLATE_VARIABLES } from './notifications.service';

const markReadSchema = z.object({ ids: z.array(z.string().uuid()).optional() });
const channelSchema = z.enum(['in_app', 'email', 'push', 'whatsapp', 'sms']);
const templateSchema = z.object({
  eventKey: z.string().trim().min(3).max(80),
  channel: channelSchema.default('email'),
  locale: z.enum(['es', 'en', 'de']).default('es'),
  subject: z.string().trim().max(300).nullable().optional(),
  body: z.string().min(1).max(20000),
  isActive: z.boolean().default(true),
});
const templatePatchSchema = z.object({
  subject: z.string().trim().max(300).nullable().optional(),
  body: z.string().min(1).max(20000).optional(),
  isActive: z.boolean().optional(),
});
const preferenceSchema = z.object({
  preferences: z.array(
    z.object({
      eventKey: z.string().min(1).max(80),
      channel: z.enum(['in_app', 'email', 'push', 'whatsapp', 'sms']),
      isEnabled: z.boolean(),
    }),
  ),
});

@ApiTags('notificaciones')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Centro de notificaciones del usuario' })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; unread?: string },
  ) {
    const { page, limit } = parsePage(query);
    const { rows, total, unread } = await this.notifications.listForUser(
      ctx.companyId,
      ctx.userId,
      {
        page,
        limit,
        unreadOnly: query.unread === 'true',
      },
    );
    const result = paged(rows, total, page, limit);
    return { data: result.data, meta: { ...result.meta, unread } };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cantidad de notificaciones sin leer' })
  async unreadCount(@Ctx() ctx: RequestContext) {
    const count = await this.prisma.notification.count({
      where: { companyId: ctx.companyId, userId: ctx.userId, readAt: null },
    });
    return { count };
  }

  @Post('read')
  @ApiOperation({ summary: 'Marca notificaciones como leidas' })
  async markRead(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(markReadSchema)) dto: { ids?: string[] },
  ) {
    return { updated: await this.notifications.markRead(ctx.companyId, ctx.userId, dto.ids) };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Preferencias de notificacion por evento y canal' })
  async preferences(@Ctx() ctx: RequestContext) {
    return this.prisma.notificationPreference.findMany({
      where: { companyId: ctx.companyId, userId: ctx.userId },
      orderBy: [{ eventKey: 'asc' }, { channel: 'asc' }],
    });
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Actualiza las preferencias de notificacion' })
  async updatePreferences(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(preferenceSchema))
    dto: {
      preferences: Array<{ eventKey: string; channel: NotificationChannel; isEnabled: boolean }>;
    },
  ) {
    for (const preference of dto.preferences) {
      await this.prisma.notificationPreference.upsert({
        where: {
          companyId_userId_eventKey_channel: {
            companyId: ctx.companyId,
            userId: ctx.userId,
            eventKey: preference.eventKey,
            channel: preference.channel,
          },
        },
        create: {
          companyId: ctx.companyId,
          userId: ctx.userId,
          eventKey: preference.eventKey,
          channel: preference.channel,
          isEnabled: preference.isEnabled,
        },
        update: { isEnabled: preference.isEnabled },
      });
    }
    return { updated: dto.preferences.length };
  }

  /* ------------------------------ templates ----------------------------- */

  @Get('templates')
  @RequirePermission('settings.notification.manage')
  @ApiOperation({ summary: 'Plantillas de notificacion (globales y de la empresa)' })
  async templates(@Ctx() ctx: RequestContext) {
    const templates = await this.notifications.listTemplates(ctx.companyId);
    return { templates, variables: TEMPLATE_VARIABLES };
  }

  @Post('templates')
  @RequirePermission('settings.notification.manage')
  @Audit({ entityType: 'notification_template' })
  @ApiOperation({ summary: 'Crea o reemplaza la plantilla de la empresa para un evento' })
  async createTemplate(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(templateSchema)) dto: z.infer<typeof templateSchema>,
  ) {
    return this.notifications.upsertTemplate(ctx, dto);
  }

  @Patch('templates/:id')
  @RequirePermission('settings.notification.manage')
  @Audit({ entityType: 'notification_template', action: 'update' })
  @ApiOperation({
    summary: 'Edita una plantilla; editar una global crea la version de la empresa',
  })
  async updateTemplate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(templatePatchSchema)) dto: z.infer<typeof templatePatchSchema>,
  ) {
    return this.notifications.updateTemplate(ctx, id, dto);
  }
}
