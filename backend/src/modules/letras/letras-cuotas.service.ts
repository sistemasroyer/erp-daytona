import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { redondear2 } from '../../common/utils/numero-documento.util';
import { aMayusculas, mayus } from '../../common/utils/texto.util';
import { aFecha, aTexto, diaSemanaIso, hoyLima, serializarFechas, sumarDias } from './fechas';
import { convertir, DIAS_BANCO, LIMITE_POR_DEFECTO } from './distribucion/motor-distribucion';
import {
  CalendarioDto, CambiarFechaLetraDto, CambiarMontoLetraDto, CodigoBancoDto, EliminarLetraDto, FiltroLetrasDto, PagarLetraDto,
} from './dto/cuotas.dto';

type Tx = Prisma.TransactionClient;

/** % que se permite pasar el límite del día al mover una letra a mano (move-letra.php de letras-daytona). */
const TOLERANCIA_MOVER = 10;
/** El monto pagado puede diferir hasta 10% del de la letra (registrar-pago.php). */
const TOLERANCIA_PAGO = 0.1;
const TIPO_CAMBIO_DEFECTO = 3.75;

const INCLUDE_LETRA = {
  paquete: {
    select: {
      id: true, codigo: true, estado: true, moneda: true,
      proveedor: { select: { id: true, ruc: true, razon_social: true } },
      banco: { select: { id: true, nombre: true, siglas: true } },
    },
  },
  usuario_pago: { select: { nombre: true, apellido: true } },
} satisfies Prisma.tbl_letrasInclude;

/**
 * Letras (cuotas) ya generadas: listado, pago, código del banco, cambios de monto/fecha con
 * redistribución entre las pendientes del paquete, eliminación y calendario de pagos.
 * "Vencida" no se guarda: es una letra pendiente cuya fecha de pago ya pasó (hora de Lima).
 */
@Injectable()
export class LetrasCuotasService {
  constructor(private prisma: PrismaService) {}

