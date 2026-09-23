import { Injectable, Logger } from '@nestjs/common';
import { Gender, Prisma } from '@prisma/client';
import {
  ageBand,
  percent,
  round,
  seniorityBand,
  toDateKey,
  type AnalyticsFilters,
  type KpiValue,
} from '@talento/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { ScopeService } from '../../core/access/scope.service';
import { enumQuery } from '../../common/utils/crud';

/** Safe datasets exposed to the report builder (no raw SQL from the client). */
export const DATASETS: Record<
  string,
  {
    label: string;
    columns: Array<{ key: string; label: string; type: string }>;
    permission: string;
  }
> = {
  employees: {
    label: 'Colaboradores',
    permission: 'people.employee.read',
    columns: [
      { key: 'employeeCode', label: 'Codigo', type: 'string' },
      { key: 'fullName', label: 'Nombre', type: 'string' },
      { key: 'email', label: 'Correo', type: 'string' },
      { key: 'status', label: 'Estado', type: 'string' },
      { key: 'hiredAt', label: 'Fecha de ingreso', type: 'date' },
      { key: 'terminatedAt', label: 'Fecha de retiro', type: 'date' },
      { key: 'department', label: 'Area', type: 'string' },
      { key: 'position', label: 'Cargo', type: 'string' },
      { key: 'location', label: 'Sede', type: 'string' },
      { key: 'gender', label: 'Genero', type: 'string' },
      { key: 'workModality', label: 'Modalidad', type: 'string' },
      { key: 'seniority', label: 'Antiguedad', type: 'string' },
    ],
  },
  leaves: {
    label: 'Ausencias',
    permission: 'leaves.request.read',
    columns: [
      { key: 'employee', label: 'Colaborador', type: 'string' },
      { key: 'leaveType', label: 'Tipo', type: 'string' },
      { key: 'startDate', label: 'Inicio', type: 'date' },
      { key: 'endDate', label: 'Fin', type: 'date' },
      { key: 'requestedDays', label: 'Dias', type: 'number' },
      { key: 'status', label: 'Estado', type: 'string' },
    ],
  },
  attendance: {
    label: 'Asistencia',
    permission: 'time.attendance.read',
    columns: [
      { key: 'employee', label: 'Colaborador', type: 'string' },
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'status', label: 'Estado', type: 'string' },
      { key: 'workedMinutes', label: 'Minutos trabajados', type: 'number' },
      { key: 'lateMinutes', label: 'Minutos de retardo', type: 'number' },
      { key: 'overtimeMinutes', label: 'Minutos extra (informativo)', type: 'number' },
    ],
  },
  enrollments: {
    label: 'Formacion',
    permission: 'learning.progress.read',
    columns: [
      { key: 'employee', label: 'Colaborador', type: 'string' },
      { key: 'course', label: 'Curso', type: 'string' },
      { key: 'status', label: 'Estado', type: 'string' },
      { key: 'progress', label: 'Avance', type: 'number' },
      { key: 'score', label: 'Calificacion', type: 'number' },
      { key: 'completedAt', label: 'Fecha de finalizacion', type: 'date' },
    ],
  },
  applications: {
    label: 'Postulaciones',
    permission: 'recruiting.application.read',
    columns: [
      { key: 'candidate', label: 'Candidato', type: 'string' },
      { key: 'jobPosting', label: 'Vacante', type: 'string' },
      { key: 'stage', label: 'Etapa', type: 'string' },
      { key: 'status', label: 'Estado', type: 'string' },
      { key: 'source', label: 'Fuente', type: 'string' },
      { key: 'appliedAt', label: 'Fecha de postulacion', type: 'date' },
    ],
  },
  tickets: {
    label: 'Tickets',
    permission: 'helpdesk.ticket.read',
    columns: [
      { key: 'number', label: 'Numero', type: 'number' },
      { key: 'subject', label: 'Asunto', type: 'string' },
      { key: 'category', label: 'Categoria', type: 'string' },
      { key: 'status', label: 'Estado', type: 'string' },
      { key: 'priority', label: 'Prioridad', type: 'string' },
      { key: 'createdAt', label: 'Creado', type: 'date' },
      { key: 'resolvedAt', label: 'Resuelto', type: 'date' },
    ],
  },
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /* ----------------------------- executive ------------------------------ */

  async executiveDashboard(ctx: RequestContext, filters: AnalyticsFilters) {
    const companyId = ctx.companyId;
    const from = filters.from
      ? new Date(filters.from)
      : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const to = filters.to ? new Date(filters.to) : new Date();

    const employeeWhere: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.positionId ? { positionId: filters.positionId } : {}),
      ...(filters.gender ? { gender: enumQuery(filters.gender, Gender, 'gender') } : {}),
    };

    const [
      headcount,
      hires,
      terminations,
      voluntary,
      openJobs,
      mandatoryTraining,
      absences,
      tickets,
      ethics,
      expiring,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { ...employeeWhere, status: 'active' } }),
      this.prisma.employee.count({ where: { ...employeeWhere, hiredAt: { gte: from, lte: to } } }),
      this.prisma.employee.count({
        where: { ...employeeWhere, terminatedAt: { gte: from, lte: to } },
      }),
      this.prisma.employee.count({
        where: {
          ...employeeWhere,
          terminatedAt: { gte: from, lte: to },
          exitReason: { in: ['renuncia', 'mutuo_acuerdo'] },
        },
      }),
      this.prisma.jobPosting.count({ where: { companyId, status: 'published', deletedAt: null } }),
      this.prisma.enrollment.findMany({
        where: { companyId, course: { isMandatory: true } },
        select: { status: true },
      }),
      this.prisma.leaveRequest.aggregate({
        where: {
          companyId,
          deletedAt: null,
          status: { in: ['approved', 'taken'] },
          startDate: { gte: from, lte: to },
        },
        _sum: { requestedDays: true },
      }),
      this.prisma.ticket.count({
        where: { companyId, deletedAt: null, status: { in: ['new', 'open', 'on_hold'] } },
      }),
      this.prisma.ethicsReport.count({
        where: { companyId, status: { in: ['received', 'triaged', 'in_investigation'] } },
      }),
      this.prisma.employeeDocument.count({
        where: {
          companyId,
          deletedAt: null,
          expiresAt: { not: null, lte: new Date(Date.now() + 30 * 86_400_000) },
        },
      }),
    ]);

    const averageHeadcount = headcount + terminations / 2 || 1;
    const turnover = round((terminations / averageHeadcount) * 100, 2);
    const voluntaryTurnover = round((voluntary / averageHeadcount) * 100, 2);
    const workDays = headcount * ((to.getTime() - from.getTime()) / 86_400_000 / 7) * 5 || 1;
    const absenteeism = round((Number(absences._sum.requestedDays ?? 0) / workDays) * 100, 2);

    const mandatoryDone = mandatoryTraining.filter((e) => e.status === 'completed').length;

    const kpis: KpiValue[] = [
      { key: 'headcount', label: 'Colaboradores activos', value: headcount, unit: 'count' },
      { key: 'hires', label: 'Ingresos del periodo', value: hires, unit: 'count' },
      {
        key: 'terminations',
        label: 'Retiros del periodo',
        value: terminations,
        unit: 'count',
        inverse: true,
      },
      { key: 'turnover', label: 'Rotacion', value: turnover, unit: 'percent', inverse: true },
      {
        key: 'voluntaryTurnover',
        label: 'Rotacion voluntaria',
        value: voluntaryTurnover,
        unit: 'percent',
        inverse: true,
      },
      {
        key: 'absenteeism',
        label: 'Ausentismo',
        value: absenteeism,
        unit: 'percent',
        inverse: true,
      },
      { key: 'openJobs', label: 'Vacantes abiertas', value: openJobs, unit: 'count' },
      {
        key: 'mandatoryTraining',
        label: 'Formacion obligatoria al dia',
        value: mandatoryTraining.length ? percent(mandatoryDone, mandatoryTraining.length) : 100,
        unit: 'percent',
      },
      {
        key: 'openTickets',
        label: 'Tickets abiertos',
        value: tickets,
        unit: 'count',
        inverse: true,
      },
      {
        key: 'ethicsOpen',
        label: 'Denuncias en curso',
        value: ethics,
        unit: 'count',
        inverse: true,
      },
      {
        key: 'expiringDocuments',
        label: 'Documentos por vencer',
        value: expiring,
        unit: 'count',
        inverse: true,
      },
    ];

    const [byDepartment, byLocation, byContract, demographics, headcountSeries] = await Promise.all(
      [
        this.groupEmployees(companyId, 'departmentId', employeeWhere),
        this.groupEmployees(companyId, 'locationId', employeeWhere),
        this.contractDistribution(companyId),
        this.demographics(companyId, employeeWhere),
        this.headcountSeries(companyId, 12),
      ],
    );

    return {
      period: { from: toDateKey(from), to: toDateKey(to) },
      kpis,
      byDepartment,
      byLocation,
      byContract,
      demographics,
      headcountSeries,
    };
  }

  private async groupEmployees(
    companyId: string,
    field: 'departmentId' | 'locationId' | 'positionId',
    where: Prisma.EmployeeWhereInput,
  ) {
    const rows = await this.prisma.employee.groupBy({
      by: [field],
      where: { ...where, status: 'active' },
      _count: { _all: true },
    });
    const ids = rows.map((row) => row[field]).filter(Boolean) as string[];
    const names =
      field === 'departmentId'
        ? await this.prisma.department.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : field === 'locationId'
          ? await this.prisma.location.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            })
          : await this.prisma.position.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
    const byId = new Map(names.map((n) => [n.id, n.name]));
    return rows
      .map((row) => ({
        label: row[field] ? (byId.get(row[field] as string) ?? 'Sin asignar') : 'Sin asignar',
        value: row._count._all,
      }))
      .sort((a, b) => b.value - a.value);
  }

  private async contractDistribution(companyId: string) {
    const rows = await this.prisma.employmentContract.groupBy({
      by: ['contractType'],
      where: { companyId, deletedAt: null, isCurrent: true },
      _count: { _all: true },
    });
    return rows.map((row) => ({ label: row.contractType, value: row._count._all }));
  }

  private async demographics(companyId: string, where: Prisma.EmployeeWhereInput) {
    const employees = await this.prisma.employee.findMany({
      where: { ...where, status: 'active' },
      select: { gender: true, birthDate: true, hiredAt: true },
    });

    const count = (values: Array<string | null>) =>
      values.reduce<Record<string, number>>((acc, value) => {
        const key = value ?? 'Sin dato';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

    const toSeries = (record: Record<string, number>) =>
      Object.entries(record).map(([label, value]) => ({ label, value }));

    return {
      byGender: toSeries(count(employees.map((e) => e.gender))),
      byAge: toSeries(count(employees.map((e) => (e.birthDate ? ageBand(e.birthDate) : null)))),
      bySeniority: toSeries(count(employees.map((e) => seniorityBand(e.hiredAt)))),
    };
  }

  /** Monthly headcount for the last `months`, built from the snapshot table. */
  async headcountSeries(companyId: string, months: number) {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - months);

    const snapshots = await this.prisma.hrSnapshot.findMany({
      where: {
        companyId,
        metric: 'headcount',
        dimension: 'total',
        snapshotDate: { gte: from },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    if (snapshots.length) {
      return snapshots.map((snapshot) => ({
        label: toDateKey(snapshot.snapshotDate).slice(0, 7),
        value: Number(snapshot.value),
      }));
    }

    // Without snapshots yet, reconstruct the series from hire and exit dates.
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { hiredAt: true, terminatedAt: true },
    });
    const series: Array<{ label: string; value: number }> = [];
    for (let i = months; i >= 0; i -= 1) {
      const cursor = new Date();
      cursor.setUTCMonth(cursor.getUTCMonth() - i);
      const endOfMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
      const value = employees.filter(
        (employee) =>
          employee.hiredAt <= endOfMonth &&
          (!employee.terminatedAt || employee.terminatedAt > endOfMonth),
      ).length;
      series.push({ label: toDateKey(endOfMonth).slice(0, 7), value });
    }
    return series;
  }

  /* ------------------------------ snapshots ----------------------------- */

  /** Daily snapshot of headcount by dimension; feeds the historical series. */
  async takeSnapshot(companyId: string, date = new Date()) {
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null, hiredAt: { lte: day } },
      select: {
        terminatedAt: true,
        departmentId: true,
        locationId: true,
        positionId: true,
        gender: true,
        hiredAt: true,
      },
    });
    const active = employees.filter((e) => !e.terminatedAt || e.terminatedAt > day);

    const write = async (
      metric: string,
      dimension: string,
      dimensionValue: string,
      value: number,
    ) => {
      await this.prisma.hrSnapshot.upsert({
        where: {
          companyId_snapshotDate_metric_dimension_dimensionValue: {
            companyId,
            snapshotDate: day,
            metric,
            dimension,
            dimensionValue,
          },
        },
        create: {
          companyId,
          snapshotDate: day,
          metric,
          dimension,
          dimensionValue,
          value: new Prisma.Decimal(value),
        },
        update: { value: new Prisma.Decimal(value) },
      });
    };

    await write('headcount', 'total', 'all', active.length);

    const group = (key: 'departmentId' | 'locationId' | 'positionId') =>
      active.reduce<Record<string, number>>((acc, employee) => {
        const id = employee[key] ?? 'none';
        acc[id] = (acc[id] ?? 0) + 1;
        return acc;
      }, {});

    for (const [id, value] of Object.entries(group('departmentId'))) {
      await write('headcount', 'department', id, value);
    }
    for (const [id, value] of Object.entries(group('locationId'))) {
      await write('headcount', 'location', id, value);
    }

    const bySeniority = active.reduce<Record<string, number>>((acc, employee) => {
      const band = seniorityBand(employee.hiredAt, day);
      acc[band] = (acc[band] ?? 0) + 1;
      return acc;
    }, {});
    for (const [band, value] of Object.entries(bySeniority)) {
      await write('headcount', 'seniority', band, value);
    }

    return { date: toDateKey(day), headcount: active.length };
  }

  /* ------------------------------- alerts ------------------------------- */

  /**
   * Heuristic turnover risk: absenteeism, low performance, tenure without a
   * promotion, low engagement and no recent training all add up. It is a
   * flag for a conversation, never an automatic decision.
   */
  async computeTurnoverRisk(companyId: string, options: { persist?: boolean } = {}) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null, status: 'active' },
      select: {
        id: true,
        fullName: true,
        hiredAt: true,
        departmentId: true,
        department: { select: { name: true } },
        movements: { select: { effectiveDate: true, movementType: true } },
        leaveRequests: {
          where: { status: { in: ['approved', 'taken'] } },
          select: { requestedDays: true, startDate: true },
        },
        enrollments: { select: { completedAt: true } },
        recognitionsReceived: { select: { createdAt: true } },
      },
      take: 2000,
    });

    const oneYearAgo = new Date(Date.now() - 365 * 86_400_000);
    const results = [];

    for (const employee of employees) {
      let score = 0;
      const reasons: string[] = [];

      const absenceDays = employee.leaveRequests
        .filter((leave) => leave.startDate > oneYearAgo)
        .reduce((acc, leave) => acc + Number(leave.requestedDays), 0);
      if (absenceDays > 20) {
        score += 25;
        reasons.push(`Ausentismo alto (${round(absenceDays, 1)} dias en 12 meses)`);
      }

      const tenureYears = (Date.now() - employee.hiredAt.getTime()) / (365 * 86_400_000);
      const lastPromotion = employee.movements
        .filter((movement) => movement.movementType === 'promocion')
        .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0];
      if (tenureYears > 3 && !lastPromotion) {
        score += 25;
        reasons.push('Mas de 3 anos sin movimiento de cargo');
      }

      const recentTraining = employee.enrollments.some(
        (enrollment) => enrollment.completedAt && enrollment.completedAt > oneYearAgo,
      );
      if (!recentTraining) {
        score += 15;
        reasons.push('Sin formacion completada en 12 meses');
      }

      const recentRecognition = employee.recognitionsReceived.some(
        (recognition) => recognition.createdAt > oneYearAgo,
      );
      if (!recentRecognition) {
        score += 15;
        reasons.push('Sin reconocimientos en 12 meses');
      }

      if (tenureYears < 1) {
        score += 10;
        reasons.push('Antiguedad menor a un ano');
      }

      if (score >= 40) {
        results.push({
          employeeId: employee.id,
          fullName: employee.fullName,
          department: employee.department?.name ?? null,
          score: Math.min(100, score),
          reasons,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    if (options.persist) await this.persistTurnoverAlerts(companyId, results.slice(0, 200));
    return results;
  }

  /**
   * Persists the risks as alerts so they show up in the dashboard and can be
   * resolved. Called from the alerts job, never from a GET: two round trips
   * for the whole batch instead of two per employee.
   */
  private async persistTurnoverAlerts(
    companyId: string,
    results: Array<{ employeeId: string; fullName: string; score: number; reasons: string[] }>,
  ) {
    if (!results.length) return;
    const open = await this.prisma.analyticsAlert.findMany({
      where: {
        companyId,
        kind: 'turnover_risk',
        isResolved: false,
        entityId: { in: results.map((r) => r.employeeId) },
      },
      select: { id: true, entityId: true },
    });
    const openByEmployee = new Map(open.map((alert) => [alert.entityId, alert.id]));
    const updates = results
      .filter((r) => openByEmployee.has(r.employeeId))
      .map((r) =>
        this.prisma.analyticsAlert.update({
          where: { id: openByEmployee.get(r.employeeId) as string },
          data: {
            severity: r.score >= 70 ? 'high' : 'medium',
            detail: r.reasons.join(' | '),
            score: new Prisma.Decimal(r.score),
          },
        }),
      );
    const creates = results.filter((r) => !openByEmployee.has(r.employeeId));
    await this.prisma.$transaction([
      ...updates,
      ...(creates.length
        ? [
            this.prisma.analyticsAlert.createMany({
              data: creates.map((r) => ({
                companyId,
                kind: 'turnover_risk',
                severity: r.score >= 70 ? 'high' : 'medium',
                title: `Riesgo de rotacion: ${r.fullName}`,
                detail: r.reasons.join(' | '),
                entityType: 'employee',
                entityId: r.employeeId,
                score: new Prisma.Decimal(r.score),
              })),
            }),
          ]
        : []),
    ]);
  }

  /** Expiry alerts: documents, contracts, medical exams, certifications. */
  async computeExpiryAlerts(companyId: string) {
    const horizon = new Date(Date.now() + 30 * 86_400_000);
    const created: string[] = [];

    const add = async (
      kind: string,
      title: string,
      detail: string,
      entityType: string,
      entityId: string,
      dueDate: Date | null,
    ) => {
      const existing = await this.prisma.analyticsAlert.findFirst({
        where: { companyId, kind, entityId, isResolved: false },
      });
      if (existing) return;
      await this.prisma.analyticsAlert.create({
        data: {
          companyId,
          kind,
          severity: 'medium',
          title,
          detail,
          entityType,
          entityId,
          dueDate,
        },
      });
      created.push(entityId);
    };

    const documents = await this.prisma.employeeDocument.findMany({
      where: { companyId, deletedAt: null, expiresAt: { not: null, lte: horizon } },
      include: {
        employee: { select: { fullName: true } },
        documentType: { select: { name: true } },
      },
      take: 200,
    });
    for (const document of documents) {
      await add(
        'document_expiring',
        `Documento por vencer: ${document.documentType.name}`,
        `${document.employee.fullName} - vence ${toDateKey(document.expiresAt!)}`,
        'employee_document',
        document.id,
        document.expiresAt,
      );
    }

    const contracts = await this.prisma.employmentContract.findMany({
      where: { companyId, deletedAt: null, isCurrent: true, endDate: { not: null, lte: horizon } },
      include: { employee: { select: { fullName: true } } },
      take: 200,
    });
    for (const contract of contracts) {
      await add(
        'contract_expiring',
        'Contrato por vencer',
        `${contract.employee.fullName} - termina ${toDateKey(contract.endDate!)}`,
        'employment_contract',
        contract.id,
        contract.endDate,
      );
    }

    const exams = await this.prisma.medicalExam.findMany({
      where: { companyId, deletedAt: null, expiresAt: { not: null, lte: horizon } },
      include: { employee: { select: { fullName: true } } },
      take: 200,
    });
    for (const exam of exams) {
      await add(
        'medical_exam_expiring',
        'Examen medico por vencer',
        `${exam.employee.fullName} - vence ${toDateKey(exam.expiresAt!)}`,
        'medical_exam',
        exam.id,
        exam.expiresAt,
      );
    }

    const balances = await this.prisma.leaveBalance.findMany({
      where: { companyId, year: new Date().getUTCFullYear() },
      include: { employee: { select: { fullName: true } }, policy: true },
      take: 500,
    });
    for (const balance of balances) {
      const available =
        Number(balance.accruedDays) +
        Number(balance.adjustedDays) +
        Number(balance.carryOverDays) -
        Number(balance.takenDays) -
        Number(balance.pendingDays);
      const threshold = balance.policy ? Number(balance.policy.alertThresholdDays) : 30;
      if (available >= threshold) {
        await add(
          'vacation_accumulation',
          'Acumulacion de vacaciones',
          `${balance.employee.fullName} tiene ${round(available, 1)} dias disponibles`,
          'leave_balance',
          balance.id,
          null,
        );
      }
    }

    return { created: created.length };
  }

  /* --------------------------- report builder --------------------------- */

  async runReport(
    ctx: RequestContext,
    definition: {
      dataset: string;
      columns: string[];
      filters?: Record<string, unknown>;
      groupBy?: string[];
    },
  ) {
    const dataset = DATASETS[definition.dataset];
    if (!dataset) throw new Error('Dataset no valido');
    this.scope.requirePermission(ctx, dataset.permission);

    const rows = await this.fetchDataset(ctx, definition.dataset, definition.filters ?? {});
    const columns = definition.columns.length
      ? definition.columns
      : dataset.columns.map((column) => column.key);

    if (definition.groupBy?.length) {
      const grouped = new Map<string, number>();
      for (const row of rows) {
        const key = definition.groupBy.map((field) => String(row[field] ?? 'Sin dato')).join(' / ');
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }
      return {
        columns: [...definition.groupBy, 'total'],
        rows: [...grouped.entries()].map(([key, total]) => {
          const parts = key.split(' / ');
          const out: Record<string, unknown> = { total };
          definition.groupBy!.forEach((field, index) => {
            out[field] = parts[index];
          });
          return out;
        }),
      };
    }

    return {
      columns,
      rows: rows.map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column] ?? null])),
      ),
    };
  }

  private async fetchDataset(
    ctx: RequestContext,
    dataset: string,
    filters: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    const companyId = ctx.companyId;
    switch (dataset) {
      case 'employees': {
        const rows = await this.prisma.employee.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...(filters.status ? { status: filters.status as never } : {}),
            ...(filters.departmentId ? { departmentId: filters.departmentId as string } : {}),
            ...(filters.locationId ? { locationId: filters.locationId as string } : {}),
          },
          include: {
            department: { select: { name: true } },
            position: { select: { name: true } },
            location: { select: { name: true } },
          },
          take: 10_000,
        });
        return rows.map((row) => ({
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          email: row.email,
          status: row.status,
          hiredAt: toDateKey(row.hiredAt),
          terminatedAt: row.terminatedAt ? toDateKey(row.terminatedAt) : null,
          department: row.department?.name ?? null,
          position: row.position?.name ?? null,
          location: row.location?.name ?? null,
          gender: row.gender,
          workModality: row.workModality,
          seniority: seniorityBand(row.hiredAt),
        }));
      }
      case 'leaves': {
        const rows = await this.prisma.leaveRequest.findMany({
          where: { companyId, deletedAt: null },
          include: {
            employee: { select: { fullName: true } },
            leaveType: { select: { name: true } },
          },
          take: 10_000,
        });
        return rows.map((row) => ({
          employee: row.employee.fullName,
          leaveType: row.leaveType.name,
          startDate: toDateKey(row.startDate),
          endDate: toDateKey(row.endDate),
          requestedDays: Number(row.requestedDays),
          status: row.status,
        }));
      }
      case 'attendance': {
        const rows = await this.prisma.attendanceDay.findMany({
          where: { companyId },
          include: { employee: { select: { fullName: true } } },
          take: 10_000,
          orderBy: { date: 'desc' },
        });
        return rows.map((row) => ({
          employee: row.employee.fullName,
          date: toDateKey(row.date),
          status: row.status,
          workedMinutes: row.workedMinutes,
          lateMinutes: row.lateMinutes,
          overtimeMinutes: row.overtimeMinutes,
        }));
      }
      case 'enrollments': {
        const rows = await this.prisma.enrollment.findMany({
          where: { companyId },
          include: {
            employee: { select: { fullName: true } },
            course: { select: { title: true } },
          },
          take: 10_000,
        });
        return rows.map((row) => ({
          employee: row.employee.fullName,
          course: row.course.title,
          status: row.status,
          progress: row.progress,
          score: row.score ? Number(row.score) : null,
          completedAt: row.completedAt ? toDateKey(row.completedAt) : null,
        }));
      }
      case 'applications': {
        const rows = await this.prisma.application.findMany({
          where: { companyId, deletedAt: null },
          include: {
            candidate: { select: { fullName: true } },
            jobPosting: { select: { title: true } },
            stage: { select: { name: true } },
          },
          take: 10_000,
        });
        return rows.map((row) => ({
          candidate: row.candidate.fullName,
          jobPosting: row.jobPosting.title,
          stage: row.stage?.name ?? null,
          status: row.status,
          source: row.source,
          appliedAt: toDateKey(row.appliedAt),
        }));
      }
      case 'tickets': {
        const rows = await this.prisma.ticket.findMany({
          where: { companyId, deletedAt: null },
          include: { category: { select: { name: true } } },
          take: 10_000,
        });
        return rows.map((row) => ({
          number: row.number,
          subject: row.subject,
          category: row.category?.name ?? null,
          status: row.status,
          priority: row.priority,
          createdAt: toDateKey(row.createdAt),
          resolvedAt: row.resolvedAt ? toDateKey(row.resolvedAt) : null,
        }));
      }
      default:
        return [];
    }
  }

  /* ---------------------------- team dashboard -------------------------- */

  async teamDashboard(ctx: RequestContext) {
    const teamIds = await this.scope.teamEmployeeIds(ctx);
    const ids = teamIds.filter((id) => id !== ctx.employeeId);
    if (!ids.length) return { team: [], pendingApprovals: 0, absencesThisMonth: 0 };

    const startOfMonth = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    );

    const [team, absences, objectives, reviews, training] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          status: true,
          position: { select: { name: true } },
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          companyId: ctx.companyId,
          employeeId: { in: ids },
          status: { in: ['approved', 'taken'] },
          startDate: { gte: startOfMonth },
        },
      }),
      this.prisma.objective.aggregate({
        where: { companyId: ctx.companyId, ownerEmployeeId: { in: ids }, deletedAt: null },
        _avg: { progress: true },
        _count: { _all: true },
      }),
      this.prisma.reviewAssignment.groupBy({
        by: ['status'],
        where: { companyId: ctx.companyId, subjectEmployeeId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.enrollment.groupBy({
        by: ['status'],
        where: { companyId: ctx.companyId, employeeId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    return {
      team,
      teamSize: ids.length,
      absencesThisMonth: absences,
      objectives: {
        count: objectives._count._all,
        averageProgress: round(Number(objectives._avg.progress ?? 0), 1),
      },
      reviews: reviews.map((row) => ({ label: row.status, value: row._count._all })),
      training: training.map((row) => ({ label: row.status, value: row._count._all })),
    };
  }
}
