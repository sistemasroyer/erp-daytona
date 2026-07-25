import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientesService, CreateClienteDto } from './clientes.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  @Permisos('clientes:crear')
  create(@Body() dto: CreateClienteDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('clientes:ver')
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('consultar/dni/:dni')
  @Permisos('clientes:ver')
  @ApiOperation({ summary: 'Consultar DNI en RENIEC' })
  consultarDni(@Param('dni') dni: string) {
    return this.service.consultarDni(dni);
  }

  @Get('consultar/ruc/:ruc')
  @Permisos('clientes:ver')
  @ApiOperation({ summary: 'Consultar RUC en SUNAT' })
  consultarRuc(@Param('ruc') ruc: string) {
    return this.service.consultarRuc(ruc);
  }

  @Get(':id')
  @Permisos('clientes:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permisos('clientes:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateClienteDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('clientes:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
