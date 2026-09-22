import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  hireCandidateSchema,
  isoDateTime,
  jobPostingSchema,
  MODULES,
  moveApplicationSchema,
  rejectApplicationSchema,
  requisitionSchema,
  scorecardSchema,
  uuid,
} from '@talento/shared';
import { z } from 'zod';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { WorkflowsService } from '../../core/workflows/workflows.service';
import { RecruitingService } from './recruiting.service';

const interviewSchema = z.object({
  applicationId: uuid,
  title: z.string().trim().min(2).max(200),
  kind: z.enum(['hr', 'technical', 'manager', 'panel', 'final']).default('hr'),
  scheduledAt: isoDateTime,
  durationMinutes: z.number().int().min(15).max(480).default(60),
  locationText: z.string().max(300).nullable().optional(),
  meetingUrl: z.string().max(500).nullable().optional(),
  blindUntilComplete: z.boolean().default(false),
  participantEmployeeIds: z.array(uuid).default([]),
});

const offerSchema = z.object({
  applicationId: uuid,
  positionId: uuid.nullable().optional(),
  departmentId: uuid.nullable().optional(),
  locationId: uuid.nullable().optional(),
  contractType: z.string().max(60).nullable().optional(),
  workModality: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  startDate: z.string().nullable().optional(),
  salary: z.number().nonnegative().nullable().optional(),
  benefits: z.string().max(4000).nullable().optional(),
  body: z.string().max(20000).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

const stageSchema = z.object({
  stages: z
    .array(
      z.object({
        id: uuid.optional(),
        name: z.string().trim().min(2).max(120),
        code: z.string().trim().min(2).max(60),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#64748b'),
        kind: z.string().max(30).default('standard'),
        autoEmailTemplateKey: z.string().max(80).nullable().optional(),
      }),
    )
    .min(2),
});

@ApiTags('reclutamiento')
@Controller({ path: 'recruiting', version: '1' })
@RequireModule(MODULES.RECRUITING)
export class RecruitingController {
  constructor(
    private readonly recruiting: RecruitingService,
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowsService,
    private readonly encryption: EncryptionService,
  ) {}

  /* ----------------------------- requisitions --------------------------- */

  @Get('requisitions')
  @RequirePermission('recruiting.requisition.read')
  @ApiOperation({ summary: 'Requisiciones de personal' })
  async requisitions(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).jobRequisition, query, {
      where: { deletedAt: null, ...(query.status ? { status: query.status } : {}) },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'neededBy', 'title'],
    });
  }

  @Post('requisitions')
  @RequirePermission('recruiting.requisition.create')
  @Audit({ entityType: 'job_requisition' })
  @ApiOperation({ summary: 'Crea una requisicion y lanza su flujo de aprobacion' })
  async createRequisition(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(requisitionSchema)) dto: z.infer<typeof requisitionSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const count = await db.jobRequisition.count();
    const requisition = await db.jobRequisition.create({
      data: {
        code: `REQ-${String(count + 1).padStart(4, '0')}`,
        title: dto.title,
        positionId: dto.positionId ?? null,
        departmentId: dto.departmentId ?? null,
        locationId: dto.locationId ?? null,
        reason: dto.reason,
        openings: dto.openings,
        neededBy: dto.neededBy ? new Date(dto.neededBy) : null,
        justification: dto.justification ?? null,
        contractType: dto.contractType ?? null,
        salaryRangeMin: this.encryption.encryptNumber(dto.salaryRangeMin ?? null),
        salaryRangeMax: this.encryption.encryptNumber(dto.salaryRangeMax ?? null),
        replacingEmployeeId: dto.replacingEmployeeId ?? null,
        status: 'pending_approval',
        requestedById: ctx.userId,
        createdById: ctx.userId,
      },
    });

    const { instanceId, status } = await this.workflows.start({
      companyId: ctx.companyId,
      entityType: 'job_requisition',
      entityId: requisition.id,
      title: `Requisicion: ${dto.title}`,
      summary: `${dto.openings} posicion(es) - ${dto.reason}`,
      requestedByUserId: ctx.userId,
      subjectEmployeeId: ctx.employeeId,
      context: { openings: dto.openings, reason: dto.reason },
      url: `/recruiting/requisitions/${requisition.id}`,
    });

    return db.jobRequisition.update({
      where: { id: requisition.id },
      data: {
        workflowInstanceId: instanceId,
        ...(status === 'approved' ? { status: 'approved', approvedAt: new Date() } : {}),
      },
    });
  }

  /* -------------------------------- jobs -------------------------------- */

  @Get('jobs')
  @RequirePermission('recruiting.job.read')
  @ApiOperation({ summary: 'Vacantes' })
  async jobs(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string; search?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).jobPosting, query, {
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: {
        department: { select: { name: true } },
        location: { select: { name: true } },
        _count: { select: { applications: true } },
      },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'title', 'publishedAt'],
    });
  }

  @Get('jobs/:id')
  @RequirePermission('recruiting.job.read')
  @ApiOperation({ summary: 'Detalle de la vacante con su pipeline' })
  async job(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const job = await this.prisma.forCompany(ctx.companyId).jobPosting.findFirst({
      where: { id, deletedAt: null },
      include: {
        stages: { orderBy: { position: 'asc' } },
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        competencies: { include: { competency: true } },
      },
    });
    if (!job) throw BusinessException.notFound('Vacante');
    return {
      ...job,
      salaryRangeMin: this.encryption.decryptNumber(job.salaryRangeMin),
      salaryRangeMax: this.encryption.decryptNumber(job.salaryRangeMax),
    };
  }

  @Post('jobs')
  @RequirePermission('recruiting.job.create')
  @Audit({ entityType: 'job_posting' })
  @ApiOperation({ summary: 'Crea una vacante con el pipeline por defecto' })
  async createJob(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(jobPostingSchema)) dto: z.infer<typeof jobPostingSchema>,
  ) {
    return this.recruiting.createPosting(ctx, dto);
  }

  @Patch('jobs/:id')
  @RequirePermission('recruiting.job.update')
  @Audit({ entityType: 'job_posting' })
  @ApiOperation({ summary: 'Actualiza una vacante' })
  async updateJob(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(jobPostingSchema.partial())) dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { salaryRangeMin, salaryRangeMax, competencyIds, closesAt, ...rest } = dto;
    await db.jobPosting.updateMany({
      where: { id },
      data: {
        ...defined(rest),
        ...(closesAt !== undefined ? { closesAt: closesAt ? new Date(closesAt) : null } : {}),
        ...(salaryRangeMin !== undefined
          ? { salaryRangeMin: this.encryption.encryptNumber(salaryRangeMin) }
          : {}),
        ...(salaryRangeMax !== undefined
          ? { salaryRangeMax: this.encryption.encryptNumber(salaryRangeMax) }
          : {}),
      } as never,
    });
    return db.jobPosting.findFirst({ where: { id } });
  }

  @Post('jobs/:id/publish')
  @RequirePermission('recruiting.job.publish')
  @Audit({ entityType: 'job_posting', action: 'update', summary: 'Publicacion de vacante' })
  @ApiOperation({ summary: 'Publica la vacante en el portal de empleos' })
  async publishJob(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).jobPosting.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  @Post('jobs/:id/close')
  @RequirePermission('recruiting.job.publish')
  @Audit({ entityType: 'job_posting', action: 'update' })
  @ApiOperation({ summary: 'Cierra la vacante' })
  async closeJob(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).jobPosting.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
    });
  }

  @Post('jobs/:id/stages')
  @RequirePermission('recruiting.settings.manage')
  @Audit({ entityType: 'pipeline_stage' })
  @ApiOperation({ summary: 'Configura las etapas del pipeline de la vacante' })
  async setStages(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(stageSchema)) dto: z.infer<typeof stageSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    for (const [index, stage] of dto.stages.entries()) {
      if (stage.id) {
        await db.pipelineStage.updateMany({
          where: { id: stage.id, jobPostingId: id },
          data: {
            name: stage.name,
            code: stage.code,
            color: stage.color,
            kind: stage.kind,
            position: index,
            autoEmailTemplateKey: stage.autoEmailTemplateKey ?? null,
          },
        });
      } else {
        await db.pipelineStage.create({
          data: {
            jobPostingId: id,
            name: stage.name,
            code: stage.code,
            color: stage.color,
            kind: stage.kind,
            position: index,
            autoEmailTemplateKey: stage.autoEmailTemplateKey ?? null,
          },
        });
      }
    }
    return db.pipelineStage.findMany({ where: { jobPostingId: id }, orderBy: { position: 'asc' } });
  }

  @Get('jobs/:id/pipeline')
  @RequirePermission('recruiting.application.read')
  @ApiOperation({ summary: 'Tablero Kanban de la vacante' })
  async pipeline(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const [stages, applications] = await Promise.all([
      db.pipelineStage.findMany({ where: { jobPostingId: id }, orderBy: { position: 'asc' } }),
      db.application.findMany({
        where: { jobPostingId: id, deletedAt: null },
        include: {
          candidate: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              city: true,
              source: true,
              rating: true,
            },
          },
          interviews: { select: { id: true, scheduledAt: true, status: true } },
        },
        orderBy: { appliedAt: 'desc' },
      }),
    ]);

    return stages.map((stage) => ({
      stage,
      applications: applications.filter((application) => application.stageId === stage.id),
    }));
  }

  /* ----------------------------- applications --------------------------- */

  @Post('applications/:id/move')
  @RequirePermission('recruiting.application.move')
  @Audit({ entityType: 'application', action: 'update' })
  @ApiOperation({ summary: 'Mueve la postulacion a otra etapa' })
  async move(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(moveApplicationSchema)) dto: z.infer<typeof moveApplicationSchema>,
  ) {
    return this.recruiting.moveApplication(ctx, id, dto.stageId, dto.note, dto.notifyCandidate);
  }

  @Post('applications/:id/reject')
  @RequirePermission('recruiting.application.reject')
  @Audit({ entityType: 'application', action: 'reject' })
  @ApiOperation({ summary: 'Descarta la postulacion con motivo obligatorio' })
  async reject(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(rejectApplicationSchema)) dto: z.infer<typeof rejectApplicationSchema>,
  ) {
    return this.recruiting.rejectApplication(ctx, id, dto);
  }

  @Post('applications/:id/hire')
  @RequirePermission('recruiting.hire.execute')
  @Audit({ entityType: 'application', summary: 'Contratacion de candidato' })
  @ApiOperation({
    summary: 'Contrata al candidato: crea colaborador, usuario, legajo y onboarding',
  })
  async hire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(hireCandidateSchema)) dto: z.infer<typeof hireCandidateSchema>,
  ) {
    return this.recruiting.hire(ctx, id, dto);
  }

  @Get('applications/:id')
  @RequirePermission('recruiting.application.read')
  @ApiOperation({ summary: 'Detalle de la postulacion' })
  async application(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).application.findFirst({
      where: { id, deletedAt: null },
      include: {
        candidate: { include: { documents: true, tags: true } },
        jobPosting: { select: { id: true, title: true, code: true } },
        stage: true,
        stageHistory: { include: { toStage: true }, orderBy: { createdAt: 'desc' } },
        interviews: { include: { participants: true, feedback: { include: { ratings: true } } } },
        assessments: true,
        referenceChecks: true,
        offers: true,
      },
    });
  }

  /* ------------------------------ candidates ---------------------------- */

  @Get('candidates')
  @RequirePermission('recruiting.candidate.read')
  @ApiOperation({ summary: 'Banco de candidatos (talent pool)' })
  async candidates(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; search?: string; tag?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).candidate, query, {
      where: {
        deletedAt: null,
        anonymizedAt: null,
        ...(query.tag ? { tags: { some: { tag: query.tag } } } : {}),
        ...(query.search
          ? {
              OR: [
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { documentNumber: { contains: query.search, mode: 'insensitive' } },
                { resumeText: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { tags: true, _count: { select: { applications: true } } },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'fullName', 'rating'],
    });
  }

  @Patch('candidates/:id')
  @RequirePermission('recruiting.candidate.update')
  @Audit({ entityType: 'candidate' })
  @ApiOperation({ summary: 'Actualiza la ficha del candidato' })
  async updateCandidate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          rating: z.number().int().min(1).max(5).nullable().optional(),
          notes: z.string().max(8000).nullable().optional(),
          tags: z.array(z.string().max(60)).optional(),
          resumeText: z.string().max(200000).nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { tags, ...rest } = dto;
    await db.candidate.updateMany({ where: { id }, data: defined(rest) as never });
    if (tags) {
      await db.candidateTag.deleteMany({ where: { candidateId: id } });
      if (tags.length) {
        await db.candidateTag.createMany({
          data: tags.map((tag: string) => ({ candidateId: id, tag })),
          skipDuplicates: true,
        });
      }
    }
    return db.candidate.findFirst({ where: { id }, include: { tags: true } });
  }

  /* ------------------------------ interviews ---------------------------- */

  @Post('interviews')
  @RequirePermission('recruiting.interview.create')
  @Audit({ entityType: 'interview' })
  @ApiOperation({ summary: 'Programa una entrevista' })
  async createInterview(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(interviewSchema)) dto: z.infer<typeof interviewSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const interview = await db.interview.create({
      data: {
        applicationId: dto.applicationId,
        title: dto.title,
        kind: dto.kind,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        locationText: dto.locationText ?? null,
        meetingUrl: dto.meetingUrl ?? null,
        blindUntilComplete: dto.blindUntilComplete,
        createdById: ctx.userId,
      },
    });
    if (dto.participantEmployeeIds.length) {
      await db.interviewParticipant.createMany({
        data: dto.participantEmployeeIds.map((employeeId) => ({
          interviewId: interview.id,
          employeeId,
        })),
      });
    }
    return db.interview.findFirst({ where: { id: interview.id }, include: { participants: true } });
  }

  @Get('interviews')
  @RequirePermission('recruiting.interview.read')
  @ApiOperation({ summary: 'Agenda de entrevistas' })
  async interviews(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; from?: string; to?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).interview, query, {
      where: {
        deletedAt: null,
        ...(query.from || query.to
          ? {
              scheduledAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        application: { include: { candidate: { select: { fullName: true, email: true } } } },
        participants: true,
      },
      defaultSort: { scheduledAt: 'asc' },
      sortable: ['scheduledAt'],
    });
  }

  @Get('interviews/:id/ics')
  @RequirePermission('recruiting.interview.read')
  @ApiOperation({ summary: 'Invitacion de calendario (ICS) de la entrevista' })
  async interviewIcs(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const interview = await this.prisma.forCompany(ctx.companyId).interview.findFirst({
      where: { id },
      include: { application: { include: { candidate: true, jobPosting: true } } },
    });
    if (!interview) throw BusinessException.notFound('Entrevista');
    const start = interview.scheduledAt;
    const end = new Date(start.getTime() + interview.durationMinutes * 60_000);
    const stamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TALENTO//Entrevistas//ES',
      'BEGIN:VEVENT',
      `UID:${interview.id}@talento`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${interview.title} - ${interview.application.candidate.fullName}`,
      `DESCRIPTION:Vacante ${interview.application.jobPosting.title}`,
      interview.meetingUrl ? `URL:${interview.meetingUrl}` : `LOCATION:${interview.locationText ?? ''}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return { filename: `entrevista-${interview.id}.ics`, content: ics };
  }

  @Post('scorecards')
  @RequirePermission('recruiting.scorecard.create')
  @Audit({ entityType: 'interview_feedback' })
  @ApiOperation({ summary: 'Registra la tarjeta de evaluacion de una entrevista' })
  async createScorecard(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(scorecardSchema)) dto: z.infer<typeof scorecardSchema>,
  ) {
    if (!ctx.employeeId) throw BusinessException.forbidden('Solo un colaborador puede evaluar');
    const db = this.prisma.forCompany(ctx.companyId);
    const feedback = await db.interviewFeedback.upsert({
      where: {
        interviewId_reviewerEmployeeId: {
          interviewId: dto.interviewId,
          reviewerEmployeeId: ctx.employeeId,
        },
      },
      create: {
        interviewId: dto.interviewId,
        reviewerEmployeeId: ctx.employeeId,
        overallRating: dto.overallRating,
        recommendation: dto.recommendation,
        strengths: dto.strengths ?? null,
        concerns: dto.concerns ?? null,
        notes: dto.notes ?? null,
      },
      update: {
        overallRating: dto.overallRating,
        recommendation: dto.recommendation,
        strengths: dto.strengths ?? null,
        concerns: dto.concerns ?? null,
        notes: dto.notes ?? null,
        submittedAt: new Date(),
      },
    });
    await db.interviewFeedbackRating.deleteMany({ where: { feedbackId: feedback.id } });
    if (dto.ratings.length) {
      await db.interviewFeedbackRating.createMany({
        data: dto.ratings.map((rating) => ({
          feedbackId: feedback.id,
          competencyId: rating.competencyId,
          rating: rating.rating,
          comment: rating.comment ?? null,
        })),
      });
    }
    await db.interview.update({ where: { id: dto.interviewId }, data: { status: 'done' } });
    return feedback;
  }

  /* -------------------------------- offers ------------------------------ */

  @Post('offers')
  @RequirePermission('recruiting.offer.create')
  @Audit({ entityType: 'offer' })
  @ApiOperation({ summary: 'Crea una carta de oferta' })
  async createOffer(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(offerSchema)) dto: z.infer<typeof offerSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).offer.create({
      data: {
        applicationId: dto.applicationId,
        positionId: dto.positionId ?? null,
        departmentId: dto.departmentId ?? null,
        locationId: dto.locationId ?? null,
        contractType: dto.contractType ?? null,
        workModality: dto.workModality,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        salary: this.encryption.encryptNumber(dto.salary ?? null),
        benefits: dto.benefits ?? null,
        body: dto.body ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        accessToken: this.encryption.randomToken(24),
        createdById: ctx.userId,
      },
    });
  }

  @Post('offers/:id/send')
  @RequirePermission('recruiting.offer.send')
  @Audit({ entityType: 'offer', action: 'update' })
  @ApiOperation({ summary: 'Envia la oferta al candidato' })
  async sendOffer(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).offer.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  /* ------------------------------- referrals ---------------------------- */

  @Get('referrals')
  @RequirePermission('recruiting.referral.read')
  @ApiOperation({ summary: 'Programa de referidos' })
  async referrals(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).referral, query, {
      include: {
        employee: { select: { id: true, fullName: true } },
        candidate: { select: { id: true, fullName: true, email: true } },
      },
      defaultSort: { createdAt: 'desc' },
    });
  }

  /* --------------------------------- KPIs ------------------------------- */

  @Get('metrics')
  @RequirePermission('recruiting.job.read')
  @ApiOperation({ summary: 'Indicadores del proceso de seleccion' })
  async metrics(@Ctx() ctx: RequestContext) {
    return this.recruiting.metrics(ctx);
  }

  @Post('retention/anonymize')
  @RequirePermission('settings.retention.manage')
  @Audit({ entityType: 'candidate', action: 'delete', summary: 'Anonimizacion por retencion' })
  @ApiOperation({ summary: 'Anonimiza candidatos cuya retencion vencio (Habeas Data)' })
  async anonymize(@Ctx() ctx: RequestContext) {
    return { anonymized: await this.recruiting.anonymizeExpiredCandidates(ctx.companyId) };
  }
}
