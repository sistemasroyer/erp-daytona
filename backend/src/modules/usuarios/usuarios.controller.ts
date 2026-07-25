import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Permisos('usuarios:crear')
  @ApiOperation({ summary: 'Crear usuario' })
  create(@Body() dto: CreateUsuarioDto, @CurrentUser('sub') userId: string) {
    return this.usuariosService.create(dto, userId);
  }

  @Get()
  @Permisos('usuarios:ver')
  @ApiOperation({ summary: 'Listar usuarios' })
  findAll(@Query() pagination: PaginationDto) {
    return this.usuariosService.findAll(pagination);
  }

  @Get(':id')
  @Permisos('usuarios:ver')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  @Permisos('usuarios:editar')
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateUsuarioDto>, @CurrentUser('sub') userId: string) {
    return this.usuariosService.update(id, dto, userId);
  }

  @Patch(':id/toggle-estado')
  @Permisos('usuarios:editar')
  @ApiOperation({ summary: 'Activar/desactivar usuario' })
  toggleEstado(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.usuariosService.toggleEstado(id, userId);
  }

  @Delete(':id')
  @Permisos('usuarios:eliminar')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.usuariosService.remove(id, userId);
  }
}
