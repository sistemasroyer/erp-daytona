import { BadRequestException } from '@nestjs/common';

export class StockInsuficienteException extends BadRequestException {
  constructor(producto?: string, stockActual?: number, cantidadSolicitada?: number) {
    const mensaje = producto
      ? `Stock insuficiente para "${producto}". Disponible: ${stockActual}, Solicitado: ${cantidadSolicitada}`
      : 'Stock insuficiente para completar la operación';
    super(mensaje);
  }
}
