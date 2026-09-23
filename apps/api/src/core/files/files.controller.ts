import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { presignUploadSchema, uuid } from '@talento/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Ctx, Public } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestContext } from '../../common/types/request-context';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

@ApiTags('archivos')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StorageService,
  ) {}

  @Post('presign')
  @ApiOperation({ summary: 'Solicita una URL prefirmada para subir un archivo' })
  async presign(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(presignUploadSchema)) dto: any,
  ) {
    return this.files.presignUpload(ctx, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirma que la subida finalizo' })
  async confirm(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ checksum: z.string().optional() })))
    dto: { checksum?: string },
  ) {
    const file = await this.files.confirmUpload(ctx, id, dto.checksum);
    return this.files.present(file);
  }

  /* ------------------------------------------------------------------ *
   * Local storage driver endpoints. With STORAGE_DRIVER=s3 the browser
   * talks to S3/MinIO directly and these routes are never used.
   *
   * They are declared before the ':id' routes on purpose: Express matches
   * in registration order, so 'download' would otherwise be captured by
   * ':id' and rejected as an invalid uuid behind the auth guard.
   * ------------------------------------------------------------------ */

  @Public()
  @Put('upload')
  @ApiOperation({ summary: 'Recibe los bytes de una URL prefirmada local' })
  async upload(@Query('key') key: string, @Query('token') token: string, @Req() req: Request) {
    if (!this.storage.isLocal) throw BusinessException.forbidden('Subida directa deshabilitada');
    if (!key || !this.storage.verifyToken(key, 'put', token)) {
      throw BusinessException.forbidden('Enlace de subida invalido o expirado');
    }
    const { size, checksum } = await this.storage.writeStream(key, req);
    return { size, checksum };
  }

  @Public()
  @Get('download')
  @ApiOperation({ summary: 'Entrega un archivo con una URL firmada local' })
  async download(
    @Query('key') key: string,
    @Query('token') token: string,
    @Query('filename') filename: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.storage.isLocal) throw BusinessException.forbidden('Descarga directa deshabilitada');
    if (!key || !this.storage.verifyToken(key, 'get', token)) {
      throw BusinessException.forbidden('Enlace de descarga invalido o expirado');
    }
    if (!(await this.storage.exists(key))) throw BusinessException.notFound('Archivo');
    if (filename) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    this.storage.readStream(key).pipe(res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Metadatos y URL temporal de descarga' })
  async findOne(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const file = await this.files.findById(ctx.companyId, id);
    return this.files.present(file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina logicamente un archivo' })
  async remove(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.files.softDelete(ctx, id);
  }
}
