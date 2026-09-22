import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { RecruitingController } from './recruiting.controller';
import { RecruitingService } from './recruiting.service';

@Module({
  imports: [PeopleModule],
  controllers: [RecruitingController],
  providers: [RecruitingService],
  exports: [RecruitingService],
})
export class RecruitingModule {}
