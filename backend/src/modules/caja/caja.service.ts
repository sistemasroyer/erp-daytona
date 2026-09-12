import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsEnum, IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { redondear2 } from '../../common/utils/numero-documento.util';
import { finDeDia } from '../../common/utils/fecha.util';

export class AbrirCajaDto {
  @IsString() @IsNotEmpty() id_caja: string;
  @IsNumber() @Min(0) monto_apertura: number;
}

export class CerrarCajaDto {
  @IsNumber() @Min(0) monto_cierre: number;
  @IsOptional() @IsString() observaciones?: string;
}

export class MovimientoCajaDto {
  @IsEnum(['ingreso', 'egreso']) tipo: 'ingreso' | 'egreso';
  @IsString() @IsNotEmpty() concepto: string;
  @IsNumber() @Min(0.01) monto: number;
  @IsOptional() @IsString() id_referencia?: string;
  @IsOptional() @IsString() tipo_referencia?: string;
  @IsOptional() @IsString() id_metodo_pago?: string;
}

export class DetalleDenominacionDto {
  @IsNumber() denominacion: number;
  @IsEnum(['moneda', 'billete']) tipo: 'moneda' | 'billete';
  @IsInt() @Min(0) cantidad: number;
}

export class ArqueoCajaDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => DetalleDenominacionDto)
  detalle: DetalleDenominacionDto[];
  @IsOptional() @IsString() observaciones?: string;
}

@Injectable()
export class CajaService {
  constructor(private prisma: PrismaService) {}

  /** Verifica que el punto de venta de la caja coincida con el del usuario (salvo superadmin). */
  private assertMismoPuntoVenta(idPuntoVentaCaja: string, idPuntoVentaUsuario?: string, esSuperadmin?: boolean) {
    if (esSuperadmin) return;
    if (!idPuntoVentaUsuario || idPuntoVentaCaja !== idPuntoVentaUsuario) {
      throw new ForbiddenException('No tiene acceso a la caja de otro punto de venta');
    }
  }

  /** Saldo esperado por sistema: monto_apertura + ingresos - egresos registrados hasta el momento. */
  private async calcularSaldoSistema(idCajaApertura: string, montoApertura: number): Promise<number> {
    const [ingresos, egresos] = await Promise.all([
      this.prisma.tbl_movimientos_caja.aggregate({
        where: { id_caja_apertura: idCajaApertura, tipo: 'ingreso' },
        _sum: { monto: true },
      }),
      this.prisma.tbl_movimientos_caja.aggregate({
        where: { id_caja_apertura: idCajaApertura, tipo: 'egreso' },
        _sum: { monto: true },
      }),
    ]);
    return redondear2(montoApertura + Number(ingresos._sum.monto || 0) - Number(egresos._sum.monto || 0));
  }

