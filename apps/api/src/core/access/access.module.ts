import { Global, Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { ScopeService } from './scope.service';

@Global()
@Module({
  providers: [AccessControlService, ScopeService],
  exports: [AccessControlService, ScopeService],
})
export class AccessModule {}
