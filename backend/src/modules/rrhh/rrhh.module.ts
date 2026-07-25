import { Module } from '@nestjs/common';
import { RrhhService } from './rrhh.service';
import { RrhhController } from './rrhh.controller';

@Module({
  controllers: [RrhhController],
  providers: [RrhhService],
})
export class RrhhModule {}
