import { Module } from '@nestjs/common';
import { EthicsModule } from '../ethics/ethics.module';
import { RecruitingModule } from '../recruiting/recruiting.module';
import { PublicController } from './public.controller';

@Module({
  imports: [RecruitingModule, EthicsModule],
  controllers: [PublicController],
})
export class PublicModule {}
