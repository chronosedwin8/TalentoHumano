import { Module } from '@nestjs/common';
import { SstController } from './sst.controller';

@Module({
  controllers: [SstController],
})
export class SstModule {}
