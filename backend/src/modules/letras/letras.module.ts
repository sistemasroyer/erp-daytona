import { Module } from '@nestjs/common';
import { LetrasCatalogosController } from './letras-catalogos.controller';
import { LetrasCatalogosService } from './letras-catalogos.service';
import { LetrasPaquetesController } from './letras-paquetes.controller';
import { LetrasPaquetesService } from './letras-paquetes.service';
import { LetrasGeneracionService } from './letras-generacion.service';
import { LetrasCuotasController } from './letras-cuotas.controller';
import { LetrasCuotasService } from './letras-cuotas.service';
import { LetrasReportesController } from './letras-reportes.controller';
import { LetrasReportesService } from './letras-reportes.service';

/** Letras: cuentas por pagar a proveedores en cuotas (migrado de letras-daytona). */
@Module({
  controllers: [LetrasCatalogosController, LetrasPaquetesController, LetrasCuotasController, LetrasReportesController],
  providers: [LetrasCatalogosService, LetrasPaquetesService, LetrasGeneracionService, LetrasCuotasService, LetrasReportesService],
  exports: [LetrasPaquetesService],
})
export class LetrasModule {}
