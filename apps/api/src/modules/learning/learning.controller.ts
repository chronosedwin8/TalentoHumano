import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  blockDocumentSchema,
  courseSchema,
  isoDate,
  lessonContentSchema,
  lessonSchema,
  MODULES,
  uuid,
  type BlockDocument,
} from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule, RequirePermission } from '../../common/decorators';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { defined, listPaged, softDelete } from '../../common/utils/crud';
import { FilesService } from '../../core/files/files.service';
import { LearningService } from './learning.service';

const moduleSchema = z.object({
  courseId: uuid,
  title: z.string().trim().min(2).max(200),
  summary: z.string().max(1000).nullable().optional(),
  position: z.number().int().min(0).default(0),
});

const quizSchema = z.object({
  lessonId: uuid.nullable().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(1000).nullable().optional(),
  passingScore: z.number().int().min(0).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  timeLimitMinutes: z.number().int().min(1).max(600).nullable().optional(),
  shuffleQuestions: z.boolean().default(true),
  showAnswers: z.boolean().default(true),
  questions: z
    .array(
      z.object({
        text: z.string().min(1).max(4000),
        type: z
          .enum(['single_choice', 'multiple_choice', 'true_false', 'short_text', 'long_text', 'numeric'])
          .default('single_choice'),
        points: z.number().int().min(1).max(100).default(1),
        explanation: z.string().max(2000).nullable().optional(),
        options: z
          .array(z.object({ text: z.string().max(1000), isCorrect: z.boolean().default(false) }))
          .default([]),
      }),
    )
    .default([]),
});

const enrollSchema = z.object({
  courseId: uuid,
  employeeIds: z.array(uuid).min(1).max(2000),
  dueDate: isoDate.nullable().optional(),
  source: z.string().max(30).default('manual'),
});

const progressSchema = z.object({
  enrollmentId: uuid,
  lessonId: uuid,
  blockId: z.string().max(80).optional(),
  completed: z.boolean().optional(),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
});

const sessionSchema = z.object({
  courseId: uuid.nullable().optional(),
  title: z.string().trim().min(2).max(200),
  modality: z.enum(['onsite', 'virtual', 'hybrid']).default('onsite'),
  startsAt: z.string(),
  endsAt: z.string(),
  locationText: z.string().max(300).nullable().optional(),
  meetingUrl: z.string().max(500).nullable().optional(),
  capacity: z.number().int().min(1).max(1000).nullable().optional(),
  instructorEmployeeId: uuid.nullable().optional(),
  externalInstructor: z.string().max(200).nullable().optional(),
});

const patternSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  blocks: blockDocumentSchema,
  isSynced: z.boolean().default(false),
});

const mediaSchema = z.object({
  fileId: uuid,
  folderId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(260),
  altText: z.string().max(500).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  kind: z.enum(['image', 'video', 'audio', 'document']).default('image'),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  durationSeconds: z.number().int().nullable().optional(),
  tags: z.array(z.string().max(40)).default([]),
});

