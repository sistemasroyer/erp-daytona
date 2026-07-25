import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService, CreateRolDto } from './roles.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permisos('roles:crear')
  create(@Body() dto: CreateRolDto, @CurrentUser('sub') userId: string) {
    return this.rolesService.create(dto, userId);
  }

  @Get()
  @Permisos('roles:ver')
  findAll(@Query() pagination: PaginationDto) {
    return this.rolesService.findAll(pagination);
  }

  @Get(':id')
  @Permisos('roles:ver')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permisos('roles:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateRolDto>, @CurrentUser('sub') userId: string) {
    return this.rolesService.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('roles:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.rolesService.remove(id, userId);
  }
}
