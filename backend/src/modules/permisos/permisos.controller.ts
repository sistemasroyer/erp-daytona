import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermisosService } from './permisos.service';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Permisos')
@ApiBearerAuth()
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get()
  @Permisos('roles:ver')
  @ApiOperation({ summary: 'Listar permisos agrupados por módulo' })
  findAll() {
    return this.permisosService.findAll();
  }

  @Get('flat')
  @Permisos('roles:ver')
  @ApiOperation({ summary: 'Listar todos los permisos (plano)' })
  findAllFlat() {
    return this.permisosService.findAllFlat();
  }
}
