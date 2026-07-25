import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SUNAT_QUEUE } from '../modules/facturacion/sunat.processor';

@Injectable()
export class VentaCreadaHandler {
  private readonly logger = new Logger(VentaCreadaHandler.name);

  constructor(
    @InjectQueue(SUNAT_QUEUE) private sunatQueue: Queue,
  ) {}

  @OnEvent('venta.creada', { async: true })
  async handleVentaCreada(venta: any) {
    if (venta.tipo_documento !== 'FACTURA' && venta.tipo_documento !== 'BOLETA') {
      this.logger.log(`Venta ${venta.id} es ${venta.tipo_documento}: no se envía a SUNAT`);
      return;
    }

    this.logger.log(`Evento venta.creada recibido para venta ${venta.id}`);

    try {
      const job = await this.sunatQueue.add(
        'enviar-sunat',
        { idVenta: venta.id },
        {
          jobId: `sunat-${venta.id}`,
          delay: 2000,
          attempts: 5,
          backoff: { type: 'exponential', delay: 120000 },
        },
      );

      this.logger.log(`Job SUNAT creado: ${job.id} para venta ${venta.id}`);
    } catch (error) {
      this.logger.error(`Error creando job SUNAT para venta ${venta.id}: ${error.message}`);
    }
  }

  @OnEvent('venta.reenviar_sunat', { async: true })
  async handleReenvio(venta: any) {
    await this.sunatQueue.add(
      'enviar-sunat',
      { idVenta: venta.id },
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 5000 },
      },
    );
    this.logger.log(`Reenvío SUNAT encolado para venta ${venta.id}`);
  }
}