  // ─── Listado ───────────────────────────────────────────────────────────────
  async listar(f: FiltroLetrasDto) {
    const where = this.filtro(f);
    const page = f.page ?? 1;
    const limit = f.limit ?? 50;
    const [data, total] = await Promise.all([
      this.prisma.tbl_letras.findMany({
        where, include: INCLUDE_LETRA, orderBy: [{ fecha_pago: 'asc' }, { numero_cuota: 'asc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.tbl_letras.count({ where }),
    ]);
    return { data: serializarFechas(data), total, page, limit };
  }

  /** Totales del filtro actual, por moneda y estado (para las tarjetas del listado). */
  async resumen(f: FiltroLetrasDto) {
    const where = this.filtro(f);
    const hoy = aFecha(hoyLima());
    const [porEstado, vencidas] = await Promise.all([
      this.prisma.tbl_letras.groupBy({ by: ['moneda', 'estado'], where, _sum: { monto: true }, _count: true }),
      this.prisma.tbl_letras.groupBy({ by: ['moneda'], where: { AND: [where, { estado: 'pendiente', fecha_pago: { lt: hoy } }] }, _sum: { monto: true }, _count: true }),
    ]);
    const resultado: Record<string, Record<string, { cantidad: number; monto: number }>> = { PEN: {}, USD: {} };
    for (const g of porEstado) resultado[g.moneda][g.estado] = { cantidad: g._count, monto: redondear2(Number(g._sum.monto ?? 0)) };
    for (const g of vencidas) resultado[g.moneda].vencida = { cantidad: g._count, monto: redondear2(Number(g._sum.monto ?? 0)) };
    return resultado;
  }

  private filtro(f: FiltroLetrasDto): Prisma.tbl_letrasWhereInput {
    const where: Prisma.tbl_letrasWhereInput = { eliminado: false, paquete: { eliminado: false } };
    const hoy = aFecha(hoyLima());
    if (f.estado === 'vencida') Object.assign(where, { estado: 'pendiente', fecha_pago: { lt: hoy } });
    else if (f.estado === 'por_vencer') Object.assign(where, { estado: 'pendiente', fecha_pago: { gte: hoy } });
    else if (f.estado) where.estado = f.estado;
    if (f.moneda) where.moneda = f.moneda;
    if (f.id_paquete) where.id_paquete = f.id_paquete;
    if (f.id_proveedor) where.paquete = { eliminado: false, id_proveedor: f.id_proveedor };
    if (f.fecha_desde || f.fecha_hasta) {
      const rango: Prisma.DateTimeFilter = (where.fecha_pago as Prisma.DateTimeFilter) ?? {};
      if (f.fecha_desde) rango.gte = aFecha(f.fecha_desde);
      if (f.fecha_hasta) rango.lte = aFecha(f.fecha_hasta);
      where.fecha_pago = rango;
    }
    if (f.search) {
      where.OR = [
        { codigo_banco: { contains: f.search, mode: 'insensitive' } },
        { paquete: { codigo: { contains: f.search, mode: 'insensitive' } } },
        { paquete: { proveedor: { razon_social: { contains: f.search, mode: 'insensitive' } } } },
        { paquete: { proveedor: { ruc: { contains: f.search } } } },
      ];
    }
    return where;
  }

  // ─── Pago y código de banco ───────────────────────────────────────────────
  async pagar(id: string, dto: PagarLetraDto, usuarioId: string) {
    dto = aMayusculas(dto, ['metodo_pago', 'numero_operacion', 'observaciones']);
    const letra = await this.obtenerPendiente(id, 'pagar');
    if (dto.fecha_pago_efectivo > hoyLima()) throw new BadRequestException('La fecha de pago no puede ser futura');
    const monto = Number(letra.monto);
    const diferencia = Math.abs(dto.monto_pagado - monto);
    if (diferencia > monto * TOLERANCIA_PAGO) {
      throw new BadRequestException(`El monto pagado (${dto.monto_pagado.toFixed(2)}) difiere más de 10% del de la letra (${monto.toFixed(2)})`);
    }
    const nota = `PAGO ${dto.fecha_pago_efectivo} - ${dto.metodo_pago}${dto.numero_operacion ? ` - OP ${dto.numero_operacion}` : ''}${dto.observaciones ? ` - ${dto.observaciones}` : ''}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.tbl_letras.update({
        where: { id },
        data: {
          estado: 'pagada', fecha_pago_efectivo: aFecha(dto.fecha_pago_efectivo), metodo_pago: dto.metodo_pago,
          numero_operacion: dto.numero_operacion, monto_pagado: redondear2(dto.monto_pagado), id_usuario_pago: usuarioId,
          observaciones: [letra.observaciones, nota].filter(Boolean).join('\n'), usuario_modificacion: usuarioId,
        },
      });
      const completado = await this.completarPaqueteSiCorresponde(tx, letra.id_paquete, usuarioId);
      return { id, estado: 'pagada', paquete_completado: completado };
    });
  }

  async codigoBanco(id: string, dto: CodigoBancoDto, usuarioId: string) {
    const letra = await this.obtener(id);
    if (letra.estado === 'cancelada') throw new BadRequestException('La letra está cancelada');
    const codigo = mayus(dto.codigo_banco.trim()) || null;
    await this.prisma.tbl_letras.update({ where: { id }, data: { codigo_banco: codigo, usuario_modificacion: usuarioId } });
    return { id, codigo_banco: codigo };
  }

  // ─── Cambios de monto / fecha / eliminación ───────────────────────────────
  /** Cambia el monto de una letra pendiente y reparte la diferencia entre las demás pendientes del
   * paquete, en proporción a su monto (la última absorbe el redondeo) — editar-letra.php. */
  async cambiarMonto(id: string, dto: CambiarMontoLetraDto, usuarioId: string) {
    const letra = await this.obtenerPendiente(id, 'modificar');
    const nuevo = redondear2(dto.monto);
    const delta = redondear2(nuevo - Number(letra.monto));
    if (Math.abs(delta) < 0.005) throw new BadRequestException('El monto no cambió');
    return this.prisma.$transaction(async (tx) => {
      const otras = await this.pendientesDelPaquete(tx, letra.id_paquete, id);
      if (!otras.length) throw new BadRequestException('No hay otras letras pendientes donde repartir la diferencia; el total del paquete quedaría descuadrado');
      const totalOtras = otras.reduce((s, o) => s + Number(o.monto), 0);
      if (totalOtras - delta < otras.length * 0.01) throw new BadRequestException('Las demás letras pendientes no alcanzan para absorber ese aumento');
      await tx.tbl_letras.update({ where: { id }, data: { monto: nuevo, usuario_modificacion: usuarioId } });
      await this.redistribuir(tx, otras, -delta, usuarioId);
      return { id, monto: nuevo, redistribuidas: otras.length };
    });
  }

  /** Mueve la fecha de pago (y la de banco, siempre 7 días antes). Valida domingo, día de no pago,
   * otra letra del mismo paquete esa fecha, y el límite del día +10% (salvo `forzar`). */
  async cambiarFecha(id: string, dto: CambiarFechaLetraDto, usuarioId: string) {
    const letra = await this.obtenerPendiente(id, 'mover');
    const fecha = dto.fecha_pago;
    if (diaSemanaIso(fecha) === 7) throw new BadRequestException('No se programan pagos en domingo');
    const noPago = await this.prisma.tbl_dias_no_pago.findFirst({ where: { fecha: aFecha(fecha), eliminado: false, estado: true } });
    if (noPago) throw new BadRequestException(`${fecha} es día de no pago (${noPago.descripcion})`);
    const misma = await this.prisma.tbl_letras.count({ where: { id_paquete: letra.id_paquete, fecha_pago: aFecha(fecha), id: { not: id }, eliminado: false } });
    if (misma) throw new BadRequestException('Ya hay otra letra de este paquete en esa fecha');

    const dia = await this.capacidadDia(fecha, letra.moneda, id);
    const total = dia.programado + Number(letra.monto);
    const excede = total > dia.limite * (1 + TOLERANCIA_MOVER / 100);
    if (excede && !dto.forzar) {
      throw new BadRequestException(`Ese día quedaría en ${letra.moneda} ${total.toFixed(2)}, más del límite (${dia.limite.toFixed(2)}) + ${TOLERANCIA_MOVER}%. Confirme para moverla igual.`);
    }
    await this.prisma.tbl_letras.update({
      where: { id },
      data: { fecha_pago: aFecha(fecha), fecha_banco: aFecha(sumarDias(fecha, -DIAS_BANCO)), usuario_modificacion: usuarioId },
    });
    return { id, fecha_pago: fecha, fecha_banco: sumarDias(fecha, -DIAS_BANCO), total_dia: redondear2(total), limite_dia: dia.limite, excede };
  }

  /** Elimina una letra pendiente. Su monto: `auto` se reparte entre las demás pendientes, `elegir` va a
   * una letra destino, `ninguno` se pierde (el paquete queda descuadrado). Si no quedan letras, el
   * paquete vuelve a Aprobado para poder generarlas de nuevo. */
  async eliminar(id: string, dto: EliminarLetraDto, usuarioId: string) {
    const letra = await this.obtenerPendiente(id, 'eliminar');
    const monto = Number(letra.monto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.modo === 'auto') {
        const otras = await this.pendientesDelPaquete(tx, letra.id_paquete, id);
        if (!otras.length) throw new BadRequestException('No hay otras letras pendientes donde repartir el monto');
        await this.redistribuir(tx, otras, monto, usuarioId);
      } else if (dto.modo === 'elegir') {
        if (!dto.id_destino) throw new BadRequestException('Indique la letra que recibe el monto');
        const destino = await tx.tbl_letras.findFirst({ where: { id: dto.id_destino, id_paquete: letra.id_paquete, eliminado: false, estado: 'pendiente' } });
        if (!destino || destino.id === id) throw new BadRequestException('La letra destino no es válida o ya está pagada');
        await tx.tbl_letras.update({ where: { id: destino.id }, data: { monto: redondear2(Number(destino.monto) + monto), usuario_modificacion: usuarioId } });
      }
      await tx.tbl_letras.update({ where: { id }, data: { eliminado: true, usuario_modificacion: usuarioId } });
      await this.renumerar(tx, letra.id_paquete);
      const quedan = await tx.tbl_letras.count({ where: { id_paquete: letra.id_paquete, eliminado: false, estado: { not: 'cancelada' } } });
      if (quedan === 0) {
        await tx.tbl_letras_paquetes.update({ where: { id: letra.id_paquete }, data: { estado: 'aprobado', usuario_modificacion: usuarioId } });
      } else {
        await this.completarPaqueteSiCorresponde(tx, letra.id_paquete, usuarioId);
      }
      return { id, eliminada: true };
    });
  }

  // ─── Calendario ────────────────────────────────────────────────────────────
  /** Letras por día entre dos fechas, con total del día y límite, todo convertido a `moneda` (vista). */
  async calendario(dto: CalendarioDto) {
    const moneda = dto.moneda ?? 'PEN';
    const tc = await this.tipoCambio(dto.desde);
    const [letras, noPago, limites] = await Promise.all([
      this.prisma.tbl_letras.findMany({
        where: { eliminado: false, estado: { not: 'cancelada' }, paquete: { eliminado: false }, fecha_pago: { gte: aFecha(dto.desde), lte: aFecha(dto.hasta) } },
        include: INCLUDE_LETRA, orderBy: [{ fecha_pago: 'asc' }, { monto: 'desc' }],
      }),
      this.prisma.tbl_dias_no_pago.findMany({ where: { eliminado: false, estado: true, fecha: { gte: aFecha(dto.desde), lte: aFecha(dto.hasta) } } }),
      this.prisma.tbl_limites_pago_dia.findMany({ where: { eliminado: false, estado: true } }),
    ]);
    const limitePorDia = this.limitesConvertidos(limites, moneda, tc);
    const noPagoMap = new Map(noPago.map((d) => [aTexto(d.fecha), d.descripcion]));
    const hoy = hoyLima();
    const dias: Record<string, { fecha: string; total: number; limite: number; no_pago: string | null; domingo: boolean; letras: unknown[] }> = {};
    for (let f = dto.desde; f <= dto.hasta; f = sumarDias(f, 1)) {
      dias[f] = { fecha: f, total: 0, limite: redondear2(limitePorDia[diaSemanaIso(f)]), no_pago: noPagoMap.get(f) ?? null, domingo: diaSemanaIso(f) === 7, letras: [] };
    }
    for (const l of serializarFechas(letras)) {
      const d = dias[l.fecha_pago as unknown as string];
      if (!d) continue;
      const enVista = convertir(Number(l.monto), l.moneda, moneda, tc);
      d.total = redondear2(d.total + enVista);
      d.letras.push({ ...l, monto_vista: redondear2(enVista), vencida: l.estado === 'pendiente' && (l.fecha_pago as unknown as string) < hoy });
    }
    return { moneda, tipo_cambio: tc, dias: Object.values(dias) };
  }

  // ─── Utilidades ────────────────────────────────────────────────────────────
  private async obtener(id: string) {
    const letra = await this.prisma.tbl_letras.findFirst({ where: { id, eliminado: false, paquete: { eliminado: false } } });
    if (!letra) throw new NotFoundException('Letra no encontrada');
    return letra;
  }

  private async obtenerPendiente(id: string, accion: string) {
    const letra = await this.obtener(id);
    if (letra.estado !== 'pendiente') throw new BadRequestException(`No se puede ${accion} una letra ${letra.estado}`);
    return letra;
  }

  private pendientesDelPaquete(tx: Tx, idPaquete: string, excluir: string) {
    return tx.tbl_letras.findMany({
      where: { id_paquete: idPaquete, eliminado: false, estado: 'pendiente', id: { not: excluir } },
      orderBy: { fecha_pago: 'asc' }, select: { id: true, monto: true },
    });
  }

  /** redistribuirMonto() de letras-utils.php: proporcional al monto de cada una; la última absorbe el redondeo. */
  private async redistribuir(tx: Tx, otras: { id: string; monto: Prisma.Decimal }[], delta: number, usuarioId: string) {
    const totalOtras = otras.reduce((s, o) => s + Number(o.monto), 0);
    let acumulado = 0;
    for (let i = 0; i < otras.length; i++) {
      const ultima = i === otras.length - 1;
      const ajuste = ultima
        ? redondear2(delta - acumulado)
        : redondear2(totalOtras > 0 ? delta * (Number(otras[i].monto) / totalOtras) : delta / otras.length);
      acumulado = redondear2(acumulado + ajuste);
      await tx.tbl_letras.update({
        where: { id: otras[i].id }, data: { monto: Math.max(0.01, redondear2(Number(otras[i].monto) + ajuste)), usuario_modificacion: usuarioId },
      });
    }
  }

  /** Numera de nuevo las letras vigentes del paquete por fecha (1..n). */
  private async renumerar(tx: Tx, idPaquete: string) {
    const letras = await tx.tbl_letras.findMany({ where: { id_paquete: idPaquete, eliminado: false }, orderBy: [{ fecha_pago: 'asc' }, { numero_cuota: 'asc' }], select: { id: true, numero_cuota: true } });
    for (let i = 0; i < letras.length; i++) {
      if (letras[i].numero_cuota !== i + 1) await tx.tbl_letras.update({ where: { id: letras[i].id }, data: { numero_cuota: i + 1 } });
    }
    await tx.tbl_letras_paquetes.update({ where: { id: idPaquete }, data: { numero_cuotas: Math.max(1, letras.length) } });
  }

  private async completarPaqueteSiCorresponde(tx: Tx, idPaquete: string, usuarioId: string) {
    const pendientes = await tx.tbl_letras.count({ where: { id_paquete: idPaquete, eliminado: false, estado: 'pendiente' } });
    const pagadas = await tx.tbl_letras.count({ where: { id_paquete: idPaquete, eliminado: false, estado: 'pagada' } });
    if (pendientes === 0 && pagadas > 0) {
      await tx.tbl_letras_paquetes.update({ where: { id: idPaquete }, data: { estado: 'completado', usuario_modificacion: usuarioId } });
      return true;
    }
    return false;
  }

  private async tipoCambio(fecha: string) {
    const tc = await this.prisma.tbl_tipos_cambio.findFirst({ where: { eliminado: false, fecha: { lte: aFecha(fecha) } }, orderBy: { fecha: 'desc' }, select: { venta: true } });
    return tc && Number(tc.venta) > 0 ? Number(tc.venta) : TIPO_CAMBIO_DEFECTO;
  }

  private limitesConvertidos(limites: { dia_semana: number; moneda: 'PEN' | 'USD'; monto_maximo: Prisma.Decimal }[], moneda: 'PEN' | 'USD', tc: number) {
    const r: Record<number, number> = {};
    for (const l of limites) {
      const v = convertir(Number(l.monto_maximo), l.moneda, moneda, tc);
      if (r[l.dia_semana] === undefined || v > r[l.dia_semana]) r[l.dia_semana] = v;
    }
    for (let d = 1; d <= 7; d++) if (r[d] === undefined) r[d] = LIMITE_POR_DEFECTO;
    return r;
  }

  /** Lo ya programado ese día (otras letras, todas las monedas convertidas) y su límite, en `moneda`. */
  private async capacidadDia(fecha: string, moneda: 'PEN' | 'USD', excluir: string) {
    const tc = await this.tipoCambio(fecha);
    const [letras, limites] = await Promise.all([
      this.prisma.tbl_letras.findMany({ where: { fecha_pago: aFecha(fecha), eliminado: false, estado: { not: 'cancelada' }, id: { not: excluir }, paquete: { eliminado: false } }, select: { monto: true, moneda: true } }),
      this.prisma.tbl_limites_pago_dia.findMany({ where: { eliminado: false, estado: true } }),
    ]);
    const programado = letras.reduce((s, l) => s + convertir(Number(l.monto), l.moneda, moneda, tc), 0);
    return { programado, limite: this.limitesConvertidos(limites, moneda, tc)[diaSemanaIso(fecha)] };
  }
}
