import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DOMAIN_EVENTS, MODULES, uuid } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { listPaged } from '../../common/utils/crud';
import { IntegrationsService } from './integrations.service';

const apiKeySchema = z.object({
  name: z.string().trim().min(2).max(160),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().nullable().optional(),
});

const webhookSchema = z.object({
  name: z.string().trim().min(2).max(160),
  url: z.string().url().max(500),
  events: z.array(z.string()).min(1),
});

@ApiTags('integraciones')
@Controller({ path: 'integrations', version: '1' })
@RequireModule(MODULES.SETTINGS)
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('events')
  @RequirePermission('settings.integration.manage')
  @ApiOperation({ summary: 'Eventos de dominio disponibles para webhooks' })
  async events() {
    return Object.values(DOMAIN_EVENTS);
  }

  @Get('api-keys')
  @RequirePermission('settings.integration.manage')
  @ApiOperation({ summary: 'API keys de la empresa' })
  async apiKeys(@Ctx() ctx: RequestContext) {
    return this.prisma.apiKey.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('api-keys')
  @RequirePermission('settings.integration.manage')
  @Audit({ entityType: 'api_key' })
  @ApiOperation({ summary: 'Crea una API key (la clave se muestra una sola vez)' })
  async createApiKey(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(apiKeySchema)) dto: z.infer<typeof apiKeySchema>,
  ) {
    return this.integrations.createApiKey(ctx.companyId, ctx.userId, dto);
  }

  @Delete('api-keys/:id')
  @RequirePermission('settings.integration.manage')
  @Audit({ entityType: 'api_key', action: 'delete' })
  @ApiOperation({ summary: 'Revoca una API key' })
  async revokeApiKey(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.prisma.apiKey.updateMany({
      where: { id, companyId: ctx.companyId },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { id };
  }

  @Get('webhooks')
  @RequirePermission('settings.integration.manage')
  @ApiOperation({ summary: 'Webhooks configurados' })
  async webhooks(@Ctx() ctx: RequestContext) {
    return this.prisma.webhook.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('webhooks')
  @RequirePermission('settings.integration.manage')
  @Audit({ entityType: 'webhook' })
  @ApiOperation({ summary: 'Registra un webhook firmado con HMAC' })
  async createWebhook(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(webhookSchema)) dto: z.infer<typeof webhookSchema>,
  ) {
    return this.integrations.createWebhook(ctx.companyId, dto);
  }

  @Delete('webhooks/:id')
  @RequirePermission('settings.integration.manage')
  @Audit({ entityType: 'webhook', action: 'delete' })
  @ApiOperation({ summary: 'Elimina un webhook' })
  async removeWebhook(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    await this.prisma.webhook.updateMany({
      where: { id, companyId: ctx.companyId },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { id };
  }

  @Get('webhooks/:id/deliveries')
  @RequirePermission('settings.integration.manage')
  @ApiOperation({ summary: 'Historial de entregas de un webhook' })
  async deliveries(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Query() query: { page?: string; limit?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).webhookDelivery, query, {
      where: { webhookId: id },
      defaultSort: { createdAt: 'desc' },
    });
  }
}
