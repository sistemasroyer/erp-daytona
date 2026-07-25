import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsEnum } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { redondear2 } from '../../common/utils/numero-documento.util';

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

    // Calcular total del sistema
    const ingresos = await this.prisma.tbl_movimientos_caja.aggregate({
      where: { id_caja_apertura: idApertura, tipo: 'ingreso' },
      _sum: { monto: true },
    });
    const egresos = await this.prisma.tbl_movimientos_caja.aggregate({
      where: { id_caja_apertura: idApertura, tipo: 'egreso' },
      _sum: { monto: true },
    });

    const montoSistema = redondear2(
      Number(apertura.monto_apertura) +
      Number(ingresos._sum.monto || 0) -
      Number(egresos._sum.monto || 0),
    );
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
        id_usuario: usuarioId,
        fecha: new Date(),
      },
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

    const [ingresos, egresos, movimientos] = await Promise.all([
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
      }),
    ]);

    const totalIngresos = Number(ingresos._sum.monto || 0);
    const totalEgresos = Number(egresos._sum.monto || 0);
    const saldoActual = redondear2(Number(apertura.monto_apertura) + totalIngresos - totalEgresos);

    return {
      apertura,
      resumen: {
        monto_apertura: Number(apertura.monto_apertura),
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_actual: saldoActual,
        cantidad_ingresos: ingresos._count,
        cantidad_egresos: egresos._count,
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

  async getAperturas(idCaja: string, pagination: PaginationDto, idPuntoVenta?: string, esSuperadmin?: boolean) {
    const caja = await this.prisma.tbl_cajas.findFirst({ where: { id: idCaja, eliminado: false } });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    this.assertMismoPuntoVenta(caja.id_punto_venta, idPuntoVenta, esSuperadmin);

    const [data, total] = await Promise.all([
      this.prisma.tbl_cajas_aperturas.findMany({
        where: { id_caja: idCaja, eliminado: false },
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_apertura: 'desc' },
        include: { usuario: { select: { nombre: true, apellido: true } } },
      }),
      this.prisma.tbl_cajas_aperturas.count({ where: { id_caja: idCaja, eliminado: false } }),
    ]);
    return { data, total, page: pagination.page, limit: pagination.limit };
  }
}
