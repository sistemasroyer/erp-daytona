import { ConflictException } from '@nestjs/common';

export class ConcurrenciaException extends ConflictException {
  constructor(entidad?: string) {
    super(
      `El registro ${entidad ? `de ${entidad} ` : ''}fue modificado por otra operación. Intente nuevamente.`,
    );
  }
}
