import { Module } from '@nestjs/common';
import { LetrasCatalogosController } from './letras-catalogos.controller';
import { LetrasCatalogosService } from './letras-catalogos.service';
import { LetrasPaquetesController } from './letras-paquetes.controller';
import { LetrasPaquetesService } from './letras-paquetes.service';

/** Letras: cuentas por pagar a proveedores en cuotas (migrado de letras-daytona). */
@Module({
  controllers: [LetrasCatalogosController, LetrasPaquetesController],
  providers: [LetrasCatalogosService, LetrasPaquetesService],
  exports: [LetrasPaquetesService],
})
export class LetrasModule {}
