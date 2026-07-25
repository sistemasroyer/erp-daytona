import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SunatXmlService } from './sunat-xml.service';
import { SunatEnvioService } from './sunat-envio.service';
import { SunatProcessor, SUNAT_QUEUE } from './sunat.processor';
import { FacturacionController } from './facturacion.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SUNAT_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 120000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [FacturacionController],
  providers: [SunatXmlService, SunatEnvioService, SunatProcessor],
  exports: [SunatXmlService, SunatEnvioService],
})
export class FacturacionModule {}
