import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DEFAULT_CANDIDATE_RETENTION_MONTHS,
  DOMAIN_EVENTS,
  ERROR_CODES,
  addMonths,
  renderTemplate,
  slugify,
  type PublicApplicationInput,
} from '@talento/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { AuditService } from '../../core/audit/audit.service';
import { MailService } from '../../core/notifications/mail.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { PeopleService } from '../people/people.service';

export const DEFAULT_PIPELINE_STAGES = [
  { code: 'new', name: 'Nuevo', color: '#64748b', kind: 'standard' },
  { code: 'screening', name: 'Preseleccion', color: '#0ea5e9', kind: 'standard' },
  { code: 'hr_interview', name: 'Entrevista HR', color: '#6366f1', kind: 'interview' },
  { code: 'technical_test', name: 'Prueba tecnica', color: '#8b5cf6', kind: 'assessment' },
  { code: 'manager_interview', name: 'Entrevista jefe', color: '#a855f7', kind: 'interview' },
  { code: 'references', name: 'Referencias', color: '#f59e0b', kind: 'reference' },
  { code: 'offer', name: 'Oferta', color: '#10b981', kind: 'offer' },
  { code: 'hired', name: 'Contratado', color: '#059669', kind: 'hired' },
  { code: 'rejected', name: 'Descartado', color: '#ef4444', kind: 'rejected' },
];

/**
 * Plain-text e-mails a stage can send automatically when a candidate lands on
 * it. The key is what `pipeline_stages.auto_email_template_key` stores; the
 * text accepts `{{candidateName}}`, `{{jobTitle}}`, `{{companyName}}` and
 * `{{stageName}}`. An unknown key falls back to `generic`.
 */
export const STAGE_EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  application_received: {
    subject: 'Recibimos su postulacion a {{jobTitle}}',
    body: 'Hola {{candidateName}},\n\nGracias por postularse a la vacante {{jobTitle}} en {{companyName}}. Ya tenemos su hoja de vida y la revisaremos en los proximos dias.\n\nLe escribiremos por este mismo medio con cualquier novedad.',
  },
  screening: {
    subject: 'Su postulacion a {{jobTitle}} avanza a preseleccion',
    body: 'Hola {{candidateName}},\n\nSu perfil fue preseleccionado para la vacante {{jobTitle}} en {{companyName}}. Pronto nos pondremos en contacto para coordinar los siguientes pasos.',
  },
  interview: {
    subject: 'Entrevista para {{jobTitle}}',
    body: 'Hola {{candidateName}},\n\nQueremos conocerle mejor: su proceso para la vacante {{jobTitle}} en {{companyName}} pasa a la etapa {{stageName}}. En breve recibira la invitacion con la fecha y el lugar o enlace de la entrevista.',
  },
  assessment: {
    subject: 'Prueba tecnica para {{jobTitle}}',
    body: 'Hola {{candidateName}},\n\nSu proceso para la vacante {{jobTitle}} en {{companyName}} llego a la etapa de pruebas. Le enviaremos las instrucciones y los plazos para completarlas.',
  },
  references: {
    subject: 'Verificacion de referencias - {{jobTitle}}',
    body: 'Hola {{candidateName}},\n\nEstamos en la etapa de verificacion de referencias para la vacante {{jobTitle}} en {{companyName}}. Es posible que contactemos a las personas que indico como referencia.',
  },
  offer: {
    subject: 'Buenas noticias sobre su proceso para {{jobTitle}}',
    body: 'Hola {{candidateName}},\n\nSu proceso para la vacante {{jobTitle}} en {{companyName}} llego a la etapa de oferta. Le enviaremos la carta con las condiciones por este medio.',
  },
  rejected: {
    subject: 'Su proceso para {{jobTitle}} en {{companyName}}',
    body: 'Hola {{candidateName}},\n\nGracias por su interes en la vacante {{jobTitle}} en {{companyName}}. En esta ocasion decidimos continuar con otros perfiles; conservaremos su hoja de vida para futuras oportunidades.',
  },
  generic: {
    subject: 'Su postulacion a {{jobTitle}} cambio de etapa',
    body: 'Hola {{candidateName}},\n\nSu proceso para la vacante {{jobTitle}} en {{companyName}} avanzo a la etapa {{stageName}}. Le informaremos cualquier novedad.',
  },
};

