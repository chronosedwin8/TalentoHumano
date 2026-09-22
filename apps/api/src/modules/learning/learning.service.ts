import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Block, BlockDocument } from '@talento/shared';
import { DEFAULT_EMBED_PROVIDERS, DOMAIN_EVENTS, ERROR_CODES, addMonths, slugify } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /* -------------------------------- embeds ------------------------------ */

  /** Domains a company allows inside embed blocks (CSP frame-src). */
  async allowedEmbedDomains(companyId: string): Promise<string[]> {
    const providers = await this.prisma.embedProvider.findMany({
      where: { companyId, isActive: true },
      select: { domain: true },
    });
    if (providers.length) return providers.map((p) => p.domain);
    return DEFAULT_EMBED_PROVIDERS.map((p) => p.domain);
  }

  async ensureDefaultEmbedProviders(companyId: string): Promise<number> {
    let created = 0;
    for (const provider of DEFAULT_EMBED_PROVIDERS) {
      const exists = await this.prisma.embedProvider.findFirst({
        where: { companyId, domain: provider.domain },
      });
      if (exists) continue;
      await this.prisma.embedProvider.create({
        data: {
          companyId,
          name: provider.name,
          domain: provider.domain,
          oembedUrl: provider.oembed,
          isActive: true,
        },
      });
      created += 1;
    }
    return created;
  }

  /** Rejects embed blocks pointing to domains outside the allow list. */
  async validateBlocks(companyId: string, document: BlockDocument): Promise<void> {
    const allowed = await this.allowedEmbedDomains(companyId);
    const walk = (blocks: Block[]): void => {
      for (const block of blocks) {
        if (block.type === 'embed') {
          const url = String((block.data as { url?: string }).url ?? '');
          if (url) {
            let host = '';
            try {
              host = new URL(url).hostname.replace(/^www\./, '');
            } catch {
              throw BusinessException.validation('La URL del bloque de embed no es valida');
            }
            const ok = allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
            if (!ok) {
              throw new BusinessException(
                ERROR_CODES.EMBED_DOMAIN_NOT_ALLOWED,
                `El dominio ${host} no esta en la lista blanca de la empresa`,
                422,
                { host, allowed },
              );
            }
          }
        }
        if (block.children?.length) walk(block.children);
      }
    };
    walk(document.blocks ?? []);
  }

  /* ------------------------------- courses ------------------------------ */

  async createCourse(ctx: RequestContext, input: Record<string, any>) {
    const db = this.prisma.forCompany(ctx.companyId);
    const baseSlug = slugify(input.title);
    let slug = baseSlug;
    let suffix = 1;
    while (await db.course.findFirst({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }
    return db.course.create({
      data: {
        title: input.title,
        slug,
        summary: input.summary ?? null,
        category: input.category ?? null,
        kind: input.kind ?? 'internal',
        provider: input.provider ?? null,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        isMandatory: input.isMandatory ?? false,
        recertificationMonths: input.recertificationMonths ?? null,
        passingScore: input.passingScore ?? 70,
        coverFileId: input.coverFileId ?? null,
        informativeCost: input.informativeCost ?? null,
        tags: input.tags ?? [],
        createdById: ctx.userId,
      },
    });
  }

  /** Saves a lesson block document as draft or publishes a new version. */
  async saveLessonContent(
    ctx: RequestContext,
    lessonId: string,
    blocks: BlockDocument,
    publish: boolean,
    changeNote?: string | null,
  ) {
    await this.validateBlocks(ctx.companyId, blocks);
    const db = this.prisma.forCompany(ctx.companyId);

    const lesson = await db.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
    if (!lesson) throw BusinessException.notFound('Leccion');

    const current = await db.lessonContent.findFirst({ where: { lessonId } });

    if (!publish) {
      return db.lessonContent.upsert({
        where: { lessonId },
        create: {
          lessonId,
          blocks: (current?.blocks ?? { version: 1, blocks: [] }) as object,
          draftBlocks: blocks as object,
          updatedById: ctx.userId,
        },
        update: { draftBlocks: blocks as object, updatedById: ctx.userId },
      });
    }

    const version = (current?.version ?? 0) + 1;
    const content = await db.lessonContent.upsert({
      where: { lessonId },
      create: {
        lessonId,
        blocks: blocks as object,
        draftBlocks: null,
        version,
        isPublished: true,
        publishedAt: new Date(),
        updatedById: ctx.userId,
      },
      update: {
        blocks: blocks as object,
        draftBlocks: null,
        version,
        isPublished: true,
        publishedAt: new Date(),
        updatedById: ctx.userId,
      },
    });

    await db.lessonContentVersion.create({
      data: {
        lessonId,
        version,
        blocks: blocks as object,
        changeNote: changeNote ?? null,
        createdById: ctx.userId,
      },
    });

    return content;
  }

  /* ----------------------------- enrollments ---------------------------- */

  async enroll(
    ctx: RequestContext,
    input: { courseId: string; employeeIds: string[]; dueDate?: string | null; source?: string },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const course = await db.course.findFirst({ where: { id: input.courseId, deletedAt: null } });
    if (!course) throw BusinessException.notFound('Curso');

    const created: string[] = [];
    for (const employeeId of input.employeeIds) {
      const enrollment = await db.enrollment.upsert({
        where: { courseId_employeeId: { courseId: course.id, employeeId } },
        create: {
          courseId: course.id,
          employeeId,
          status: 'assigned',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          assignedById: ctx.userId,
          source: input.source ?? 'manual',
          expiresAt: course.recertificationMonths
            ? addMonths(new Date(), course.recertificationMonths)
            : null,
        },
        update: {
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          status: 'assigned',
        },
      });
      created.push(enrollment.id);
    }
    return { enrolled: created.length, enrollmentIds: created };
  }

  /** Marks progress on a lesson and rolls it up to the enrollment. */
  async trackProgress(
    ctx: RequestContext,
    input: {
      enrollmentId: string;
      lessonId: string;
      blockId?: string;
      completed?: boolean;
      timeSpentSeconds?: number;
    },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const enrollment = await db.enrollment.findFirst({ where: { id: input.enrollmentId } });
    if (!enrollment) throw BusinessException.notFound('Inscripcion');

    const existing = await db.lessonProgress.findFirst({
      where: { enrollmentId: input.enrollmentId, lessonId: input.lessonId },
    });

    const blockState = { ...((existing?.blockState as Record<string, unknown>) ?? {}) };
    if (input.blockId) blockState[input.blockId] = { completed: true, at: new Date().toISOString() };

    const lesson = await db.lesson.findFirst({
      where: { id: input.lessonId },
      include: { content: true },
    });
    const blocks = ((lesson?.content?.blocks as BlockDocument | null)?.blocks ?? []) as Block[];
    const requiredBlocks = blocks.filter((block) => block.required);
    const completedRequired = requiredBlocks.filter(
      (block) => (blockState as Record<string, { completed?: boolean }>)[block.id]?.completed,
    );
    const lessonCompleted =
      input.completed ??
      (requiredBlocks.length > 0 && completedRequired.length === requiredBlocks.length);

    const progressPercent = requiredBlocks.length
      ? Math.round((completedRequired.length / requiredBlocks.length) * 100)
      : lessonCompleted
        ? 100
        : 0;

    await db.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId: input.enrollmentId, lessonId: input.lessonId },
      },
      create: {
        enrollmentId: input.enrollmentId,
        lessonId: input.lessonId,
        isCompleted: Boolean(lessonCompleted),
        progress: progressPercent,
        blockState: blockState as object,
        timeSpentSeconds: input.timeSpentSeconds ?? 0,
        lastViewedAt: new Date(),
        completedAt: lessonCompleted ? new Date() : null,
      },
      update: {
        isCompleted: Boolean(lessonCompleted),
        progress: progressPercent,
        blockState: blockState as object,
        timeSpentSeconds: { increment: input.timeSpentSeconds ?? 0 },
        lastViewedAt: new Date(),
        completedAt: lessonCompleted ? new Date() : null,
      },
    });

    return this.refreshEnrollmentProgress(ctx.companyId, input.enrollmentId);
  }

  async refreshEnrollmentProgress(companyId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, companyId },
      include: { course: { include: { modules: { include: { lessons: true } } } } },
    });
    if (!enrollment) return null;

    const lessons = enrollment.course.modules.flatMap((module) =>
      module.lessons.filter((lesson) => !lesson.deletedAt),
    );
    const required = lessons.filter((lesson) => lesson.isRequired);
    const progressRows = await this.prisma.lessonProgress.findMany({
      where: { enrollmentId, isCompleted: true },
      select: { lessonId: true },
    });
    const completed = new Set(progressRows.map((row) => row.lessonId));
    const done = required.filter((lesson) => completed.has(lesson.id)).length;
    const progress = required.length ? Math.round((done / required.length) * 100) : 0;
    const isCompleted = required.length > 0 && done === required.length;

    const updated = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress,
        status: isCompleted ? 'completed' : progress > 0 ? 'in_progress' : enrollment.status,
        startedAt: enrollment.startedAt ?? new Date(),
        completedAt: isCompleted ? (enrollment.completedAt ?? new Date()) : null,
      },
    });

    if (isCompleted && !enrollment.completedAt) {
      await this.issueCertificate(companyId, enrollmentId);
      await this.events.emitAsync(DOMAIN_EVENTS.COURSE_COMPLETED, {
        companyId,
        enrollmentId,
        courseId: enrollment.courseId,
        employeeId: enrollment.employeeId,
      });
    }

    return updated;
  }

  async issueCertificate(companyId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, companyId },
      include: { course: true },
    });
    if (!enrollment) return null;

    const existing = await this.prisma.certificate.findFirst({ where: { enrollmentId } });
    if (existing) return existing;

    const count = await this.prisma.certificate.count({ where: { companyId } });
    const certificate = await this.prisma.certificate.create({
      data: {
        companyId,
        employeeId: enrollment.employeeId,
        courseId: enrollment.courseId,
        enrollmentId,
        title: `Certificado - ${enrollment.course.title}`,
        code: `CERT-${String(count + 1).padStart(6, '0')}`,
        issuedAt: new Date(),
        expiresAt: enrollment.course.recertificationMonths
          ? addMonths(new Date(), enrollment.course.recertificationMonths)
          : null,
        score: enrollment.score,
      },
    });

    await this.events.emitAsync(DOMAIN_EVENTS.CERTIFICATE_ISSUED, {
      companyId,
      certificateId: certificate.id,
      employeeId: enrollment.employeeId,
    });

    return certificate;
  }

  /* -------------------------------- quizzes ----------------------------- */

  async submitQuiz(
    ctx: RequestContext,
    quizId: string,
    answers: Record<string, string[] | string>,
    enrollmentId?: string | null,
  ) {
    if (!ctx.employeeId) throw BusinessException.forbidden('Solo un colaborador puede responder');
    const db = this.prisma.forCompany(ctx.companyId);
    const quiz = await db.quiz.findFirst({
      where: { id: quizId, deletedAt: null },
      include: { questions: { include: { options: true }, where: { deletedAt: null } } },
    });
    if (!quiz) throw BusinessException.notFound('Cuestionario');

    const attempts = await db.quizAttempt.count({
      where: { quizId, employeeId: ctx.employeeId },
    });
    if (attempts >= quiz.maxAttempts) {
      throw new BusinessException(
        ERROR_CODES.QUIZ_NO_ATTEMPTS_LEFT,
        `Ya utilizo los ${quiz.maxAttempts} intentos permitidos`,
        409,
      );
    }

    let score = 0;
    let maxScore = 0;
    const detail: Record<string, { correct: boolean; points: number }> = {};

    for (const question of quiz.questions) {
      maxScore += question.points;
      const given = answers[question.id];
      const givenIds = Array.isArray(given) ? given : given ? [given] : [];
      const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
      const correct =
        correctIds.length === givenIds.length && correctIds.every((id) => givenIds.includes(id));
      if (correct) score += question.points;
      detail[question.id] = { correct, points: correct ? question.points : 0 };
    }

    const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const passed = percentage >= quiz.passingScore;

    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        enrollmentId: enrollmentId ?? null,
        employeeId: ctx.employeeId,
        attemptNumber: attempts + 1,
        score: percentage,
        maxScore: 100,
        passed,
        submittedAt: new Date(),
        answers: { given: answers, detail } as object,
      },
    });

    if (enrollmentId && passed && quiz.lessonId) {
      await this.trackProgress(ctx, { enrollmentId, lessonId: quiz.lessonId, completed: true });
      await db.enrollment.update({
        where: { id: enrollmentId },
        data: { score: percentage },
      });
    }

    return {
      attemptId: attempt.id,
      score: percentage,
      passed,
      passingScore: quiz.passingScore,
      attemptsLeft: quiz.maxAttempts - (attempts + 1),
      detail: quiz.showAnswers ? detail : undefined,
    };
  }

  /* --------------------------------- KPIs ------------------------------- */

  async metrics(ctx: RequestContext) {
    const companyId = ctx.companyId;
    const [totals, mandatory, byStatus, hours] = await Promise.all([
      this.prisma.enrollment.count({ where: { companyId } }),
      this.prisma.enrollment.findMany({
        where: { companyId, course: { isMandatory: true } },
        select: { status: true },
      }),
      this.prisma.enrollment.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.enrollment.aggregate({
        where: { companyId },
        _sum: { timeSpentMinutes: true },
        _avg: { score: true },
      }),
    ]);

    const mandatoryDone = mandatory.filter((e) => e.status === 'completed').length;
    const activeEmployees = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, status: 'active' },
    });

    return {
      enrollments: totals,
      completionRate: totals
        ? Number(
            (
              ((byStatus.find((s) => s.status === 'completed')?._count._all ?? 0) / totals) *
              100
            ).toFixed(1),
          )
        : 0,
      mandatoryCompliance: mandatory.length
        ? Number(((mandatoryDone / mandatory.length) * 100).toFixed(1))
        : 100,
      averageScore: Number((Number(hours._avg.score ?? 0)).toFixed(1)),
      hoursPerEmployee: activeEmployees
        ? Number(((hours._sum.timeSpentMinutes ?? 0) / 60 / activeEmployees).toFixed(1))
        : 0,
      byStatus: byStatus.map((row) => ({ label: row.status, value: row._count._all })),
    };
  }
}
