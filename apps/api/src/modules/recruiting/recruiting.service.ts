import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DEFAULT_CANDIDATE_RETENTION_MONTHS,
  DOMAIN_EVENTS,
  ERROR_CODES,
  addMonths,
  slugify,
  type PublicApplicationInput,
} from '@talento/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { AuditService } from '../../core/audit/audit.service';
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

@Injectable()
export class RecruitingService {
  private readonly logger = new Logger(RecruitingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService,
    private readonly events: EventEmitter2,
  ) {}

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

    await db.applicationStageHistory.create({
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
    }

    return updated;
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