  async abrirCaja(dto: AbrirCajaDto, usuarioId: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const cajaAbierta = await this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id_caja: dto.id_caja, estado: 'abierta', eliminado: false },
    });
    if (cajaAbierta) throw new BadRequestException('La caja ya tiene una apertura activa');

    const caja = await this.prisma.tbl_cajas.findFirst({
      where: { id: dto.id_caja, eliminado: false, activo: true },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada o inactiva');
    this.assertMismoPuntoVenta(caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    return this.prisma.tbl_cajas_aperturas.create({
      data: {
        id_caja: dto.id_caja,
        id_usuario: usuarioId,
        monto_apertura: dto.monto_apertura,
        estado: 'abierta',
        fecha_apertura: new Date(),
        usuario_creacion: usuarioId,
      },
      include: {
        caja: { select: { nombre: true } },
        usuario: { select: { nombre: true, apellido: true } },
      },
    });
  }

  async cerrarCaja(idApertura: string, dto: CerrarCajaDto, usuarioId: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const apertura = await this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id: idApertura, estado: 'abierta', eliminado: false },
      include: { caja: { select: { id_punto_venta: true } } },
    });
    if (!apertura) throw new NotFoundException('Apertura de caja no encontrada o ya cerrada');
    this.assertMismoPuntoVenta(apertura.caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    const montoSistema = await this.calcularSaldoSistema(idApertura, Number(apertura.monto_apertura));
    const diferencia = redondear2(dto.monto_cierre - montoSistema);

    return this.prisma.tbl_cajas_aperturas.update({
      where: { id: idApertura },
      data: {
        monto_cierre: dto.monto_cierre,
        monto_sistema: montoSistema,
        diferencia,
        observaciones_cierre: dto.observaciones,
        estado: 'cerrada',
        fecha_cierre: new Date(),
        usuario_modificacion: usuarioId,
      },
    });
  }

  private static readonly DENOMINACIONES_VALIDAS = new Set([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200]);

  async registrarArqueo(idApertura: string, dto: ArqueoCajaDto, usuarioId: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const apertura = await this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id: idApertura, estado: 'abierta', eliminado: false },
      include: { caja: { select: { id_punto_venta: true } } },
    });
    if (!apertura) throw new BadRequestException('No hay apertura de caja activa');
    this.assertMismoPuntoVenta(apertura.caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    for (const d of dto.detalle) {
      if (!CajaService.DENOMINACIONES_VALIDAS.has(d.denominacion)) {
        throw new BadRequestException(`Denominación inválida: ${d.denominacion}`);
      }
    }

    const detalle = dto.detalle
      .filter((d) => d.cantidad > 0)
      .map((d) => ({ ...d, subtotal: redondear2(d.denominacion * d.cantidad) }));
    if (!detalle.length) throw new BadRequestException('Debe contar al menos una denominación');
    const montoContado = redondear2(detalle.reduce((acc, d) => acc + d.subtotal, 0));

    const montoSistema = await this.calcularSaldoSistema(idApertura, Number(apertura.monto_apertura));
    const diferencia = redondear2(montoContado - montoSistema);

    return this.prisma.tbl_cajas_arqueos.create({
      data: {
        id_caja_apertura: idApertura,
        id_usuario: usuarioId,
        monto_sistema: montoSistema,
        monto_contado: montoContado,
        diferencia,
        detalle_denominaciones: detalle,
        observaciones: dto.observaciones,
      },
    });
  }

  async listarArqueos(idApertura: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const apertura = await this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id: idApertura },
      include: { caja: { select: { id_punto_venta: true } } },
    });
    if (!apertura) throw new NotFoundException('Apertura no encontrada');
    this.assertMismoPuntoVenta(apertura.caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    return this.prisma.tbl_cajas_arqueos.findMany({
      where: { id_caja_apertura: idApertura },
      orderBy: { fecha_arqueo: 'desc' },
      include: { usuario: { select: { nombre: true, apellido: true } } },
    });
  }

  async registrarMovimiento(idApertura: string, dto: MovimientoCajaDto, usuarioId: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const apertura = await this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id: idApertura, estado: 'abierta', eliminado: false },
      include: { caja: { select: { id_punto_venta: true } } },
    });
    if (!apertura) throw new BadRequestException('No hay apertura de caja activa');
    this.assertMismoPuntoVenta(apertura.caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    if (dto.monto <= 0) throw new BadRequestException('El monto debe ser mayor a 0');

    return this.prisma.tbl_movimientos_caja.create({
      data: {
        id_caja_apertura: idApertura,
        tipo: dto.tipo as any,
        concepto: dto.concepto,
        monto: dto.monto,
        id_referencia: dto.id_referencia,
        tipo_referencia: dto.tipo_referencia,
        id_metodo_pago: dto.id_metodo_pago,
        id_usuario: usuarioId,
        fecha: new Date(),
      },
      include: { metodo_pago: { select: { nombre: true } } },
    });
  }

  async getCajaActiva(idCaja: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const caja = await this.prisma.tbl_cajas.findFirst({ where: { id: idCaja, eliminado: false } });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    this.assertMismoPuntoVenta(caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    return this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id_caja: idCaja, estado: 'abierta', eliminado: false },
      include: {
        caja: { select: { nombre: true } },
        usuario: { select: { nombre: true, apellido: true } },
        movimientos: { orderBy: { fecha: 'desc' }, take: 20 },
      },
    });
  }

  async getResumenCaja(idApertura: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const apertura = await this.prisma.tbl_cajas_aperturas.findFirst({
      where: { id: idApertura },
      include: { caja: true, usuario: { select: { nombre: true, apellido: true } } },
    });
    if (!apertura) throw new NotFoundException('Apertura no encontrada');
    this.assertMismoPuntoVenta(apertura.caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    const [ingresos, egresos, movimientos, porMetodo, metodosPago] = await Promise.all([
      this.prisma.tbl_movimientos_caja.aggregate({
        where: { id_caja_apertura: idApertura, tipo: 'ingreso' },
        _sum: { monto: true },
        _count: true,
      }),
      this.prisma.tbl_movimientos_caja.aggregate({
        where: { id_caja_apertura: idApertura, tipo: 'egreso' },
        _sum: { monto: true },
        _count: true,
      }),
      this.prisma.tbl_movimientos_caja.findMany({
        where: { id_caja_apertura: idApertura },
        orderBy: { fecha: 'desc' },
        include: { metodo_pago: { select: { nombre: true } } },
      }),
      this.prisma.tbl_movimientos_caja.groupBy({
        by: ['id_metodo_pago', 'tipo'],
        where: { id_caja_apertura: idApertura, id_metodo_pago: { not: null } },
        _sum: { monto: true },
      }),
      this.prisma.tbl_metodos_pago.findMany({ select: { id: true, nombre: true } }),
    ]);

    const totalIngresos = Number(ingresos._sum.monto || 0);
    const totalEgresos = Number(egresos._sum.monto || 0);
    const saldoActual = redondear2(Number(apertura.monto_apertura) + totalIngresos - totalEgresos);

    const nombresPorId = new Map(metodosPago.map((m) => [m.id, m.nombre]));
    const porMetodoMap = new Map<string, { id_metodo_pago: string; nombre: string; ingresos: number; egresos: number }>();
    for (const fila of porMetodo) {
      const idMetodo = fila.id_metodo_pago as string;
      if (!porMetodoMap.has(idMetodo)) {
        porMetodoMap.set(idMetodo, { id_metodo_pago: idMetodo, nombre: nombresPorId.get(idMetodo) || 'Desconocido', ingresos: 0, egresos: 0 });
      }
      const entrada = porMetodoMap.get(idMetodo)!;
      if (fila.tipo === 'ingreso') entrada.ingresos = Number(fila._sum.monto || 0);
      else entrada.egresos = Number(fila._sum.monto || 0);
    }

    return {
      apertura,
      resumen: {
        monto_apertura: Number(apertura.monto_apertura),
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_actual: saldoActual,
        cantidad_ingresos: ingresos._count,
        cantidad_egresos: egresos._count,
        por_metodo_pago: Array.from(porMetodoMap.values()),
      },
      movimientos,
    };
  }

  async findCajas(pagination: PaginationDto, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const where: any = { eliminado: false };
    if (!esSuperadmin && idPuntoVenta) where.id_punto_venta = idPuntoVenta;

    const [data, total] = await Promise.all([
      this.prisma.tbl_cajas.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        include: { punto_venta: { select: { nombre: true } } },
      }),
      this.prisma.tbl_cajas.count({ where }),
    ]);
    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async createCaja(dto: { id_punto_venta: string; nombre: string; descripcion?: string }, usuarioId: string, idPuntoVenta?: string, esSuperadmin?: boolean) {
    if (!esSuperadmin && idPuntoVenta && dto.id_punto_venta !== idPuntoVenta) {
      throw new ForbiddenException('No puede crear una caja para otro punto de venta');
    }

    return this.prisma.tbl_cajas.create({
      data: { ...dto, usuario_creacion: usuarioId },
    });
  }

  async getAperturas(
    pagination: PaginationDto & { id_caja?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string },
    idPuntoVenta?: string,
    esSuperadmin?: boolean,
  ) {
    const where: any = { eliminado: false };
    if (!esSuperadmin && idPuntoVenta) where.caja = { id_punto_venta: idPuntoVenta };
    if (pagination.id_caja) where.id_caja = pagination.id_caja;
    if (pagination.estado) where.estado = pagination.estado;
    if (pagination.fecha_desde || pagination.fecha_hasta) {
      where.fecha_apertura = {};
      if (pagination.fecha_desde) where.fecha_apertura.gte = new Date(pagination.fecha_desde);
      if (pagination.fecha_hasta) where.fecha_apertura.lte = finDeDia(pagination.fecha_hasta);
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_cajas_aperturas.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_apertura: 'desc' },
        include: { caja: { select: { nombre: true } }, usuario: { select: { nombre: true, apellido: true } } },
      }),
      this.prisma.tbl_cajas_aperturas.count({ where }),
    ]);
    return { data, total, page: pagination.page, limit: pagination.limit };
  }
}