const textToHtml = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');

@Injectable()
export class RecruitingService {
  private readonly logger = new Logger(RecruitingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService,
    private readonly events: EventEmitter2,
  ) {}

  private webUrl(path: string): string {
    const base = (this.config.get<string>('env.WEB_URL') ?? '').replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private async companyBrand(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { name: true, primaryColor: true, slug: true },
    });
    return company ?? { name: 'TALENTO', primaryColor: null, slug: '' };
  }

  /* ------------------------------ postings ------------------------------ */

  async createPosting(ctx: RequestContext, input: Record<string, any>) {
    const db = this.prisma.forCompany(ctx.companyId);
    const count = await db.jobPosting.count();
    const baseSlug = slugify(input.title);
    let slug = baseSlug;
    let suffix = 1;
    while (await db.jobPosting.findFirst({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const posting = await db.jobPosting.create({
      data: {
        requisitionId: input.requisitionId ?? null,
        code: `VAC-${String(count + 1).padStart(4, '0')}`,
        slug,
        title: input.title,
        positionId: input.positionId ?? null,
        departmentId: input.departmentId ?? null,
        locationId: input.locationId ?? null,
        workModality: input.workModality,
        contractType: input.contractType ?? null,
        openings: input.openings,
        description: input.description,
        requirements: input.requirements ?? null,
        benefits: input.benefits ?? null,
        salaryRangeMin: this.encryption.encryptNumber(input.salaryRangeMin ?? null),
        salaryRangeMax: this.encryption.encryptNumber(input.salaryRangeMax ?? null),
        salaryVisible: input.salaryVisible ?? false,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        recruiterId: input.recruiterId ?? null,
        hiringManagerId: input.hiringManagerId ?? null,
        isInternal: input.isInternal ?? false,
        createdById: ctx.userId,
      },
    });

    // Every vacancy starts with the default configurable pipeline.
    await db.pipelineStage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((stage, index) => ({
        jobPostingId: posting.id,
        name: stage.name,
        code: stage.code,
        position: index,
        color: stage.color,
        kind: stage.kind,
      })),
    });

    if (input.competencyIds?.length) {
      await db.jobCompetency.createMany({
        data: input.competencyIds.map((competencyId: string) => ({
          jobPostingId: posting.id,
          competencyId,
        })),
      });
    }

    return db.jobPosting.findFirst({
      where: { id: posting.id },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  async publicPostings(companySlug: string) {
    const company = await this.prisma.company.findFirst({
      where: { slug: companySlug, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        website: true,
        privacyPolicy: true,
      },
    });
    if (!company) throw BusinessException.notFound('Empresa');

    const postings = await this.prisma.jobPosting.findMany({
      where: {
        companyId: company.id,
        status: 'published',
        isInternal: false,
        deletedAt: null,
        OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }],
      },
      select: {
        id: true,
        slug: true,
        code: true,
        title: true,
        description: true,
        requirements: true,
        benefits: true,
        workModality: true,
        contractType: true,
        openings: true,
        publishedAt: true,
        closesAt: true,
        salaryVisible: true,
        salaryRangeMin: true,
        salaryRangeMax: true,
        department: { select: { name: true } },
        location: { select: { name: true, city: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return {
      company,
      postings: postings.map((posting) => ({
        ...posting,
        salaryRangeMin: posting.salaryVisible
          ? this.encryption.decryptNumber(posting.salaryRangeMin)
          : null,
        salaryRangeMax: posting.salaryVisible
          ? this.encryption.decryptNumber(posting.salaryRangeMax)
          : null,
      })),
    };
  }

  /* ----------------------------- applications --------------------------- */

  /** Public application from the careers portal. */
  async apply(companySlug: string, jobSlug: string, input: PublicApplicationInput) {
    const company = await this.prisma.company.findFirst({
      where: { slug: companySlug, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!company) throw BusinessException.notFound('Empresa');

    const posting = await this.prisma.jobPosting.findFirst({
      where: { companyId: company.id, slug: jobSlug, status: 'published', deletedAt: null },
    });
    if (!posting) throw BusinessException.notFound('Vacante');
    if (posting.closesAt && posting.closesAt < new Date()) {
      throw BusinessException.validation('La vacante ya cerro');
    }

    const email = input.email.toLowerCase();
    let candidate = await this.prisma.candidate.findFirst({
      where: {
        companyId: company.id,
        OR: [
          { email },
          ...(input.documentNumber ? [{ documentNumber: input.documentNumber }] : []),
        ],
        deletedAt: null,
      },
    });

    const retentionUntil = addMonths(new Date(), DEFAULT_CANDIDATE_RETENTION_MONTHS);

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: {
          companyId: company.id,
          firstName: input.firstName,
          lastName: input.lastName,
          fullName: `${input.firstName} ${input.lastName}`.trim(),
          email,
          phone: input.phone,
          documentNumber: input.documentNumber ?? null,
          city: input.city ?? null,
          linkedinUrl: input.linkedinUrl || null,
          source: input.source,
          referredByEmployeeId: input.referredByEmployeeId ?? null,
          resumeFileId: input.resumeFileId ?? null,
          consentAt: new Date(),
          retentionUntil,
        },
      });
    } else {
      candidate = await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          phone: input.phone,
          city: input.city ?? candidate.city,
          linkedinUrl: input.linkedinUrl || candidate.linkedinUrl,
          resumeFileId: input.resumeFileId ?? candidate.resumeFileId,
          consentAt: new Date(),
          retentionUntil,
        },
      });
    }

    const duplicate = await this.prisma.application.findFirst({
      where: { jobPostingId: posting.id, candidateId: candidate.id },
    });
    if (duplicate) {
      throw new BusinessException(
        ERROR_CODES.DUPLICATE_CANDIDATE,
        'Ya registramos su postulacion a esta vacante',
        409,
      );
    }

    const firstStage = await this.prisma.pipelineStage.findFirst({
      where: { companyId: company.id, jobPostingId: posting.id },
      orderBy: { position: 'asc' },
    });

    const application = await this.prisma.application.create({
      data: {
        companyId: company.id,
        jobPostingId: posting.id,
        candidateId: candidate.id,
        stageId: firstStage?.id ?? null,
        source: input.source,
        coverLetter: input.coverLetter ?? null,
        answers: (input.answers ?? {}) as object,
      },
    });

    if (input.resumeFileId) {
      await this.prisma.candidateDocument.create({
        data: {
          companyId: company.id,
          candidateId: candidate.id,
          fileId: input.resumeFileId,
          kind: 'resume',
          name: `CV ${candidate.fullName}`,
        },
      });
    }

    if (input.referredByEmployeeId) {
      await this.prisma.referral.create({
        data: {
          companyId: company.id,
          employeeId: input.referredByEmployeeId,
          candidateId: candidate.id,
          jobPostingId: posting.id,
        },
      });
    }

    if (posting.recruiterId) {
      const recruiter = await this.prisma.employee.findFirst({
        where: { id: posting.recruiterId },
        select: { userId: true },
      });
      if (recruiter?.userId) {
        await this.notifications.notify({
          companyId: company.id,
          userIds: [recruiter.userId],
          eventKey: DOMAIN_EVENTS.CANDIDATE_APPLIED,
          title: `Nueva postulacion: ${candidate.fullName}`,
          body: `${posting.title}`,
          url: `/recruiting/jobs/${posting.id}`,
          entityType: 'application',
          entityId: application.id,
        });
      }
    }

    await this.events.emitAsync(DOMAIN_EVENTS.CANDIDATE_APPLIED, {
      companyId: company.id,
      applicationId: application.id,
      candidateId: candidate.id,
      jobPostingId: posting.id,
    });

    return { applicationId: application.id, candidateId: candidate.id };
  }

  async moveApplication(
    ctx: RequestContext,
    applicationId: string,
    stageId: string,
    note?: string | null,
    notifyCandidate = false,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const application = await db.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: { candidate: true, jobPosting: { select: { id: true, title: true } } },
    });
    if (!application) throw BusinessException.notFound('Postulacion');

    const stage = await db.pipelineStage.findFirst({
      where: { id: stageId, jobPostingId: application.jobPostingId },
    });
    if (!stage) {
      throw new BusinessException(
        ERROR_CODES.APPLICATION_STAGE_INVALID,
        'La etapa no pertenece al pipeline de esta vacante',
        422,
      );
    }

    const history = await db.applicationStageHistory.create({
      data: {
        applicationId,
        fromStageId: application.stageId,
        toStageId: stageId,
        note: note ?? null,
        movedById: ctx.userId,
      },
    });

    const updated = await db.application.update({
      where: { id: applicationId },
      data: {
        stageId,
        ...(stage.kind === 'rejected' ? { status: 'rejected', rejectedAt: new Date() } : {}),
      },
    });

    await this.events.emitAsync(DOMAIN_EVENTS.APPLICATION_STAGE_CHANGED, {
      companyId: ctx.companyId,
      applicationId,
      stageCode: stage.code,
      candidateId: application.candidateId,
    });

    if (notifyCandidate && stage.autoEmailTemplateKey) {
      this.logger.log(
        `Plantilla ${stage.autoEmailTemplateKey} programada para ${application.candidate.email}`,
      );
      const sent = await this.sendStageEmail(ctx.companyId, {
        templateKey: stage.autoEmailTemplateKey,
        stageName: stage.name,
        candidateName: application.candidate.fullName,
        candidateEmail: application.candidate.email,
        jobTitle: application.jobPosting.title,
      });
      if (sent) {
        // The stage history doubles as the application timeline: the mail
        // is recorded on the very movement that triggered it.
        const line = `Correo automatico enviado (${stage.autoEmailTemplateKey}) a ${application.candidate.email}`;
        await db.applicationStageHistory.update({
          where: { id: history.id },
          data: { note: [note?.trim(), line].filter(Boolean).join('\n').slice(0, 1000) },
        });
      }
    }

    return updated;
  }

  /**
   * Sends the automatic e-mail configured on a pipeline stage. Anonymised or
   * placeholder addresses are skipped; a delivery failure is logged and never
   * blocks the move.
   */
  private async sendStageEmail(
    companyId: string,
    params: {
      templateKey: string;
      stageName: string;
      candidateName: string;
      candidateEmail: string;
      jobTitle: string;
    },
  ): Promise<boolean> {
    if (!params.candidateEmail || params.candidateEmail.endsWith('@anonimizado.local')) {
      return false;
    }
    const template = STAGE_EMAIL_TEMPLATES[params.templateKey] ?? STAGE_EMAIL_TEMPLATES.generic;
    const company = await this.companyBrand(companyId);
    const variables = {
      candidateName: params.candidateName,
      jobTitle: params.jobTitle,
      companyName: company.name,
      stageName: params.stageName,
    };
    const subject = renderTemplate(template.subject, variables);
    const text = renderTemplate(template.body, variables);
    try {
      await this.mail.send({
        to: params.candidateEmail,
        subject,
        text,
        html: this.mail.render({
          title: subject,
          body: textToHtml(text),
          companyName: company.name,
          primaryColor: company.primaryColor ?? undefined,
        }),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `No fue posible enviar la plantilla ${params.templateKey} a ${params.candidateEmail}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /* -------------------------------- offers ------------------------------ */

  /**
   * E-mails the offer letter to the candidate with the public link where they
   * accept or reject it, then marks the offer as sent.
   */
  async sendOffer(ctx: RequestContext, offerId: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const offer = await db.offer.findFirst({
      where: { id: offerId },
      include: {
        application: {
          include: {
            candidate: { select: { id: true, fullName: true, email: true } },
            jobPosting: { select: { id: true, title: true, recruiterId: true } },
          },
        },
      },
    });
    if (!offer) throw BusinessException.notFound('Oferta');
    if (offer.status === 'accepted' || offer.status === 'rejected') {
      throw BusinessException.validation('El candidato ya respondio esta oferta');
    }
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      throw BusinessException.validation('La oferta ya vencio; ajuste la fecha limite');
    }

    let accessToken = offer.accessToken;
    if (!accessToken) {
      accessToken = this.encryption.randomToken(24);
      await db.offer.update({ where: { id: offer.id }, data: { accessToken } });
    }

    const company = await this.companyBrand(ctx.companyId);
    const candidate = offer.application.candidate;
    const jobTitle = offer.application.jobPosting.title;
    const link = this.webUrl(`/oferta/${accessToken}`);
    const expires = offer.expiresAt
      ? ` Tiene plazo hasta el ${offer.expiresAt.toISOString().slice(0, 10)} para responder.`
      : '';
    const subject = `Carta de oferta: ${jobTitle} en ${company.name}`;
    const intro = `Hola ${candidate.fullName},\n\n${company.name} quiere hacerle una oferta para el cargo ${jobTitle}. Puede leer la carta completa y aceptarla o rechazarla desde el enlace de abajo.${expires}`;
    const text = `${intro}\n\n${link}${offer.body ? `\n\n---\n${offer.body}` : ''}`;

    await this.mail.send({
      to: candidate.email,
      subject,
      text,
      html: this.mail.render({
        title: subject,
        body: textToHtml(intro) + (offer.body ? `<hr />${textToHtml(offer.body)}` : ''),
        actionUrl: link,
        actionLabel: 'Ver y responder la oferta',
        companyName: company.name,
        primaryColor: company.primaryColor ?? undefined,
      }),
    });

    const updated = await db.offer.update({
      where: { id: offer.id },
      data: { status: 'sent', sentAt: new Date() },
    });

    await this.events.emitAsync(DOMAIN_EVENTS.OFFER_SENT, {
      companyId: ctx.companyId,
      offerId: offer.id,
      applicationId: offer.applicationId,
      candidateId: candidate.id,
    });

    return updated;
  }

  /* ------------------------------ referrals ----------------------------- */

  /**
   * Internal referral: the signed-in employee proposes a candidate for a
   * published vacancy. It reuses the public application flow so the candidate,
   * the application and the referral row are created exactly as from the
   * portal, with the employee as referrer.
   */
  async refer(
    ctx: RequestContext,
    input: {
      jobPostingId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      city?: string | null;
      linkedinUrl?: string | null;
      coverLetter?: string | null;
      consentAccepted: true;
    },
  ) {
    if (!ctx.employeeId) {
      throw BusinessException.forbidden('Solo un colaborador puede referir candidatos');
    }
    const company = await this.companyBrand(ctx.companyId);
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id: input.jobPostingId, companyId: ctx.companyId, deletedAt: null },
      select: { slug: true, status: true },
    });
    if (!posting) throw BusinessException.notFound('Vacante');
    if (posting.status !== 'published') {
      throw BusinessException.validation('Solo se puede referir a vacantes publicadas');
    }
    return this.apply(company.slug, posting.slug, {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      city: input.city ?? null,
      linkedinUrl: input.linkedinUrl || null,
      source: 'referral',
      referredByEmployeeId: ctx.employeeId,
      coverLetter: input.coverLetter ?? null,
      consentAccepted: true,
    });
  }

  async rejectApplication(
    ctx: RequestContext,
    applicationId: string,
    input: { reason: string; keepInTalentPool: boolean; note?: string | null },
  ) {
    if (!input.reason?.trim()) {
      throw new BusinessException(
        ERROR_CODES.REJECTION_REASON_REQUIRED,
        'El motivo de descarte es obligatorio',
        422,
      );
    }
    const db = this.prisma.forCompany(ctx.companyId);
    const application = await db.application.update({
      where: { id: applicationId },
      data: {
        status: 'rejected',
        rejectionReason: input.reason,
        rejectedAt: new Date(),
        keepInTalentPool: input.keepInTalentPool,
      },
    });
    const rejectedStage = await db.pipelineStage.findFirst({
      where: { jobPostingId: application.jobPostingId, kind: 'rejected' },
    });
    if (rejectedStage) {
      await db.application.update({
        where: { id: applicationId },
        data: { stageId: rejectedStage.id },
      });
    }
    await this.events.emitAsync(DOMAIN_EVENTS.APPLICATION_REJECTED, {
      companyId: ctx.companyId,
      applicationId,
      reason: input.reason,
    });
    return application;
  }

  /* ------------------------------- hiring ------------------------------- */

  /**
   * Turns a candidate into an employee: creates the employee and user, moves
   * the CV into the digital file and starts onboarding. Acceptance criteria 6.
   */
  async hire(ctx: RequestContext, applicationId: string, input: Record<string, any>) {
    const db = this.prisma.forCompany(ctx.companyId);
    const application = await db.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: { candidate: true, jobPosting: true },
    });
    if (!application) throw BusinessException.notFound('Postulacion');
    if (application.status === 'hired') {
      throw new BusinessException(ERROR_CODES.ALREADY_HIRED, 'El candidato ya fue contratado', 409);
    }

    const candidate = application.candidate;
    const [firstName, ...restName] = candidate.fullName.split(' ');

    const employee = await this.people.create(ctx, {
      firstName: candidate.firstName || firstName,
      lastName: candidate.lastName || restName.join(' ') || firstName,
      email: candidate.email,
      documentType: 'CC',
      documentNumber: candidate.documentNumber ?? `TMP-${candidate.id.slice(0, 8)}`,
      phone: candidate.phone ?? null,
      city: candidate.city ?? null,
      hiredAt: input.hiredAt,
      status: 'active',
      positionId: input.positionId ?? application.jobPosting.positionId ?? null,
      departmentId: input.departmentId ?? application.jobPosting.departmentId ?? null,
      locationId: input.locationId ?? application.jobPosting.locationId ?? null,
      managerId: input.managerId ?? application.jobPosting.hiringManagerId ?? null,
      createUserAccount: input.createUserAccount ?? true,
    } as never);

    await db.employmentContract.create({
      data: {
        employeeId: employee.id,
        contractType: input.contractType ?? 'indefinido',
        startDate: new Date(input.hiredAt),
        endDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        positionId: input.positionId ?? application.jobPosting.positionId ?? null,
        departmentId: input.departmentId ?? application.jobPosting.departmentId ?? null,
        locationId: input.locationId ?? application.jobPosting.locationId ?? null,
        workModality: input.workModality ?? application.jobPosting.workModality,
        baseSalary: this.encryption.encryptNumber(input.baseSalary ?? null),
        isCurrent: true,
        createdById: ctx.userId,
      },
    });

    // Move the CV and any candidate document into the employee digital file.
    const documents = await db.candidateDocument.findMany({ where: { candidateId: candidate.id } });
    if (documents.length) {
      const cvType = await db.documentType.upsert({
        where: { companyId_code: { companyId: ctx.companyId, code: 'hoja_vida' } },
        create: { code: 'hoja_vida', name: 'Hoja de vida', isRequired: false },
        update: {},
      });
      for (const document of documents) {
        await db.employeeDocument.create({
          data: {
            employeeId: employee.id,
            documentTypeId: cvType.id,
            fileId: document.fileId,
            name: document.name,
            status: 'valid',
            createdById: ctx.userId,
          },
        });
      }
    }

    await db.application.update({
      where: { id: applicationId },
      data: { status: 'hired', hiredAt: new Date() },
    });
    const hiredStage = await db.pipelineStage.findFirst({
      where: { jobPostingId: application.jobPostingId, kind: 'hired' },
    });
    if (hiredStage) {
      await db.application.update({
        where: { id: applicationId },
        data: { stageId: hiredStage.id },
      });
    }
    await db.candidate.update({
      where: { id: candidate.id },
      data: { hiredEmployeeId: employee.id, retentionUntil: null },
    });

    const openPositions = await db.application.count({
      where: { jobPostingId: application.jobPostingId, status: 'hired' },
    });
    if (openPositions >= application.jobPosting.openings) {
      await db.jobPosting.update({
        where: { id: application.jobPostingId },
        data: { status: 'closed', closedAt: new Date() },
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.EMPLOYEE_HIRED, {
      companyId: ctx.companyId,
      employeeId: employee.id,
      candidateId: candidate.id,
      applicationId,
      hiredAt: input.hiredAt,
      onboardingTemplateId: input.onboardingTemplateId ?? null,
      positionId: employee.positionId,
      departmentId: employee.departmentId,
      locationId: employee.locationId,
    });

    await this.audit.record(ctx, {
      action: 'create',
      entityType: 'employee',
      entityId: employee.id,
      summary: `Contratacion de ${candidate.fullName} desde la vacante ${application.jobPosting.title}`,
    });

    return { employeeId: employee.id, applicationId, candidateId: candidate.id };
  }

  /* -------------------------------- KPIs -------------------------------- */

  async metrics(ctx: RequestContext) {
    const companyId = ctx.companyId;
    const [openJobs, activeApplications, hiredThisYear, byStage, bySource] = await Promise.all([
      this.prisma.jobPosting.count({
        where: { companyId, status: 'published', deletedAt: null },
      }),
      this.prisma.application.count({ where: { companyId, status: 'active', deletedAt: null } }),
      this.prisma.application.count({
        where: {
          companyId,
          status: 'hired',
          hiredAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) },
        },
      }),
      this.prisma.application.groupBy({
        by: ['stageId'],
        where: { companyId, status: 'active', deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['source'],
        where: { companyId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const stages = await this.prisma.pipelineStage.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const stageName = new Map(stages.map((s) => [s.id, s.name]));

    const hired = await this.prisma.application.findMany({
      where: { companyId, status: 'hired', hiredAt: { not: null } },
      select: { appliedAt: true, hiredAt: true, jobPosting: { select: { publishedAt: true } } },
      take: 200,
      orderBy: { hiredAt: 'desc' },
    });

    const timeToHire = hired.length
      ? hired.reduce(
          (acc, row) => acc + (row.hiredAt!.getTime() - row.appliedAt.getTime()) / 86_400_000,
          0,
        ) / hired.length
      : 0;
    const withPublished = hired.filter((row) => row.jobPosting.publishedAt);
    const timeToFill = withPublished.length
      ? withPublished.reduce(
          (acc, row) =>
            acc + (row.hiredAt!.getTime() - row.jobPosting.publishedAt!.getTime()) / 86_400_000,
          0,
        ) / withPublished.length
      : 0;

    return {
      openJobs,
      activeApplications,
      hiredThisYear,
      timeToHireDays: Number(timeToHire.toFixed(1)),
      timeToFillDays: Number(timeToFill.toFixed(1)),
      byStage: byStage.map((row) => ({
        label: row.stageId ? (stageName.get(row.stageId) ?? 'Sin etapa') : 'Sin etapa',
        value: row._count._all,
      })),
      bySource: bySource.map((row) => ({ label: row.source, value: row._count._all })),
    };
  }

  /* --------------------------- data retention --------------------------- */

  /** Anonymises non-hired candidates whose retention period expired. */
  async anonymizeExpiredCandidates(companyId: string): Promise<number> {
    const expired = await this.prisma.candidate.findMany({
      where: {
        companyId,
        deletedAt: null,
        anonymizedAt: null,
        hiredEmployeeId: null,
        retentionUntil: { not: null, lt: new Date() },
      },
      select: { id: true },
      take: 500,
    });

    for (const candidate of expired) {
      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          firstName: 'Anonimo',
          lastName: 'Anonimo',
          fullName: 'Candidato anonimizado',
          email: `anon-${candidate.id}@anonimizado.local`,
          phone: null,
          documentNumber: null,
          linkedinUrl: null,
          resumeText: null,
          resumeFileId: null,
          notes: null,
          parsedData: {},
          anonymizedAt: new Date(),
        },
      });
      await this.prisma.candidateDocument.deleteMany({ where: { candidateId: candidate.id } });
    }
    return expired.length;
  }
}
