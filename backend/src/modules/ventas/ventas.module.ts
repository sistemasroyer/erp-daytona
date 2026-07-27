import { Module } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { VentasController } from './ventas.controller';
import { InventarioModule } from '../inventario/inventario.module';
import { FacturacionModule } from '../facturacion/facturacion.module';

@Module({
  imports: [InventarioModule, FacturacionModule],
  controllers: [VentasController],
  providers: [VentasService],
  exports: [VentasService],
})
export class VentasModule {}
