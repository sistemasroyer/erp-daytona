import { Module } from '@nestjs/common';
import { TomaInventarioService } from './toma-inventario.service';
import { TomaInventarioController } from './toma-inventario.controller';

@Module({
  controllers: [TomaInventarioController],
  providers: [TomaInventarioService],
})
export class TomaInventarioModule {}
