import { Module } from '@nestjs/common';
import { SeriesDocumentoController } from './series-documento.controller';
import { SeriesDocumentoService } from './series-documento.service';

@Module({
  controllers: [SeriesDocumentoController],
  providers: [SeriesDocumentoService],
  exports: [SeriesDocumentoService],
})
export class SeriesDocumentoModule {}
