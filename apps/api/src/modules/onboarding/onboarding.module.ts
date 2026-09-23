import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  // Tasks with a course enrol the new hire in it.
  imports: [LearningModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
