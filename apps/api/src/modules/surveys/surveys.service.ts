import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  DOMAIN_EVENTS,
  ERROR_CODES,
  SURVEY_ANONYMITY_THRESHOLD,
  percent,
  round,
  seniorityBand,
  type FormSchema,
} from '@talento/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { NotificationsService } from '../../core/notifications/notifications.service';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly encryption: EncryptionService,
    private readonly events: EventEmitter2,
  ) {}

  async createSurvey(ctx: RequestContext, input: Record<string, any>) {
    const db = this.prisma.forCompany(ctx.companyId);
    const survey = await db.survey.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        kind: input.kind ?? 'climate',
        isAnonymous: input.isAnonymous ?? true,
        minSegmentResponses: input.minSegmentResponses ?? SURVEY_ANONYMITY_THRESHOLD,
        opensAt: input.opensAt ? new Date(input.opensAt) : null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        recurrence: input.recurrence ?? null,
        reminderDays: input.reminderDays ?? [],
        createdById: ctx.userId,
      },
    });

    const version = await this.saveVersion(ctx.companyId, survey.id, input.schema as FormSchema);
    await db.survey.update({ where: { id: survey.id }, data: { currentVersionId: version.id } });

    if (input.audiences?.length) {
      await db.surveyAudience.createMany({
        data: input.audiences.map((audience: Record<string, unknown>) => ({
          surveyId: survey.id,
          targetType: audience.targetType,
          targetId: (audience.targetId as string) ?? null,
          filters: (audience.filters ?? {}) as object,
        })),
      });
    }

    return db.survey.findFirst({
      where: { id: survey.id },
      include: { versions: true, audiences: true },
    });
  }

  /** Stores a new schema version and materialises its questions. */
  async saveVersion(companyId: string, surveyId: string, schema: FormSchema) {
    const db = this.prisma.forCompany(companyId);
    const last = await db.surveyVersion.findFirst({
      where: { surveyId },
      orderBy: { version: 'desc' },
    });
    const version = await db.surveyVersion.create({
      data: { surveyId, version: (last?.version ?? 0) + 1, schema: schema as unknown as object },
    });

    for (const [index, field] of (schema.fields ?? []).entries()) {
      if (field.type === 'section') continue;
      await db.surveyQuestion.create({
        data: {
          versionId: version.id,
          key: field.key,
          label: field.label,
          type: field.type,
          dimension: field.dimension ?? null,
          position: index,
          isRequired: Boolean(field.required),
          config: field as unknown as object,
        },
      });
    }
    return version;
  }

  /** Creates one invitation per targeted employee and notifies them. */
  async publish(ctx: RequestContext, surveyId: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const survey = await db.survey.findFirst({
      where: { id: surveyId, deletedAt: null },
      include: { audiences: true },
    });
    if (!survey) throw BusinessException.notFound('Encuesta');

    const employees = await this.targetEmployees(ctx.companyId, survey.audiences);
    for (const employee of employees) {
      await db.surveyInvitation.upsert({
        where: { surveyId_employeeId: { surveyId, employeeId: employee.id } },
        create: {
          surveyId,
          employeeId: employee.id,
          token: this.encryption.randomToken(24),
          sentAt: new Date(),
          segment: {
            departmentId: employee.departmentId,
            locationId: employee.locationId,
            positionId: employee.positionId,
            gender: employee.gender,
            seniority: seniorityBand(employee.hiredAt),
          } as object,
        },
        update: { sentAt: new Date() },
      });
    }

    await db.survey.update({
      where: { id: surveyId },
      data: { status: 'open', opensAt: survey.opensAt ?? new Date() },
    });

    if (employees.length) {
      await this.notifications.notify({
        companyId: ctx.companyId,
        employeeIds: employees.map((employee) => employee.id),
        eventKey: DOMAIN_EVENTS.SURVEY_PUBLISHED,
        title: `Nueva encuesta: ${survey.title}`,
        body: survey.description ?? 'Su opinion es importante.',
        url: '/surveys/mine',
        entityType: 'survey',
        entityId: surveyId,
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.SURVEY_PUBLISHED, {
      companyId: ctx.companyId,
      surveyId,
      invitations: employees.length,
    });

    return { invitations: employees.length };
  }

  private async targetEmployees(
    companyId: string,
    audiences: Array<{ targetType: string; targetId: string | null; filters: Prisma.JsonValue }>,
  ) {
    const base: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
      status: { in: ['active', 'on_leave'] },
    };
    if (!audiences.length || audiences.some((a) => a.targetType === 'all')) {
      return this.prisma.employee.findMany({
        where: base,
        select: {
          id: true,
          departmentId: true,
          locationId: true,
          positionId: true,
          gender: true,
          hiredAt: true,
        },
      });
    }

    const departmentIds = audiences
      .filter((a) => a.targetType === 'department')
      .map((a) => a.targetId!);
    const locationIds = audiences
      .filter((a) => a.targetType === 'location')
      .map((a) => a.targetId!);
    const positionIds = audiences
      .filter((a) => a.targetType === 'position')
      .map((a) => a.targetId!);

    return this.prisma.employee.findMany({
      where: {
        ...base,
        OR: [
          ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
          ...(locationIds.length ? [{ locationId: { in: locationIds } }] : []),
          ...(positionIds.length ? [{ positionId: { in: positionIds } }] : []),
        ],
      },
      select: {
        id: true,
        departmentId: true,
        locationId: true,
        positionId: true,
        gender: true,
        hiredAt: true,
      },
    });
  }

  /**
   * Stores a response. For anonymous surveys the employee id is never written,
   * only the denormalised segment, so results can be sliced without being able
   * to trace an individual answer.
   */
  async submitResponse(
    ctx: RequestContext,
    surveyId: string,
    answers: Record<string, unknown>,
    invitationToken?: string,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const survey = await db.survey.findFirst({ where: { id: surveyId, deletedAt: null } });
    if (!survey) throw BusinessException.notFound('Encuesta');
    if (survey.status !== 'open') {
      throw new BusinessException(ERROR_CODES.SURVEY_CLOSED, 'La encuesta no esta abierta', 409);
    }

    const invitation = invitationToken
      ? await db.surveyInvitation.findFirst({ where: { token: invitationToken, surveyId } })
      : ctx.employeeId
        ? await db.surveyInvitation.findFirst({
            where: { surveyId, employeeId: ctx.employeeId },
          })
        : null;

    if (invitation?.respondedAt) {
      throw new BusinessException(
        ERROR_CODES.SURVEY_ALREADY_ANSWERED,
        'Ya registro su respuesta a esta encuesta',
        409,
      );
    }

    const version = await db.surveyVersion.findFirst({
      where: { surveyId },
      orderBy: { version: 'desc' },
      include: { questions: true },
    });
    if (!version) throw BusinessException.notFound('Version de la encuesta');

    const response = await db.surveyResponse.create({
      data: {
        surveyId,
        versionId: version.id,
        employeeId: survey.isAnonymous ? null : (invitation?.employeeId ?? ctx.employeeId ?? null),
        invitationId: survey.isAnonymous ? null : (invitation?.id ?? null),
        segment: (invitation?.segment ?? {}) as object,
        isComplete: true,
        submittedAt: new Date(),
      },
    });

    for (const question of version.questions) {
      if (!(question.key in answers)) continue;
      const value = answers[question.key];
      const numeric =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))
            ? Number(value)
            : null;
      await db.surveyAnswer.create({
        data: {
          responseId: response.id,
          questionId: question.id,
          questionKey: question.key,
          value: value as object,
          numericValue: numeric != null ? new Prisma.Decimal(numeric) : null,
          textValue: typeof value === 'string' && numeric == null ? value : null,
        },
      });
    }

    if (invitation) {
      await db.surveyInvitation.update({
        where: { id: invitation.id },
        data: { respondedAt: new Date() },
      });
    }

    await this.events.emitAsync(DOMAIN_EVENTS.SURVEY_ANSWERED, {
      companyId: ctx.companyId,
      surveyId,
      responseId: response.id,
    });

    return { responseId: response.id };
  }

  /**
   * Aggregated results. Segments below the anonymity threshold are hidden so
   * an individual answer can never be inferred.
   */
  async results(ctx: RequestContext, surveyId: string, segmentBy?: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const survey = await db.survey.findFirst({
      where: { id: surveyId, deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1, include: { questions: true } },
        _count: { select: { invitations: true, responses: true } },
      },
    });
    if (!survey) throw BusinessException.notFound('Encuesta');

    const version = survey.versions[0];
    const responses = await db.surveyResponse.findMany({
      where: { surveyId, isComplete: true },
      include: { answers: true },
    });

    const participation = percent(responses.length, survey._count.invitations || responses.length);

    const byQuestion = (version?.questions ?? []).map((question) => {
      const answers = responses.flatMap((response) =>
        response.answers.filter((answer) => answer.questionId === question.id),
      );
      const numeric = answers
        .filter((answer) => answer.numericValue != null)
        .map((answer) => Number(answer.numericValue));
      const distribution: Record<string, number> = {};
      for (const answer of answers) {
        const raw = answer.value as unknown;
        const keys = Array.isArray(raw) ? raw.map(String) : [String(raw ?? '')];
        for (const key of keys) distribution[key] = (distribution[key] ?? 0) + 1;
      }

      return {
        key: question.key,
        label: question.label,
        type: question.type,
        dimension: question.dimension,
        responses: answers.length,
        average: numeric.length
          ? round(numeric.reduce((a, b) => a + b, 0) / numeric.length, 2)
          : null,
        distribution,
        textAnswers:
          question.type === 'textarea' || question.type === 'text'
            ? answers
                .map((answer) => answer.textValue)
                .filter(Boolean)
                .slice(0, 200)
            : undefined,
      };
    });

    // eNPS: promoters minus detractors over a 0-10 question.
    const npsQuestion = byQuestion.find((q) => q.type === 'nps');
    let enps: number | null = null;
    if (npsQuestion) {
      const scores = responses
        .flatMap((response) => response.answers)
        .filter((answer) => answer.questionKey === npsQuestion.key && answer.numericValue != null)
        .map((answer) => Number(answer.numericValue));
      if (scores.length) {
        const promoters = scores.filter((score) => score >= 9).length;
        const detractors = scores.filter((score) => score <= 6).length;
        enps = round(((promoters - detractors) / scores.length) * 100, 1);
      }
    }

    // Climate index: average of every Likert question, scaled to 100.
    const likert = byQuestion.filter((q) => q.type === 'likert' && q.average != null);
    const climateIndex = likert.length
      ? round((likert.reduce((acc, q) => acc + (q.average ?? 0), 0) / likert.length / 5) * 100, 1)
      : null;

    let segments: Array<{
      segment: string;
      responses: number;
      average: number | null;
      hidden: boolean;
    }> = [];
    if (segmentBy) {
      const grouped = new Map<string, typeof responses>();
      for (const response of responses) {
        const segment = (response.segment as Record<string, unknown>)?.[segmentBy];
        const key = segment ? String(segment) : 'Sin dato';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(response);
      }
      segments = [...grouped.entries()].map(([segment, rows]) => {
        const hidden = rows.length < survey.minSegmentResponses;
        const numeric = rows
          .flatMap((row) => row.answers)
          .filter((answer) => answer.numericValue != null)
          .map((answer) => Number(answer.numericValue));
        return {
          segment,
          responses: hidden ? 0 : rows.length,
          average:
            hidden || !numeric.length
              ? null
              : round(numeric.reduce((a, b) => a + b, 0) / numeric.length, 2),
          hidden,
        };
      });
    }

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        kind: survey.kind,
        status: survey.status,
        isAnonymous: survey.isAnonymous,
        minSegmentResponses: survey.minSegmentResponses,
      },
      invited: survey._count.invitations,
      responses: responses.length,
      participationRate: participation,
      enps,
      climateIndex,
      byQuestion,
      segments,
    };
  }

  /** Word frequency over open answers; the LLM interface plugs in here. */
  async textAnalysis(ctx: RequestContext, surveyId: string, questionKey: string) {
    const answers = await this.prisma.surveyAnswer.findMany({
      where: { companyId: ctx.companyId, questionKey, response: { surveyId } },
      select: { textValue: true },
    });

    const stopWords = new Set([
      'de',
      'la',
      'que',
      'el',
      'en',
      'y',
      'a',
      'los',
      'se',
      'del',
      'las',
      'un',
      'por',
      'con',
      'no',
      'una',
      'su',
      'para',
      'es',
      'al',
      'lo',
      'como',
      'mas',
      'pero',
      'sus',
      'le',
      'ya',
      'o',
      'este',
      'si',
      'porque',
      'esta',
      'entre',
      'cuando',
      'muy',
      'sin',
      'sobre',
      'tambien',
      'me',
      'hasta',
      'hay',
      'donde',
      'quien',
      'desde',
      'todo',
      'nos',
      'durante',
      'mi',
      'the',
      'and',
      'of',
      'to',
      'in',
    ]);
    const counts = new Map<string, number>();
    for (const answer of answers) {
      if (!answer.textValue) continue;
      const words = answer.textValue
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 3 && !stopWords.has(word));
      for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    }

    return {
      questionKey,
      totalAnswers: answers.length,
      words: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .map(([word, count]) => ({ word, count })),
    };
  }
}
