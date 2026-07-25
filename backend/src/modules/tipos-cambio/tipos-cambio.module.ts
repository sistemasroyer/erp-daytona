import { Module } from '@nestjs/common';
import { TiposCambioController } from './tipos-cambio.controller';
import { TiposCambioService } from './tipos-cambio.service';

@Module({
  controllers: [TiposCambioController],
  providers: [TiposCambioService],
  exports: [TiposCambioService],
})
export class TiposCambioModule {}