@ApiTags('formacion')
@Controller({ path: 'learning', version: '1' })
@RequireModule(MODULES.LEARNING)
export class LearningController {
  constructor(
    private readonly learning: LearningService,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  /* ------------------------------- courses ------------------------------ */

  @Get('courses')
  @RequirePermission('learning.course.read')
  @ApiOperation({ summary: 'Catalogo de cursos' })
  async courses(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; status?: string; category?: string; search?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).course, query, {
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { enrollments: true, modules: true } } },
      defaultSort: { createdAt: 'desc' },
      sortable: ['title', 'createdAt', 'publishedAt'],
    });
  }

  @Get('courses/:id')
  @RequirePermission('learning.course.read')
  @ApiOperation({ summary: 'Curso con su estructura de modulos y lecciones' })
  async course(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const course = await this.prisma.forCompany(ctx.companyId).course.findFirst({
      where: { id, deletedAt: null },
      include: {
        modules: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              include: { content: { select: { version: true, isPublished: true, updatedAt: true } } },
            },
          },
        },
      },
    });
    if (!course) throw BusinessException.notFound('Curso');
    return course;
  }

  @Post('courses')
  @RequirePermission('learning.course.create')
  @Audit({ entityType: 'course' })
  @ApiOperation({ summary: 'Crea un curso' })
  async createCourse(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(courseSchema)) dto: z.infer<typeof courseSchema>,
  ) {
    return this.learning.createCourse(ctx, dto);
  }

  @Patch('courses/:id')
  @RequirePermission('learning.course.update')
  @Audit({ entityType: 'course' })
  @ApiOperation({ summary: 'Actualiza un curso' })
  async updateCourse(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(courseSchema.partial())) dto: Record<string, unknown>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    await db.course.updateMany({
      where: { id },
      data: { ...defined(dto), updatedById: ctx.userId } as never,
    });
    return db.course.findFirst({ where: { id } });
  }

  @Post('courses/:id/publish')
  @RequirePermission('learning.course.publish')
  @Audit({ entityType: 'course', action: 'update' })
  @ApiOperation({ summary: 'Publica el curso' })
  async publishCourse(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).course.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  @Delete('courses/:id')
  @RequirePermission('learning.course.delete')
  @Audit({ entityType: 'course', action: 'delete' })
  @ApiOperation({ summary: 'Archiva un curso' })
  async removeCourse(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return softDelete(this.prisma.forCompany(ctx.companyId).course, id, ctx.userId);
  }

  /* ------------------------- modules and lessons ------------------------ */

  @Post('modules')
  @RequirePermission('learning.lesson.create')
  @Audit({ entityType: 'course_module' })
  @ApiOperation({ summary: 'Crea un modulo dentro de un curso' })
  async createModule(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(moduleSchema)) dto: z.infer<typeof moduleSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).courseModule.create({ data: dto });
  }

  @Post('lessons')
  @RequirePermission('learning.lesson.create')
  @Audit({ entityType: 'lesson' })
  @ApiOperation({ summary: 'Crea una leccion' })
  async createLesson(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(lessonSchema)) dto: z.infer<typeof lessonSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).lesson.create({ data: dto });
  }

  @Get('lessons/:id')
  @RequirePermission('learning.lesson.read')
  @ApiOperation({ summary: 'Leccion con su documento de bloques' })
  async lesson(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    const lesson = await this.prisma.forCompany(ctx.companyId).lesson.findFirst({
      where: { id, deletedAt: null },
      include: {
        content: true,
        quizzes: { include: { questions: { include: { options: true } } } },
        module: { select: { id: true, title: true, courseId: true } },
      },
    });
    if (!lesson) throw BusinessException.notFound('Leccion');
    return lesson;
  }

  @Post('lessons/:id/content')
  @RequirePermission('learning.lesson.update')
  @Audit({ entityType: 'lesson_content' })
  @ApiOperation({ summary: 'Guarda el borrador o publica el contenido por bloques' })
  async saveLessonContent(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(lessonContentSchema)) dto: z.infer<typeof lessonContentSchema>,
  ) {
    return this.learning.saveLessonContent(
      ctx,
      id,
      dto.blocks as BlockDocument,
      dto.publish,
      dto.changeNote,
    );
  }

  @Get('lessons/:id/versions')
  @RequirePermission('learning.lesson.read')
  @ApiOperation({ summary: 'Historial de versiones del contenido' })
  async lessonVersions(@Ctx() ctx: RequestContext, @Param('id', new ZodValidationPipe(uuid)) id: string) {
    return this.prisma.forCompany(ctx.companyId).lessonContentVersion.findMany({
      where: { lessonId: id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, changeNote: true, createdAt: true, createdById: true },
    });
  }

  @Post('lessons/:id/versions/:version/restore')
  @RequirePermission('learning.lesson.update')
  @Audit({ entityType: 'lesson_content', action: 'update' })
  @ApiOperation({ summary: 'Restaura una version anterior del contenido' })
  async restoreVersion(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Param('version') version: string,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const snapshot = await db.lessonContentVersion.findFirst({
      where: { lessonId: id, version: Number(version) },
    });
    if (!snapshot) throw BusinessException.notFound('Version');
    return this.learning.saveLessonContent(
      ctx,
      id,
      snapshot.blocks as unknown as BlockDocument,
      true,
      `Restauracion de la version ${version}`,
    );
  }

  /* ------------------------------- patterns ----------------------------- */

  @Get('patterns')
  @RequirePermission('learning.lesson.read')
  @ApiOperation({ summary: 'Patrones reutilizables de bloques' })
  async patterns(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).contentPattern.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  @Post('patterns')
  @RequirePermission('learning.pattern.manage')
  @Audit({ entityType: 'content_pattern' })
  @ApiOperation({ summary: 'Guarda un conjunto de bloques como patron' })
  async createPattern(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(patternSchema)) dto: z.infer<typeof patternSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).contentPattern.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? null,
        blocks: dto.blocks as object,
        isSynced: dto.isSynced,
        createdById: ctx.userId,
      },
    });
  }

  /* --------------------------- media library ---------------------------- */

  @Get('media')
  @RequirePermission('learning.media.read')
  @ApiOperation({ summary: 'Galeria de medios de la empresa' })
  async media(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; kind?: string; search?: string; folderId?: string },
  ) {
    const result = await listPaged(this.prisma.forCompany(ctx.companyId).mediaItem, query, {
      where: {
        deletedAt: null,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.folderId ? { folderId: query.folderId } : {}),
        ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: { file: true },
      defaultSort: { createdAt: 'desc' },
    });
    const data = await Promise.all(
      result.data.map(async (item: any) => ({
        ...item,
        file: await this.files.present(item.file),
      })),
    );
    return { data, meta: result.meta };
  }

  @Post('media')
  @RequirePermission('learning.media.upload')
  @Audit({ entityType: 'media_item' })
  @ApiOperation({ summary: 'Registra un archivo en la galeria de medios' })
  async addMedia(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(mediaSchema)) dto: z.infer<typeof mediaSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).mediaItem.create({
      data: { ...dto, createdById: ctx.userId },
    });
  }

  @Get('embed-providers')
  @RequirePermission('learning.lesson.read')
  @ApiOperation({ summary: 'Lista blanca de proveedores de embed' })
  async embedProviders(@Ctx() ctx: RequestContext) {
    const providers = await this.prisma.forCompany(ctx.companyId).embedProvider.findMany({
      orderBy: { name: 'asc' },
    });
    if (!providers.length) {
      await this.learning.ensureDefaultEmbedProviders(ctx.companyId);
      return this.prisma.forCompany(ctx.companyId).embedProvider.findMany({ orderBy: { name: 'asc' } });
    }
    return providers;
  }

  @Post('embed-providers')
  @RequirePermission('learning.embedprovider.manage')
  @Audit({ entityType: 'embed_provider' })
  @ApiOperation({ summary: 'Agrega un dominio a la lista blanca de embeds' })
  async addEmbedProvider(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(120),
          domain: z.string().trim().min(3).max(160),
          oembedUrl: z.string().max(400).nullable().optional(),
          iframeAllow: z.string().max(300).nullable().optional(),
          isActive: z.boolean().default(true),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).embedProvider.create({ data: dto as never });
  }

  /* -------------------------------- quizzes ----------------------------- */

  @Post('quizzes')
  @RequirePermission('learning.quiz.manage')
  @Audit({ entityType: 'quiz' })
  @ApiOperation({ summary: 'Crea un cuestionario con sus preguntas' })
  async createQuiz(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(quizSchema)) dto: z.infer<typeof quizSchema>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { questions, ...rest } = dto;
    const quiz = await db.quiz.create({ data: rest as never });
    for (const [index, question] of questions.entries()) {
      const created = await db.question.create({
        data: {
          quizId: quiz.id,
          text: question.text,
          type: question.type,
          points: question.points,
          explanation: question.explanation ?? null,
          position: index,
        },
      });
      if (question.options.length) {
        await db.questionOption.createMany({
          data: question.options.map((option, optionIndex) => ({
            questionId: created.id,
            text: option.text,
            isCorrect: option.isCorrect,
            position: optionIndex,
          })),
        });
      }
    }
    return db.quiz.findFirst({
      where: { id: quiz.id },
      include: { questions: { include: { options: true } } },
    });
  }

  @Post('quizzes/:id/submit')
  @RequirePermission('learning.progress.read')
  @Audit({ entityType: 'quiz_attempt' })
  @ApiOperation({ summary: 'Envia las respuestas del cuestionario' })
  async submitQuiz(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          answers: z.record(z.union([z.string(), z.array(z.string())])),
          enrollmentId: uuid.nullable().optional(),
        }),
      ),
    )
    dto: { answers: Record<string, string | string[]>; enrollmentId?: string | null },
  ) {
    return this.learning.submitQuiz(ctx, id, dto.answers, dto.enrollmentId);
  }

  /* ----------------------------- enrollments ---------------------------- */

  @Get('enrollments')
  @RequirePermission('learning.enrollment.read')
  @ApiOperation({ summary: 'Inscripciones a cursos' })
  async enrollments(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; courseId?: string; employeeId?: string; status?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).enrollment, query, {
      where: {
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        course: { select: { id: true, title: true, isMandatory: true } },
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
      defaultSort: { createdAt: 'desc' },
      sortable: ['createdAt', 'dueDate', 'progress'],
    });
  }

  @Post('enrollments')
  @RequirePermission('learning.enrollment.create')
  @Audit({ entityType: 'enrollment' })
  @ApiOperation({ summary: 'Inscribe colaboradores a un curso' })
  async enroll(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(enrollSchema)) dto: z.infer<typeof enrollSchema>,
  ) {
    return this.learning.enroll(ctx, dto);
  }

  @Get('my-courses')
  @RequirePermission('learning.course.read')
  @ApiOperation({ summary: 'Cursos del colaborador autenticado' })
  async myCourses(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.enrollment.findMany({
      where: { companyId: ctx.companyId, employeeId: ctx.employeeId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            summary: true,
            category: true,
            estimatedMinutes: true,
            isMandatory: true,
            coverFileId: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  @Post('progress')
  @RequirePermission('learning.progress.read')
  @ApiOperation({ summary: 'Registra avance en una leccion o bloque' })
  async trackProgress(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(progressSchema)) dto: z.infer<typeof progressSchema>,
  ) {
    return this.learning.trackProgress(ctx, dto);
  }

  /* ------------------------------- sessions ----------------------------- */

  @Get('sessions')
  @RequirePermission('learning.session.read')
  @ApiOperation({ summary: 'Sesiones presenciales y virtuales' })
  async sessions(@Ctx() ctx: RequestContext, @Query() query: { page?: string; limit?: string }) {
    return listPaged(this.prisma.forCompany(ctx.companyId).trainingSession, query, {
      where: { deletedAt: null },
      include: { course: { select: { id: true, title: true } }, _count: { select: { attendance: true } } },
      defaultSort: { startsAt: 'desc' },
      sortable: ['startsAt'],
    });
  }

  @Post('sessions')
  @RequirePermission('learning.session.create')
  @Audit({ entityType: 'training_session' })
  @ApiOperation({ summary: 'Programa una sesion de capacitacion' })
  async createSession(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(sessionSchema)) dto: z.infer<typeof sessionSchema>,
  ) {
    return this.prisma.forCompany(ctx.companyId).trainingSession.create({
      data: {
        ...dto,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        attendanceToken: Math.random().toString(36).slice(2, 14),
      } as never,
    });
  }

  @Post('sessions/:id/attendance')
  @RequirePermission('learning.session.update')
  @Audit({ entityType: 'session_attendance' })
  @ApiOperation({ summary: 'Registra asistencia a una sesion' })
  async markAttendance(
    @Ctx() ctx: RequestContext,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Body(new ZodValidationPipe(z.object({ employeeIds: z.array(uuid).min(1) })))
    dto: { employeeIds: string[] },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    for (const employeeId of dto.employeeIds) {
      await db.sessionAttendance.upsert({
        where: { sessionId_employeeId: { sessionId: id, employeeId } },
        create: { sessionId: id, employeeId, attended: true, checkedInAt: new Date() },
        update: { attended: true, checkedInAt: new Date() },
      });
    }
    return { marked: dto.employeeIds.length };
  }

  /* ------------------------------ learning paths ------------------------ */

  @Get('paths')
  @RequirePermission('learning.course.read')
  @ApiOperation({ summary: 'Rutas de aprendizaje' })
  async paths(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).learningPath.findMany({
      where: { deletedAt: null },
      include: { items: { include: { course: { select: { id: true, title: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post('paths')
  @RequirePermission('learning.path.manage')
  @Audit({ entityType: 'learning_path' })
  @ApiOperation({ summary: 'Crea una ruta de aprendizaje por cargo o area' })
  async createPath(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          name: z.string().trim().min(2).max(200),
          description: z.string().max(2000).nullable().optional(),
          positionId: uuid.nullable().optional(),
          departmentId: uuid.nullable().optional(),
          isMandatory: z.boolean().default(false),
          courseIds: z.array(uuid).default([]),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { courseIds, ...rest } = dto;
    const path = await db.learningPath.create({ data: rest as never });
    if (courseIds?.length) {
      await db.learningPathItem.createMany({
        data: courseIds.map((courseId: string, index: number) => ({
          pathId: path.id,
          courseId,
          position: index,
        })),
      });
    }
    return db.learningPath.findFirst({ where: { id: path.id }, include: { items: true } });
  }

  /* ----------------------------- certificates --------------------------- */

  @Get('certificates')
  @RequirePermission('learning.certificate.read')
  @ApiOperation({ summary: 'Certificados emitidos' })
  async certificates(
    @Ctx() ctx: RequestContext,
    @Query() query: { page?: string; limit?: string; employeeId?: string },
  ) {
    return listPaged(this.prisma.forCompany(ctx.companyId).certificate, query, {
      where: { ...(query.employeeId ? { employeeId: query.employeeId } : {}) },
      include: {
        course: { select: { id: true, title: true } },
        employee: { select: { id: true, fullName: true } },
      },
      defaultSort: { issuedAt: 'desc' },
    });
  }

  /* -------------------------------- metrics ----------------------------- */

  @Get('metrics')
  @RequirePermission('learning.progress.read')
  @ApiOperation({ summary: 'Indicadores de formacion' })
  async metrics(@Ctx() ctx: RequestContext) {
    return this.learning.metrics(ctx);
  }

  /* ------------------------------ training plan ------------------------- */

  @Get('plans')
  @RequirePermission('learning.plan.manage')
  @ApiOperation({ summary: 'Plan anual de capacitacion' })
  async plans(@Ctx() ctx: RequestContext) {
    return this.prisma.forCompany(ctx.companyId).trainingPlan.findMany({
      where: { deletedAt: null },
      include: { needs: true },
      orderBy: { year: 'desc' },
    });
  }

  @Post('plans')
  @RequirePermission('learning.plan.manage')
  @Audit({ entityType: 'training_plan' })
  @ApiOperation({ summary: 'Crea el plan anual (presupuesto informativo)' })
  async createPlan(
    @Ctx() ctx: RequestContext,
    @Body(
      new ZodValidationPipe(
        z.object({
          year: z.number().int().min(2020).max(2100),
          name: z.string().trim().min(2).max(200),
          budget: z.number().nonnegative().nullable().optional(),
          notes: z.string().max(4000).nullable().optional(),
        }),
      ),
    )
    dto: Record<string, any>,
  ) {
    return this.prisma.forCompany(ctx.companyId).trainingPlan.create({ data: dto as never });
  }
}
