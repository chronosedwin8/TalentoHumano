import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../../modules/analytics/analytics.module';
import { EthicsModule } from '../../modules/ethics/ethics.module';
import { OnboardingModule } from '../../modules/onboarding/onboarding.module';
import { RecruitingModule } from '../../modules/recruiting/recruiting.module';
import { ReportsScheduleRunner } from './reports-schedule.runner';
import { SchedulerService } from './scheduler.service';

/**
 * Registered last in AppModule: it depends on the feature modules, never the
 * other way round, so no module needs to know about the clock.
 */
@Module({
  imports: [AnalyticsModule, OnboardingModule, RecruitingModule, EthicsModule],
  providers: [SchedulerService, ReportsScheduleRunner],
})
export class SchedulerModule {}
