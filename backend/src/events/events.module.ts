import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VentaCreadaHandler } from './venta-creada.handler';
import { SUNAT_QUEUE } from '../modules/facturacion/sunat.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: SUNAT_QUEUE }),
  ],
  providers: [VentaCreadaHandler],
  exports: [VentaCreadaHandler],
})
export class EventsModule {}
