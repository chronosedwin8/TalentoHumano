import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FileVisibility } from '@prisma/client';
import { ALLOWED_UPLOAD_MIME, ERROR_CODES } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { StorageService } from './storage.service';

export interface PresignRequest {
  filename: string;
  mimeType: string;
  size: number;
  visibility?: FileVisibility;
  entityType?: string | null;
  entityId?: string | null;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /** Creates the metadata row and returns the URL the browser uploads to. */
  async presignUpload(ctx: RequestContext, input: PresignRequest) {
    const maxMb = this.config.get<number>('env.MAX_UPLOAD_MB') ?? 50;
    if (input.size > maxMb * 1024 * 1024) {
      throw new BusinessException(
        ERROR_CODES.FILE_TOO_LARGE,
        `El archivo supera el limite de ${maxMb} MB`,
        413,
      );
    }
    if (!ALLOWED_UPLOAD_MIME.includes(input.mimeType)) {
      throw new BusinessException(
        ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
        'El tipo de archivo no esta permitido',
        415,
        { mimeType: input.mimeType },
      );
    }

    const storageKey = this.storage.buildKey(ctx.companyId, input.filename);
    const file = await this.prisma.storedFile.create({
      data: {
        companyId: ctx.companyId,
        storageKey,
        filename: input.filename,
        mimeType: input.mimeType,
        size: BigInt(input.size),
        visibility: input.visibility ?? 'private',
        uploadedById: ctx.userId,
        isUploaded: false,
      },
    });

    if (input.entityType && input.entityId) {
      await this.link(ctx.companyId, file.id, input.entityType, input.entityId);
    }

    const upload = await this.storage.presignUpload(storageKey, input.mimeType);
    return { fileId: file.id, ...upload };
  }

  /** Marks the file as uploaded once the browser finished the PUT. */
  async confirmUpload(ctx: RequestContext, fileId: string, checksum?: string) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, companyId: ctx.companyId },
    });
    if (!file) throw BusinessException.notFound('Archivo');
    return this.prisma.storedFile.update({
      where: { id: file.id },
      data: { isUploaded: true, checksum: checksum ?? file.checksum, virusScanStatus: 'skipped' },
    });
  }

  /** Registers a file produced by the server itself (PDF, XLSX, acts). */
  async storeBuffer(
    companyId: string | null,
    params: {
      filename: string;
      mimeType: string;
      buffer: Buffer;
      visibility?: FileVisibility;
      uploadedById?: string | null;
    },
  ) {
    const storageKey = this.storage.buildKey(companyId, params.filename);
    const { size, checksum } = await this.storage.writeBuffer(storageKey, params.buffer);
    return this.prisma.storedFile.create({
      data: {
        companyId,
        storageKey,
        filename: params.filename,
        mimeType: params.mimeType,
        size: BigInt(size),
        checksum,
        visibility: params.visibility ?? 'private',
        uploadedById: params.uploadedById ?? null,
        isUploaded: true,
      },
    });
  }

  async link(
    companyId: string,
    fileId: string,
    entityType: string,
    entityId: string,
    role?: string,
  ) {
    return this.prisma.fileLink.create({
      data: { companyId, fileId, entityType, entityId, role: role ?? null },
    });
  }

  async linkMany(companyId: string, fileIds: string[], entityType: string, entityId: string) {
    if (!fileIds.length) return;
    await this.prisma.fileLink.createMany({
      data: fileIds.map((fileId) => ({ companyId, fileId, entityType, entityId })),
      skipDuplicates: true,
    });
    await this.prisma.storedFile.updateMany({
      where: { id: { in: fileIds }, companyId },
      data: { isUploaded: true },
    });
  }

  async listForEntity(companyId: string, entityType: string, entityId: string) {
    const links = await this.prisma.fileLink.findMany({
      where: { companyId, entityType, entityId },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(links.map((link) => this.present(link.file)));
  }

  async findById(companyId: string, fileId: string) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, deletedAt: null, OR: [{ companyId }, { visibility: 'public' }] },
    });
    if (!file) throw BusinessException.notFound('Archivo');
    return file;
  }

  /** Batch variant of findById for listings; missing or deleted ids are skipped. */
  async findManyById(companyId: string, fileIds: string[]) {
    const rows = fileIds.length
      ? await this.prisma.storedFile.findMany({
          where: {
            id: { in: fileIds },
            deletedAt: null,
            OR: [{ companyId }, { visibility: 'public' }],
          },
        })
      : [];
    return new Map(rows.map((row) => [row.id, row]));
  }

  async downloadUrl(companyId: string, fileId: string): Promise<string> {
    const file = await this.findById(companyId, fileId);
    return this.storage.presignDownload(file.storageKey, 900, file.filename);
  }

  /** Serialisable representation, with a short lived download URL. */
  async present(file: {
    id: string;
    filename: string;
    mimeType: string;
    size: bigint;
    storageKey: string;
    visibility: FileVisibility;
    createdAt: Date;
  }) {
    return {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
      visibility: file.visibility,
      createdAt: file.createdAt,
      url: await this.storage.presignDownload(file.storageKey, 900, file.filename),
    };
  }

  async softDelete(ctx: RequestContext, fileId: string) {
    const file = await this.findById(ctx.companyId, fileId);
    await this.prisma.storedFile.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });
    return { id: file.id };
  }
}
