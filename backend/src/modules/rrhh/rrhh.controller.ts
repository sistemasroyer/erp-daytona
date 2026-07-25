import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RrhhService, CreatePersonalDto } from './rrhh.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('RRHH')
@ApiBearerAuth()
@Controller('rrhh/personal')
export class RrhhController {
  constructor(private readonly service: RrhhService) {}

  @Post()
  @Permisos('rrhh:crear')
  create(@Body() dto: CreatePersonalDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('rrhh:ver')
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll({ ...pagination, skip: Number(pagination.skip) || 0 } as any);
  }

  @Get('areas')
  @Permisos('rrhh:ver')
  getAreas() {
    return this.service.getAreas();
  }

  @Get(':id')
  @Permisos('rrhh:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permisos('rrhh:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePersonalDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('rrhh:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
