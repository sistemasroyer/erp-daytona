import { Module } from '@nestjs/common';
import { NubefactService } from './nubefact.service';
import { SunatEnvioService } from './sunat-envio.service';
import { FacturacionController } from './facturacion.controller';

@Module({
  controllers: [FacturacionController],
  providers: [NubefactService, SunatEnvioService],
  exports: [NubefactService, SunatEnvioService],
})
export class FacturacionModule {}
