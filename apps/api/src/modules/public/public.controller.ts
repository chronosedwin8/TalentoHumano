import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ethicsFollowUpSchema,
  ethicsMessageSchema,
  ethicsReportSchema,
  publicApplicationSchema,
  uuid,
} from '@talento/shared';
import { z } from 'zod';
import { Public } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from '../../core/files/files.service';
import { EthicsService } from '../ethics/ethics.service';
import { RecruitingService } from '../recruiting/recruiting.service';

/** Documents a candidate or a whistleblower may attach, nothing else. */
const PUBLIC_UPLOAD_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
];

/**
 * Reports per hour and per IP accepted by the hotline.
 *
 * A whole office shares one public address, so a tight limit would silently
 * block the sixth person who wants to report something on the same day. The
 * limit is here to stop flooding, not to ration a whistleblowing channel, and
 * it is tunable for companies whose network shape needs more room.
 */
const ETHICS_REPORT_LIMIT = Number(process.env.ETHICS_REPORT_LIMIT ?? 20);

const publicUploadSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(160),
  size: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
});

/**
 * Public surface: careers portal and ethics hotline.
 * Nothing here requires a session, everything here is rate limited, and the
 * ethics endpoints never log IP or user agent.
 */
@ApiTags('portales publicos')
@Controller({ path: 'public', version: '1' })
@Public()
export class PublicController {
  constructor(
    private readonly recruiting: RecruitingService,
    private readonly ethics: EthicsService,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  /* ---------------------------- public uploads -------------------------- */

  /**
   * Lets a candidate attach a resume, or a whistleblower attach evidence,
   * without a session. The file belongs to the target company from the start,
   * the MIME allow-list is narrower than the internal one, and the quota is
   * tight so the endpoint cannot be used as free storage.
   */
  @Post(':companySlug/uploads')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'URL prefirmada para adjuntar un archivo sin sesion' })
  async presignPublicUpload(
    @Param('companySlug') companySlug: string,
    @Body(new ZodValidationPipe(publicUploadSchema)) dto: z.infer<typeof publicUploadSchema>,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { slug: companySlug, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw BusinessException.notFound('Empresa');
    if (!PUBLIC_UPLOAD_MIME.includes(dto.mimeType)) {
      throw BusinessException.validation('Solo se aceptan archivos PDF, Word o imagen');
    }

    return this.files.presignUpload(
      { companyId: company.id, userId: null } as never,
      { ...dto, visibility: 'private' } as never,
    );
  }

  @Post(':companySlug/uploads/:fileId/confirm')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Confirma la subida de un adjunto publico' })
  async confirmPublicUpload(
    @Param('companySlug') companySlug: string,
    @Param('fileId', new ZodValidationPipe(uuid)) fileId: string,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { slug: companySlug, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw BusinessException.notFound('Empresa');
    await this.files.confirmUpload({ companyId: company.id } as never, fileId);
    return { fileId };
  }

  /* ---------------------------- careers portal -------------------------- */

  @Get('careers/:companySlug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Portal publico de empleos de la empresa' })
  async careers(@Param('companySlug') companySlug: string) {
    return this.recruiting.publicPostings(companySlug);
  }

  @Get('careers/:companySlug/jobs/:jobSlug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Detalle publico de una vacante' })
  async job(@Param('companySlug') companySlug: string, @Param('jobSlug') jobSlug: string) {
    const { company, postings } = await this.recruiting.publicPostings(companySlug);
    const posting = postings.find((row) => row.slug === jobSlug);
    if (!posting) throw BusinessException.notFound('Vacante');
    await this.prisma.jobPosting.updateMany({
      where: { id: posting.id },
      data: { viewCount: { increment: 1 } },
    });
    return { company, posting };
  }

  @Post('careers/:companySlug/jobs/:jobSlug/apply')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Postulacion publica a una vacante' })
  async apply(
    @Param('companySlug') companySlug: string,
    @Param('jobSlug') jobSlug: string,
    @Body(new ZodValidationPipe(publicApplicationSchema))
    dto: z.infer<typeof publicApplicationSchema>,
  ) {
    return this.recruiting.apply(companySlug, jobSlug, dto);
  }

  /* ----------------------------- ethics portal -------------------------- */

  @Get('ethics/:companySlug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Portal publico del canal de denuncias' })
  async ethicsPortal(@Param('companySlug') companySlug: string) {
    return this.ethics.publicCategories(companySlug);
  }

  @Post('ethics/:companySlug/reports')
  @Throttle({ default: { limit: ETHICS_REPORT_LIMIT, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Envia una denuncia; devuelve codigo de seguimiento y clave (no se registra IP)',
  })
  async submitReport(
    @Param('companySlug') companySlug: string,
    @Body(new ZodValidationPipe(ethicsReportSchema)) dto: z.infer<typeof ethicsReportSchema>,
  ) {
    return this.ethics.submitReport(companySlug, dto);
  }

  @Post('ethics/follow-up')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Consulta el estado de una denuncia con codigo y clave' })
  async followUp(
    @Body(new ZodValidationPipe(ethicsFollowUpSchema)) dto: z.infer<typeof ethicsFollowUpSchema>,
  ) {
    return this.ethics.followUp(dto.trackingCode, dto.accessKey);
  }

  @Post('ethics/messages')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Envia un mensaje al investigador manteniendo el anonimato' })
  async ethicsMessage(
    @Body(new ZodValidationPipe(ethicsMessageSchema)) dto: z.infer<typeof ethicsMessageSchema>,
  ) {
    return this.ethics.addReporterMessage(dto.trackingCode, dto.accessKey, dto.message);
  }

  /* ------------------------------- offers ------------------------------- */

  @Get('offers/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Carta de oferta accesible por enlace unico' })
  async offer(@Param('token') token: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { accessToken: token, status: { in: ['sent', 'accepted', 'rejected'] } },
      include: {
        application: {
          include: {
            candidate: { select: { fullName: true, email: true } },
            jobPosting: { select: { title: true } },
          },
        },
      },
    });
    if (!offer) throw BusinessException.notFound('Oferta');
    const company = await this.prisma.company.findFirst({
      where: { id: offer.companyId },
      select: { name: true, logoUrl: true, primaryColor: true },
    });
    return {
      company,
      candidate: offer.application.candidate.fullName,
      position: offer.application.jobPosting.title,
      body: offer.body,
      startDate: offer.startDate,
      status: offer.status,
      expiresAt: offer.expiresAt,
    };
  }

  @Post('offers/:token/respond')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'El candidato acepta o rechaza la oferta' })
  async respondOffer(
    @Param('token') token: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          decision: z.enum(['accepted', 'rejected']),
          note: z.string().max(1000).nullable().optional(),
        }),
      ),
    )
    dto: { decision: 'accepted' | 'rejected'; note?: string | null },
  ) {
    const offer = await this.prisma.offer.findFirst({
      where: { accessToken: token, status: 'sent' },
    });
    if (!offer) throw BusinessException.notFound('Oferta');
    return this.prisma.offer.update({
      where: { id: offer.id },
      data: { status: dto.decision, respondedAt: new Date(), responseNote: dto.note ?? null },
    });
  }

  /* --------------------------- document check --------------------------- */

  @Get('verify/:code')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verificacion publica de un documento generado' })
  async verify(@Param('code') code: string) {
    const document = await this.prisma.generatedDocument.findFirst({
      where: { verificationCode: code.trim().toUpperCase() },
      select: { title: true, createdAt: true, companyId: true, variables: true },
    });
    if (!document) return { valid: false };
    const company = await this.prisma.company.findFirst({
      where: { id: document.companyId },
      select: { name: true },
    });
    const variables = document.variables as Record<string, any>;
    return {
      valid: true,
      title: document.title,
      company: company?.name ?? '',
      issuedAt: document.createdAt,
      issuedTo: variables?.employee?.full_name ?? null,
    };
  }
}
