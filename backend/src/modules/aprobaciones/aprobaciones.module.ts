import { Global, Module } from '@nestjs/common';
import { AprobacionesService } from './aprobaciones.service';
import { AprobacionesController } from './aprobaciones.controller';

@Global()
@Module({ providers: [AprobacionesService], controllers: [AprobacionesController], exports: [AprobacionesService] })
export class AprobacionesModule {}
