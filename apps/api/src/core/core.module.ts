import { Module } from '@nestjs/common';
import { AccessModule } from './access/access.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { FormsController } from './forms/forms.controller';
import { IntegrationsController } from './integrations/integrations.controller';
import { IntegrationsService } from './integrations/integrations.service';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationModule } from './organization/organization.module';
import { QueueModule } from './queue/queue.module';
import { SettingsController } from './settings/settings.controller';
import { UsersModule } from './users/users.module';
import { WorkflowsModule } from './workflows/workflows.module';

/**
 * Everything that is not a functional HR module: identity, tenancy, security,
 * files, notifications, queues, workflows, dynamic forms and integrations.
 */
@Module({
  imports: [
    AccessModule,
    QueueModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    FilesModule,
    WorkflowsModule,
    OrganizationModule,
    UsersModule,
  ],
  controllers: [SettingsController, FormsController, IntegrationsController],
  providers: [IntegrationsService],
  exports: [
    AccessModule,
    QueueModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    FilesModule,
    WorkflowsModule,
    OrganizationModule,
    UsersModule,
    IntegrationsService,
  ],
})
export class CoreModule {}
