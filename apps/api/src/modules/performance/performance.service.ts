import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type ReviewerRelation } from '@prisma/client';
import { DOMAIN_EVENTS, round } from '@talento/shared';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { NotificationsService } from '../../core/notifications/notifications.service';

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  /* ------------------------------ objectives ---------------------------- */

  async upsertObjective(ctx: RequestContext, input: Record<string, any>, id?: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const { keyResults, ...rest } = input;

    const objective = id
      ? await db.objective.update({
          where: { id },
          data: {
            ...rest,
            startDate: rest.startDate ? new Date(rest.startDate) : null,
            dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
          },
        })
      : await db.objective.create({
          data: {
            ...rest,
            startDate: rest.startDate ? new Date(rest.startDate) : null,
            dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
            createdById: ctx.userId,
          },
        });

    if (Array.isArray(keyResults)) {
      const keep: string[] = [];
      for (const [index, kr] of keyResults.entries()) {
        if (kr.id) {
          await db.keyResult.update({
            where: { id: kr.id },
            data: {
              title: kr.title,
              metric: kr.metric ?? null,
              startValue: new Prisma.Decimal(kr.startValue ?? 0),
              targetValue: new Prisma.Decimal(kr.targetValue),
              currentValue: new Prisma.Decimal(kr.currentValue ?? 0),
              weight: new Prisma.Decimal(kr.weight ?? 100),
              position: index,
            },
          });
          keep.push(kr.id);
        } else {
          const created = await db.keyResult.create({
            data: {
              objectiveId: objective.id,
              title: kr.title,
              metric: kr.metric ?? null,
              startValue: new Prisma.Decimal(kr.startValue ?? 0),
              targetValue: new Prisma.Decimal(kr.targetValue),
              currentValue: new Prisma.Decimal(kr.currentValue ?? 0),
              weight: new Prisma.Decimal(kr.weight ?? 100),
              position: index,
            },
          });
          keep.push(created.id);
        }
      }
      await db.keyResult.deleteMany({
        where: { objectiveId: objective.id, id: { notIn: keep.length ? keep : ['-'] } },
      });
    }

    await this.refreshObjectiveProgress(ctx.companyId, objective.id);
    return db.objective.findFirst({ where: { id: objective.id }, include: { keyResults: true } });
  }

  /** Weighted progress of an objective from its key results. */
  async refreshObjectiveProgress(companyId: string, objectiveId: string) {
    const keyResults = await this.prisma.keyResult.findMany({
      where: { companyId, objectiveId },
    });
    if (!keyResults.length) return null;

    let weighted = 0;
    let totalWeight = 0;
    for (const kr of keyResults) {
      const start = Number(kr.startValue);
      const target = Number(kr.targetValue);
      const current = Number(kr.currentValue);
      const span = target - start;
      const ratio = span === 0 ? (current >= target ? 1 : 0) : (current - start) / span;
      const clamped = Math.max(0, Math.min(1, ratio));
      const weight = Number(kr.weight) || 1;
      weighted += clamped * weight;
      totalWeight += weight;
    }
    const progress = totalWeight ? round((weighted / totalWeight) * 100, 2) : 0;

    return this.prisma.objective.update({
      where: { id: objectiveId },
      data: { progress: new Prisma.Decimal(progress) },
    });
  }

  async checkIn(
    ctx: RequestContext,
    input: { keyResultId: string; value: number; confidence: string; comment?: string | null },
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const keyResult = await db.keyResult.findFirst({ where: { id: input.keyResultId } });
    if (!keyResult) throw BusinessException.notFound('Resultado clave');

    await db.krCheckin.create({
      data: {
        keyResultId: input.keyResultId,
        value: new Prisma.Decimal(input.value),
        confidence: input.confidence as never,
        comment: input.comment ?? null,
        createdById: ctx.userId,
      },
    });
    await db.keyResult.update({
      where: { id: input.keyResultId },
      data: {
        currentValue: new Prisma.Decimal(input.value),
        confidence: input.confidence as never,
      },
    });
    return this.refreshObjectiveProgress(ctx.companyId, keyResult.objectiveId);
  }

  /* --------------------------- review cycles ---------------------------- */

  /**
   * Builds the evaluator matrix of a cycle: self assessment, manager, peers
   * (same department) and direct reports, according to the cycle type.
   */
  async generateAssignments(
    ctx: RequestContext,
    cycleId: string,
    options: { employeeIds?: string[]; peersPerEmployee?: number } = {},
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const cycle = await db.reviewCycle.findFirst({ where: { id: cycleId, deletedAt: null } });
    if (!cycle) throw BusinessException.notFound('Ciclo de evaluacion');

    const employees = await db.employee.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        ...(options.employeeIds?.length ? { id: { in: options.employeeIds } } : {}),
      },
      select: { id: true, managerId: true, departmentId: true },
    });

    const peersPerEmployee = options.peersPerEmployee ?? 3;
    let created = 0;

    const add = async (subjectId: string, reviewerId: string, relation: ReviewerRelation) => {
      if (!reviewerId) return;
      await db.reviewAssignment.upsert({
        where: {
          cycleId_subjectEmployeeId_reviewerEmployeeId_relation: {
            cycleId,
            subjectEmployeeId: subjectId,
            reviewerEmployeeId: reviewerId,
            relation,
          },
        },
        create: {
          cycleId,
          subjectEmployeeId: subjectId,
          reviewerEmployeeId: reviewerId,
          relationType: relation,
        },
        update: {},
      });
      created += 1;
    };

    for (const employee of employees) {
      await add(employee.id, employee.id, 'self');
      if (employee.managerId) await add(employee.id, employee.managerId, 'manager');

      if (cycle.type === 'one_eighty' || cycle.type === 'three_sixty') {
        const peers = employees
          .filter(
            (other) =>
              other.id !== employee.id &&
              other.departmentId &&
              other.departmentId === employee.departmentId,
          )
          .slice(0, peersPerEmployee);
        for (const peer of peers) await add(employee.id, peer.id, 'peer');
      }

      if (cycle.type === 'three_sixty') {
        const reports = employees.filter((other) => other.managerId === employee.id);
        for (const report of reports) await add(employee.id, report.id, 'direct_report');
      }
    }

    await this.events.emitAsync(DOMAIN_EVENTS.REVIEW_CYCLE_OPENED, {
      companyId: ctx.companyId,
      cycleId,
      assignments: created,
    });

    return { assignments: created, employees: employees.length };
  }

  async submitReview(
    ctx: RequestContext,
    assignmentId: string,
    responses: Array<{
      questionKey: string;
      competencyId?: string | null;
      objectiveId?: string | null;
      rating?: number | null;
      answer?: unknown;
      comment?: string | null;
    }>,
  ) {
    const db = this.prisma.forCompany(ctx.companyId);
    const assignment = await db.reviewAssignment.findFirst({
      where: { id: assignmentId },
      include: { cycle: true },
    });
    if (!assignment) throw BusinessException.notFound('Evaluacion asignada');
    if (assignment.reviewerEmployeeId !== ctx.employeeId && !ctx.isSuperadmin) {
      throw BusinessException.forbidden('Solo el evaluador asignado puede responder');
    }
    if (assignment.cycle.status === 'closed') {
      throw BusinessException.validation('El ciclo de evaluacion esta cerrado');
    }

    for (const response of responses) {
      await db.reviewResponse.upsert({
        where: {
          assignmentId_questionKey: { assignmentId, questionKey: response.questionKey },
        },
        create: {
          assignmentId,
          questionKey: response.questionKey,
          competencyId: response.competencyId ?? null,
          objectiveId: response.objectiveId ?? null,
          rating: response.rating != null ? new Prisma.Decimal(response.rating) : null,
          answer: (response.answer ?? null) as object,
          comment: response.comment ?? null,
        },
        update: {
          rating: response.rating != null ? new Prisma.Decimal(response.rating) : null,
          answer: (response.answer ?? null) as object,
          comment: response.comment ?? null,
        },
      });
    }

    const ratings = responses.filter((r) => typeof r.rating === 'number').map((r) => r.rating!);
    const overall = ratings.length
      ? round(ratings.reduce((a, b) => a + b, 0) / ratings.length, 2)
      : null;

    const updated = await db.reviewAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        overallScore: overall != null ? new Prisma.Decimal(overall) : null,
      },
    });

    await this.events.emitAsync(DOMAIN_EVENTS.REVIEW_SUBMITTED, {
      companyId: ctx.companyId,
      assignmentId,
      cycleId: assignment.cycleId,
      subjectEmployeeId: assignment.subjectEmployeeId,
    });

    return updated;
  }

  /** Individual report: scores by relation, competency gaps and objectives. */
  async individualReport(ctx: RequestContext, cycleId: string, employeeId: string) {
    const db = this.prisma.forCompany(ctx.companyId);
    const [cycle, employee, assignments] = await Promise.all([
      db.reviewCycle.findFirst({ where: { id: cycleId } }),
      db.employee.findFirst({
        where: { id: employeeId },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          hiredAt: true,
          position: { select: { name: true, id: true } },
          department: { select: { name: true } },
          manager: { select: { fullName: true } },
        },
      }),
      db.reviewAssignment.findMany({
        where: { cycleId, subjectEmployeeId: employeeId },
        include: { responses: true, reviewer: { select: { id: true, fullName: true } } },
      }),
    ]);
    if (!cycle || !employee) throw BusinessException.notFound('Evaluacion');

    const byRelation: Record<string, { count: number; average: number | null }> = {};
    for (const assignment of assignments) {
      const key = assignment.relationType;
      const ratings = assignment.responses
        .filter((r) => r.rating != null)
        .map((r) => Number(r.rating));
      const average = ratings.length
        ? round(ratings.reduce((a, b) => a + b, 0) / ratings.length, 2)
        : null;
      if (!byRelation[key]) byRelation[key] = { count: 0, average: null };
      byRelation[key].count += 1;
      if (average != null) {
        byRelation[key].average =
          byRelation[key].average == null
            ? average
            : round((byRelation[key].average! + average) / 2, 2);
      }
    }

    // Competency gaps against the profile required by the position.
    const competencyScores = new Map<string, { sum: number; count: number }>();
    for (const assignment of assignments) {
      // Peer and direct report answers stay anonymous when the cycle says so.
      for (const response of assignment.responses) {
        if (!response.competencyId || response.rating == null) continue;
        const entry = competencyScores.get(response.competencyId) ?? { sum: 0, count: 0 };
        entry.sum += Number(response.rating);
        entry.count += 1;
        competencyScores.set(response.competencyId, entry);
      }
    }

    const requirements = employee.position
      ? await db.positionCompetency.findMany({
          where: { positionId: employee.position.id },
          include: { competency: { select: { id: true, name: true } } },
        })
      : [];

    const gaps = requirements.map((requirement) => {
      const actual = competencyScores.get(requirement.competencyId);
      const score = actual ? round(actual.sum / actual.count, 2) : null;
      return {
        competencyId: requirement.competencyId,
        competency: requirement.competency.name,
        requiredLevel: requirement.requiredLevel,
        actualLevel: score,
        gap: score != null ? round(score - requirement.requiredLevel, 2) : null,
      };
    });

    const objectives = await db.objective.findMany({
      where: { ownerEmployeeId: employeeId, deletedAt: null },
      include: { keyResults: true, cycle: { select: { name: true } } },
    });

    const placement = await db.nineBoxPlacement.findFirst({
      where: { cycleId, employeeId },
    });

    const allRatings = assignments.flatMap((a) =>
      a.responses.filter((r) => r.rating != null).map((r) => Number(r.rating)),
    );
    const overall = allRatings.length
      ? round(allRatings.reduce((a, b) => a + b, 0) / allRatings.length, 2)
      : null;

    return {
      cycle: { id: cycle.id, name: cycle.name, type: cycle.type, status: cycle.status },
      employee,
      overallScore: overall,
      byRelation,
      competencyGaps: gaps,
      objectives,
      ninebox: placement,
      completion: {
        total: assignments.length,
        submitted: assignments.filter((a) => a.status === 'submitted').length,
      },
    };
  }

  /** 9-box distribution for the calibration session. */
  async nineBox(ctx: RequestContext, cycleId: string) {
    const placements = await this.prisma.nineBoxPlacement.findMany({
      where: { companyId: ctx.companyId, cycleId },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            position: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    const grid: Record<number, typeof placements> = {};
    for (let box = 1; box <= 9; box += 1) grid[box] = [];
    for (const placement of placements) grid[placement.box]?.push(placement);
    return grid;
  }

  async setNineBox(
    ctx: RequestContext,
    input: {
      cycleId: string;
      employeeId: string;
      performance: number;
      potential: number;
      notes?: string | null;
    },
  ) {
    // Box numbering: 1 bottom-left to 9 top-right.
    const box = (input.potential - 1) * 3 + input.performance;
    return this.prisma.nineBoxPlacement.upsert({
      where: { cycleId_employeeId: { cycleId: input.cycleId, employeeId: input.employeeId } },
      create: {
        companyId: ctx.companyId,
        cycleId: input.cycleId,
        employeeId: input.employeeId,
        performance: input.performance,
        potential: input.potential,
        box,
        calibratedById: ctx.userId,
        notes: input.notes ?? null,
      },
      update: {
        performance: input.performance,
        potential: input.potential,
        box,
        calibratedById: ctx.userId,
        notes: input.notes ?? null,
      },
    });
  }

  async metrics(ctx: RequestContext) {
    const companyId = ctx.companyId;
    const [objectives, cycles, assignments, plans] = await Promise.all([
      this.prisma.objective.aggregate({
        where: { companyId, deletedAt: null, status: 'active' },
        _avg: { progress: true },
        _count: { _all: true },
      }),
      this.prisma.reviewCycle.count({
        where: { companyId, deletedAt: null, status: { notIn: ['draft', 'closed'] } },
      }),
      this.prisma.reviewAssignment.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.developmentPlan.count({
        where: { companyId, deletedAt: null, status: 'active' },
      }),
    ]);

    const total = assignments.reduce((acc, row) => acc + row._count._all, 0);
    const submitted = assignments.find((row) => row.status === 'submitted')?._count._all ?? 0;

    return {
      activeObjectives: objectives._count._all,
      averageProgress: round(Number(objectives._avg.progress ?? 0), 1),
      activeCycles: cycles,
      reviewCompletion: total ? round((submitted / total) * 100, 1) : 0,
      activeDevelopmentPlans: plans,
    };
  }
}
