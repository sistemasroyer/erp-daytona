import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { InventarioModule } from '../inventario/inventario.module';
import { ConfigMargenesModule } from '../config-margenes/config-margenes.module';

@Module({
  imports: [InventarioModule, ConfigMargenesModule],
  controllers: [ComprasController],
  providers: [ComprasService],
  exports: [ComprasService],
})
export class ComprasModule {}
