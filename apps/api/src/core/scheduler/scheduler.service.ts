import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnalyticsService } from '../../modules/analytics/analytics.service';
import { OnboardingService } from '../../modules/onboarding/onboarding.service';
import { RecruitingService } from '../../modules/recruiting/recruiting.service';
import { EthicsService } from '../../modules/ethics/ethics.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { ReportsScheduleRunner } from './reports-schedule.runner';

/**
 * Everything the platform does on its own clock. Each job runs once across
 * the whole deployment: a Postgres advisory lock (held by a transaction for
 * the duration of the job) makes replicas skip a job another instance is
 * already running. The same operations stay reachable through their
 * `POST .../run` endpoints for manual execution.
 *
 * Times are UTC; 07:00 UTC is 02:00 in Bogota.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly onboarding: OnboardingService,
    private readonly recruiting: RecruitingService,
    private readonly ethics: EthicsService,
    private readonly workflows: WorkflowsService,
    private readonly reports: ReportsScheduleRunner,
  ) {}

  /** Daily indicators snapshot and alert recalculation, per company. */
  @Cron('0 7 * * *', { name: 'analytics.daily' })
  async analyticsDaily(): Promise<void> {
    await this.runOnce('analytics.daily', async () => {
      for (const company of await this.companies()) {
        await this.analytics.takeSnapshot(company.id);
        await this.analytics.computeExpiryAlerts(company.id);
        await this.analytics.computeTurnoverRisk(company.id, { persist: true });
      }
    });
  }

  /** Onboarding reminders and escalation of tasks stuck past their due date. */
  @Cron('0 12 * * *', { name: 'onboarding.reminders' })
  async onboardingReminders(): Promise<void> {
    await this.runOnce('onboarding.reminders', async () => {
      let sent = 0;
      let escalated = 0;
      for (const company of await this.companies()) {
        sent += await this.onboarding.sendReminders(company.id);
        escalated += await this.onboarding.escalateOverdue(company.id);
      }
      this.logger.log(`Onboarding: ${sent} reminders, ${escalated} escalations`);
    });
  }

  /** Approval steps past their SLA are reminded once, then escalated. */
  @Cron(CronExpression.EVERY_HOUR, { name: 'workflows.sla' })
  async workflowSla(): Promise<void> {
    await this.runOnce('workflows.sla', async () => {
      const count = await this.workflows.escalateOverdueSteps();
      if (count) this.logger.log(`Workflows: ${count} overdue steps handled`);
    });
  }

  /** Ethics reports past their legal response deadline. */
  @Cron('30 12 * * *', { name: 'ethics.sla' })
  async ethicsSla(): Promise<void> {
    await this.runOnce('ethics.sla', async () => {
      const count = await this.ethics.escalateOverdueReports();
      if (count) this.logger.log(`Ethics: ${count} overdue reports escalated`);
    });
  }

  /** Scheduled reports whose next run is due. */
  @Cron('*/15 * * * *', { name: 'reports.schedules' })
  async reportSchedules(): Promise<void> {
    await this.runOnce('reports.schedules', async () => {
      const count = await this.reports.runDue();
      if (count) this.logger.log(`Reports: ${count} scheduled reports sent`);
    });
  }

  /** Candidates past their retention period, once a month. */
  @Cron('0 8 1 * *', { name: 'recruiting.retention' })
  async candidateRetention(): Promise<void> {
    await this.runOnce('recruiting.retention', async () => {
      let total = 0;
      for (const company of await this.companies()) {
        total += await this.recruiting.anonymizeExpiredCandidates(company.id);
      }
      this.logger.log(`Recruiting: ${total} candidates anonymised`);
    });
  }

  private async companies(): Promise<Array<{ id: string }>> {
    return this.prisma.company.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
  }

  /**
   * Runs `job` unless another replica holds the lock for `name`. The lock is
   * transaction scoped, so a crash releases it with the connection.
   */
  private async runOnce(name: string, job: () => Promise<void>): Promise<void> {
    const key = lockKey(name);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const [row] = await tx.$queryRaw<Array<{ locked: boolean }>>`
            SELECT pg_try_advisory_xact_lock(${key}) AS locked`;
          if (!row?.locked) {
            this.logger.debug(`Job ${name} already running elsewhere`);
            return;
          }
          const started = Date.now();
          await job();
          this.logger.debug(`Job ${name} finished in ${Date.now() - started} ms`);
        },
        { timeout: 20 * 60_000, maxWait: 5_000 },
      );
    } catch (error) {
      this.logger.error(`Job ${name} failed: ${(error as Error).message}`);
    }
  }
}

/** Stable 32-bit key for the advisory lock, derived from the job name. */
function lockKey(name: string): number {
  let hash = 0;
  for (const char of `talento:${name}`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return hash;
}
