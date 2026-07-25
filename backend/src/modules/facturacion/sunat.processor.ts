import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SunatEnvioService } from './sunat-envio.service';

export const SUNAT_QUEUE = 'sunat-envio';

@Processor(SUNAT_QUEUE)
export class SunatProcessor extends WorkerHost {
  private readonly logger = new Logger(SunatProcessor.name);

  constructor(private readonly sunatEnvio: SunatEnvioService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { idVenta } = job.data;
    this.logger.log(`Procesando envío SUNAT para venta ${idVenta} (job ${job.id})`);

    try {
      await this.sunatEnvio.procesarEnvio(idVenta);
      this.logger.log(`Venta ${idVenta} enviada a SUNAT exitosamente`);
    } catch (error) {
      this.logger.error(`Error en job SUNAT para venta ${idVenta}: ${error.message}`);
      throw error;
    }
  }
}
