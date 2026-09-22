import { Module } from '@nestjs/common';
import { EthicsController } from './ethics.controller';
import { EthicsService } from './ethics.service';

@Module({
  controllers: [EthicsController],
  providers: [EthicsService],
  exports: [EthicsService],
})
export class EthicsModule {}
