import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MetodosPagoService } from './metodos-pago.service';

@ApiTags('Métodos de Pago')
@ApiBearerAuth()
@Controller('metodos-pago')
export class MetodosPagoController {
  constructor(private readonly service: MetodosPagoService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
