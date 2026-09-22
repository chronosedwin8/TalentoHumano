import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'node:crypto';
import { DOMAIN_EVENTS, formatDateEs, renderTemplate } from '@talento/shared';
import QRCode from 'qrcode';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { FilesService } from '../../core/files/files.service';
import { NotificationsService } from '../../core/notifications/notifications.service';

/**
 * Documents, policies and signatures.
 *
 * Generated documents are produced as print-ready HTML with an embedded
 * verification QR; `PdfRenderer` is the seam where a Puppeteer (or external)
 * renderer plugs in without touching the callers. See docs/DECISIONS.md
 * (ADR-0006).
 */
export interface PdfRenderer {
  render(html: string, options?: { landscape?: boolean }): Promise<Buffer>;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /** Variables offered by the template editor. */
  async templateContext(companyId: string, employeeId?: string | null) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId } });
    const employee = employeeId
      ? await this.prisma.employee.findFirst({
          where: { id: employeeId, companyId },
          include: {
            position: true,
            department: true,
            location: true,
            contracts: { where: { isCurrent: true }, take: 1 },
          },
        })
      : null;

    const contract = employee?.contracts?.[0];

    return {
      company: {
        name: company?.name ?? '',
        legal_name: company?.legalName ?? company?.name ?? '',
        tax_id: company?.taxId ?? '',
        address: company?.address ?? '',
        city: company?.city ?? '',
        phone: company?.phone ?? '',
      },
      employee: employee
        ? {
            full_name: employee.fullName,
            first_name: employee.firstName,
            last_name: employee.lastName,
            document_type: employee.documentType,
            document_number: employee.documentNumber,
            email: employee.email,
            employee_code: employee.employeeCode,
            hired_at: formatDateEs(employee.hiredAt),
            status: employee.status,
          }
        : {},
      position: { name: employee?.position?.name ?? '' },
      department: { name: employee?.department?.name ?? '' },
      location: { name: employee?.location?.name ?? '', city: employee?.location?.city ?? '' },
      contract: {
        type: contract?.contractType ?? '',
        start_date: contract ? formatDateEs(contract.startDate) : '',
        end_date: contract?.endDate ? formatDateEs(contract.endDate) : 'indefinido',
        modality: contract?.workModality ?? '',
      },
      today: formatDateEs(new Date()),
      year: String(new Date().getUTCFullYear()),
    };
  }

  /** Renders a template into a stored, verifiable document. */
  async generate(
    ctx: RequestContext,
    input: { templateId: string; employeeId?: string | null; extraVariables?: Record<string, unknown>; isSelfService?: boolean },
  ) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: input.templateId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!template) throw BusinessException.notFound('Plantilla');
    if (input.isSelfService && !template.isSelfService) {
      throw BusinessException.forbidden('Esta plantilla no esta habilitada para autoservicio');
    }

    const context = {
      ...(await this.templateContext(ctx.companyId, input.employeeId)),
      ...(input.extraVariables ?? {}),
    };

    const verificationCode = this.buildVerificationCode(ctx.companyId, input.employeeId ?? ctx.userId);
    const body = renderTemplate(template.bodyHtml ?? this.blocksToHtml(template.blocks), context as never);
    const verifyUrl = `${(this.config.get<string>('env.WEB_URL') ?? '').replace(/\/$/, '')}/verificar/${verificationCode}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });

    const html = this.wrapDocument({
      title: template.name,
      body,
      companyName: (context as Record<string, any>).company?.name ?? '',
      verificationCode,
      qr,
      verifyUrl,
    });

    const document = await this.prisma.generatedDocument.create({
      data: {
        companyId: ctx.companyId,
        templateId: template.id,
        employeeId: input.employeeId ?? null,
        title: template.name,
        verificationCode,
        contentHtml: html,
        variables: context as object,
        isSelfService: Boolean(input.isSelfService),
        createdById: ctx.userId,
      },
    });

    return { id: document.id, verificationCode, html, verifyUrl };
  }

  private buildVerificationCode(companyId: string, seed: string): string {
    const hash = createHash('sha256')
      .update(`${companyId}:${seed}:${Date.now()}:${Math.random()}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
    return `TAL-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
  }

  /** Public verification of a generated document; no personal data exposed. */
  async verify(code: string) {
    const document = await this.prisma.generatedDocument.findFirst({
      where: { verificationCode: code.trim().toUpperCase() },
      include: {
        template: { select: { name: true } },
      },
    });
    if (!document) throw BusinessException.notFound('Documento');
    const company = await this.prisma.company.findFirst({
      where: { id: document.companyId },
      select: { name: true },
    });
    const variables = document.variables as Record<string, any>;
    return {
      valid: true,
      code: document.verificationCode,
      title: document.title,
      company: company?.name ?? '',
      issuedAt: document.createdAt,
      issuedTo: variables?.employee?.full_name ?? null,
      documentNumber: variables?.employee?.document_number
        ? `***${String(variables.employee.document_number).slice(-4)}`
        : null,
    };
  }

  /** Minimal block-to-HTML fallback for templates written in the block editor. */
  private blocksToHtml(blocks: unknown): string {
    const document = blocks as { blocks?: Array<{ type: string; data: Record<string, any> }> };
    if (!document?.blocks?.length) return '<p></p>';
    return document.blocks
      .map((block) => {
        switch (block.type) {
          case 'heading':
            return `<h${block.data.level ?? 2}>${block.data.text ?? ''}</h${block.data.level ?? 2}>`;
          case 'list':
            return `<ul>${(block.data.items ?? []).map((item: string) => `<li>${item}</li>`).join('')}</ul>`;
          case 'divider':
            return '<hr />';
          case 'quote':
            return `<blockquote>${block.data.text ?? ''}</blockquote>`;
          default:
            return `<p>${block.data.text ?? ''}</p>`;
        }
      })
      .join('\n');
  }

  private wrapDocument(params: {
    title: string;
    body: string;
    companyName: string;
    verificationCode: string;
    qr: string;
    verifyUrl: string;
  }): string {
    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${params.title}</title>
    <style>
      @page { size: letter; margin: 2.5cm 2cm; }
      body { font-family: "Inter", Arial, sans-serif; color: #111827; font-size: 12pt; line-height: 1.6; }
      header { border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 24px; }
      header h1 { font-size: 16pt; margin: 0 0 4px; }
      header p { margin: 0; color: #6b7280; font-size: 10pt; }
      main { min-height: 60vh; }
      footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px;
               display: flex; gap: 16px; align-items: center; font-size: 9pt; color: #6b7280; }
      footer img { width: 96px; height: 96px; }
      blockquote { border-left: 3px solid #d1d5db; margin: 0; padding-left: 12px; color: #374151; }
    </style>
  </head>
  <body>
    <header>
      <h1>${params.companyName}</h1>
      <p>${params.title}</p>
    </header>
    <main>${params.body}</main>
    <footer>
      <img src="${params.qr}" alt="Codigo de verificacion" />
      <div>
        <strong>Codigo de verificacion:</strong> ${params.verificationCode}<br />
        Verifique la autenticidad de este documento en ${params.verifyUrl}
      </div>
    </footer>
  </body>
</html>`;
  }

  /* ------------------------------- policies ----------------------------- */

  async publishPolicy(ctx: RequestContext, policyId: string, versionId: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const policy = await db.policy.findFirst({ where: { id: policyId, deletedAt: null } });
    if (!policy) throw BusinessException.notFound('Politica');

    await db.policyVersion.update({
      where: { id: versionId },
      data: { publishedAt: new Date() },
    });
    await db.policy.update({
      where: { id: policyId },
      data: { status: 'published' },
    });

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: { in: ['active', 'on_leave'] },
      },
      select: { id: true },
    });

    if (policy.requiresAck) {
      for (const employee of employees) {
        await db.policyAcknowledgement.upsert({
          where: { versionId_employeeId: { versionId, employeeId: employee.id } },
          create: { policyId, versionId, employeeId: employee.id },
          update: {},
        });
      }
      await this.notifications.notify({
        companyId: ctx.companyId,
        employeeIds: employees.map((employee) => employee.id),
        eventKey: DOMAIN_EVENTS.POLICY_PUBLISHED,
        title: `Nueva politica: ${policy.title}`,
        body: 'Requiere su lectura y acuse.',
        url: '/documents/policies',
        entityType: 'policy',
        entityId: policyId,
        force: true,
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.POLICY_PUBLISHED, {
      companyId: ctx.companyId,
      policyId,
      versionId,
      recipients: employees.length,
    });

    return { recipients: employees.length };
  }

  /** Simple signature: name, timestamp, IP and a content hash. */
  async acknowledgePolicy(ctx: RequestContext, versionId: string, sign: boolean) {
    if (!ctx.employeeId) throw BusinessException.forbidden('Su usuario no esta vinculado a un colaborador');
    const db = this.prisma.forCompany(ctx.companyId);
    const version = await db.policyVersion.findFirst({
      where: { id: versionId },
      include: { policy: true },
    });
    if (!version) throw BusinessException.notFound('Version de la politica');

    let signatureId: string | null = null;
    if (sign || version.policy.requiresSignature) {
      const request = await db.signatureRequest.create({
        data: {
          entityType: 'policy_version',
          entityId: versionId,
          title: version.policy.title,
          employeeId: ctx.employeeId,
          userId: ctx.userId,
          status: 'signed',
        },
      });
      const employee = await this.prisma.employee.findFirst({
        where: { id: ctx.employeeId },
        select: { fullName: true },
      });
      const signature = await db.signature.create({
        data: {
          requestId: request.id,
          signerName: employee?.fullName ?? ctx.email,
          signerUserId: ctx.userId,
          hash: createHash('sha256')
            .update(`${versionId}:${ctx.userId}:${new Date().toISOString()}`)
            .digest('hex'),
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent?.slice(0, 400) ?? null,
        },
      });
      signatureId = signature.id;
    }

    return db.policyAcknowledgement.upsert({
      where: { versionId_employeeId: { versionId, employeeId: ctx.employeeId } },
      create: {
        policyId: version.policyId,
        versionId,
        employeeId: ctx.employeeId,
        readAt: new Date(),
        acknowledgedAt: new Date(),
        signatureId,
      },
      update: { readAt: new Date(), acknowledgedAt: new Date(), signatureId },
    });
  }
}
