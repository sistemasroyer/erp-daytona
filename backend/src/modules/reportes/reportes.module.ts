import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [InventarioModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
