import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { InventarioRepository } from './inventario.repository';

@Module({
  controllers: [InventarioController],
  providers: [InventarioService, InventarioRepository],
  exports: [InventarioService, InventarioRepository],
})
export class InventarioModule {}
