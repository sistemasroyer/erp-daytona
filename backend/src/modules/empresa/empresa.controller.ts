import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmpresaService, UpdateEmpresaDto } from './empresa.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Empresa')
@ApiBearerAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly service: EmpresaService) {}

  @Get()
  @ApiOperation({ summary: 'Datos de la empresa (razón social, RUC, logo, etc.)' })
  obtener() {
    return this.service.obtener();
  }

  @Patch()
  @Permisos('configuracion:editar')
  @ApiOperation({ summary: 'Actualizar datos de la empresa' })
  actualizar(@Body() dto: UpdateEmpresaDto, @CurrentUser('sub') userId: string) {
    return this.service.actualizar(dto, userId);
  }
}
