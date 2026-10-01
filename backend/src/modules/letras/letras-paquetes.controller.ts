import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { LetrasPaquetesService } from './letras-paquetes.service';
import { LetrasGeneracionService } from './letras-generacion.service';
import { ConfigDistribucionDto, GuardarLetrasDto } from './dto/generacion.dto';
import {
  CreatePaqueteDto, DocumentoLetraDto, FiltroPaquetesDto, ImportarComprasDto, MotivoDto,
  UpdateDocumentoLetraDto, UpdatePaqueteDto,
} from './dto/paquetes.dto';

@ApiTags('Letras — paquetes')
@ApiBearerAuth()
@Controller('letras/paquetes')
export class LetrasPaquetesController {
  constructor(
    private readonly service: LetrasPaquetesService,
    private readonly generacion: LetrasGeneracionService,
  ) {}

  @Get() @Permisos('letras:ver')
  listar(@Query() filtros: FiltroPaquetesDto) { return this.service.listar(filtros); }

  @Get('resumen') @Permisos('letras:ver')
  @ApiOperation({ summary: 'Cantidad de paquetes por estado' })
  resumen() { return this.service.resumen(); }

  @Get(':id') @Permisos('letras:ver')
  obtener(@Param('id') id: string) { return this.service.obtener(id); }

  @Post() @Permisos('letras:crear')
  crear(@Body() dto: CreatePaqueteDto, @CurrentUser('sub') u: string) { return this.service.crear(dto, u); }

  @Patch(':id') @Permisos('letras:editar')
  actualizar(@Param('id') id: string, @Body() dto: UpdatePaqueteDto, @CurrentUser('sub') u: string) { return this.service.actualizar(id, dto, u); }

  @Delete(':id') @Permisos('letras:eliminar')
  eliminar(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.eliminar(id, u); }

  // ─── Estados ───
  @Patch(':id/enviar') @Permisos('letras:editar')
  enviar(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.enviar(id, u); }

  @Patch(':id/devolver') @Permisos('letras:aprobar')
  devolver(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.devolver(id, u); }

  @Patch(':id/aprobar') @Permisos('letras:aprobar')
  aprobar(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.aprobar(id, u); }

  @Patch(':id/reabrir') @Permisos('letras:aprobar')
  reabrir(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.reabrir(id, u); }

  @Patch(':id/cancelar') @Permisos('letras:anular')
  cancelar(@Param('id') id: string, @Body() dto: MotivoDto, @CurrentUser('sub') u: string) { return this.service.cancelar(id, dto, u); }

  // ─── Documentos ───
  @Get(':id/compras-disponibles') @Permisos('letras:ver')
  @ApiOperation({ summary: 'Facturas a crédito (y sus NC) del proveedor que aún no están en un paquete' })
  comprasDisponibles(@Param('id') id: string) { return this.service.comprasDisponibles(id); }

  @Post(':id/importar-compras') @Permisos('letras:editar')
  importarCompras(@Param('id') id: string, @Body() dto: ImportarComprasDto, @CurrentUser('sub') u: string) { return this.service.importarCompras(id, dto, u); }

  @Post(':id/documentos') @Permisos('letras:editar')
  agregarDocumento(@Param('id') id: string, @Body() dto: DocumentoLetraDto, @CurrentUser('sub') u: string) { return this.service.agregarDocumento(id, dto, u); }

  @Patch(':id/documentos/:idDocumento') @Permisos('letras:editar')
  actualizarDocumento(@Param('id') id: string, @Param('idDocumento') idDoc: string, @Body() dto: UpdateDocumentoLetraDto, @CurrentUser('sub') u: string) {
    return this.service.actualizarDocumento(id, idDoc, dto, u);
  }

  @Delete(':id/documentos/:idDocumento') @Permisos('letras:editar')
  eliminarDocumento(@Param('id') id: string, @Param('idDocumento') idDoc: string, @CurrentUser('sub') u: string) {
    return this.service.eliminarDocumento(id, idDoc, u);
  }

  // ─── Generación de letras ───
  // Análisis y recálculo son GET: no guardan nada y así no llenan el historial del paquete.
  @Get(':id/analisis') @Permisos('letras:crear')
  @ApiOperation({ summary: 'Propone número de cuotas y su distribución (no guarda)' })
  analizar(@Param('id') id: string, @Query() config: ConfigDistribucionDto) {
    const { numero_cuotas, ...cfg } = config;
    return numero_cuotas ? this.generacion.recalcular(id, numero_cuotas, cfg) : this.generacion.analizar(id, cfg);
  }

  @Post(':id/generar') @Permisos('letras:crear')
  @ApiOperation({ summary: 'Guarda las letras propuestas (o ajustadas) y pasa el paquete a En proceso' })
  generar(@Param('id') id: string, @Body() dto: GuardarLetrasDto, @CurrentUser('sub') u: string) { return this.generacion.guardar(id, dto, u); }
}
