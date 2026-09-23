import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { validateEnv } from './common/config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { CoreModule } from './core/core.module';
import { SchedulerModule } from './core/scheduler/scheduler.module';
import { HealthController } from './health.controller';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EthicsModule } from './modules/ethics/ethics.module';
import { HelpdeskModule } from './modules/helpdesk/helpdesk.module';
import { LearningModule } from './modules/learning/learning.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PeopleModule } from './modules/people/people.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { PortalModule } from './modules/portal/portal.module';
import { PublicModule } from './modules/public/public.module';
import { RecruitingModule } from './modules/recruiting/recruiting.module';
import { SstModule } from './modules/sst/sst.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { TimeModule } from './modules/time/time.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
      cache: true,
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 300),
      },
    ]),
    PrismaModule,
    CoreModule,
    PeopleModule,
    RecruitingModule,
    OnboardingModule,
    LeavesModule,
    TimeModule,
    LearningModule,
    PerformanceModule,
    CommunicationModule,
    SurveysModule,
    EthicsModule,
    DocumentsModule,
    HelpdeskModule,
    SstModule,
    AnalyticsModule,
    PortalModule,
    PublicModule,
    // Last: it depends on the feature modules above.
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
