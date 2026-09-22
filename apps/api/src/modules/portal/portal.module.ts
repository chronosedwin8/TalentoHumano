import { Module } from '@nestjs/common';
import { LeavesModule } from '../leaves/leaves.module';
import { PeopleModule } from '../people/people.module';
import { PortalController } from './portal.controller';

@Module({
  imports: [PeopleModule, LeavesModule],
  controllers: [PortalController],
})
export class PortalModule {}
