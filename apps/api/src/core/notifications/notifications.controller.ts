import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { NotificationChannel } from '@prisma/client';
import { z } from 'zod';
import { Ctx } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { paged, parsePage } from '../../common/utils/pagination';
import { NotificationsService } from './notifications.service';

const markReadSchema = z.object({ ids: z.array(z.string().uuid()).optional() });
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
}
