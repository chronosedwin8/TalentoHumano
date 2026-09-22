import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [MailService, NotificationsService, NotificationsGateway],
  exports: [MailService, NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
