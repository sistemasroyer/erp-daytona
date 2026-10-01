import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { redondear2 } from '../../common/utils/numero-documento.util';
import { aFecha, aTexto, diaSemanaIso, sumarDias } from './fechas';
import {
  analizarDistribucion, DatosDistribucion, DistribucionError, rangoAnalisis, recalcularDistribucion, type ConfigDistribucion, DIAS_BANCO,
} from './distribucion/motor-distribucion';
import { GuardarLetrasDto } from './dto/generacion.dto';

/** Tipo de cambio por defecto de letras-daytona cuando no hay uno registrado. */
const TIPO_CAMBIO_DEFECTO = 3.75;

/**
 * Generación de letras de un paquete aprobado: lee de la BD lo que necesita el motor de
 * distribución (puro, ver distribucion/motor-distribucion.ts) y guarda la propuesta elegida.
 */
@Injectable()
export class LetrasGeneracionService {
  constructor(private prisma: PrismaService) {}

  async analizar(idPaquete: string, config: ConfigDistribucion) {
    const datos = await this.cargarDatos(idPaquete, config);
    try {
      const r = analizarDistribucion(datos);
      return { ...r, tipo_cambio: datos.tipoCambio, dias_banco: DIAS_BANCO, monto_total: datos.paquete.monto_total, moneda: datos.paquete.moneda };
    } catch (err) {
      if (err instanceof DistribucionError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  async recalcular(idPaquete: string, numeroCuotas: number, config: ConfigDistribucion) {
    const datos = await this.cargarDatos(idPaquete, config);
    try {
      const r = recalcularDistribucion(datos, numeroCuotas);
      return { ...r, tipo_cambio: datos.tipoCambio, dias_banco: DIAS_BANCO, monto_total: datos.paquete.monto_total, moneda: datos.paquete.moneda };
    } catch (err) {
      if (err instanceof DistribucionError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  /**
   * Guarda las letras (la propuesta, quizá ajustada a mano) y pasa el paquete a En proceso.
   * Con `regenerar` reemplaza las letras existentes. A diferencia de letras-daytona, no se permite
   * regenerar si ya hay letras pagadas (el PHP las borraba también).
   */
  async guardar(idPaquete: string, dto: GuardarLetrasDto, usuarioId: string) {
    const paquete = await this.prisma.tbl_letras_paquetes.findFirst({
      where: { id: idPaquete, eliminado: false }, include: { proveedor: { select: { letras_pago_unico: true } } },
    });
    if (!paquete) throw new NotFoundException('Paquete no encontrado');
    if (paquete.estado === 'en_proceso' && !dto.regenerar) throw new BadRequestException('El paquete ya tiene letras. Use "Regenerar" para reemplazarlas.');
    const permitidos = dto.regenerar ? ['aprobado', 'en_proceso'] : ['aprobado'];
    if (!permitidos.includes(paquete.estado)) {
      throw new BadRequestException(dto.regenerar ? 'Solo se regeneran letras de paquetes Aprobados o En proceso' : 'Solo se generan letras de paquetes Aprobados');
    }
    if (paquete.proveedor.letras_pago_unico && dto.letras.length > 1) throw new BadRequestException('Proveedor de PAGO ÚNICO: solo una letra');

    const suma = redondear2(dto.letras.reduce((s, l) => s + l.monto, 0));
    if (Math.abs(suma - Number(paquete.monto_total)) > 0.01) {
      throw new BadRequestException(`La suma de las letras (${suma.toFixed(2)}) no coincide con el monto del paquete (${Number(paquete.monto_total).toFixed(2)})`);
    }
    const fechas = dto.letras.map((l) => l.fecha_pago);
    if (new Set(fechas).size !== fechas.length) throw new BadRequestException('Hay dos letras con la misma fecha de pago');
    const noPago = await this.prisma.tbl_dias_no_pago.findMany({
      where: { eliminado: false, estado: true, fecha: { in: fechas.map(aFecha) } }, select: { fecha: true, descripcion: true },
    });
    if (noPago.length) throw new BadRequestException(`${aTexto(noPago[0].fecha)} es día de no pago (${noPago[0].descripcion})`);
    const domingo = fechas.find((f) => diaSemanaIso(f) === 7);
    if (domingo) throw new BadRequestException(`${domingo} es domingo: no se programan pagos`);

    return this.prisma.$transaction(async (tx) => {
      const existentes = await tx.tbl_letras.findMany({ where: { id_paquete: idPaquete, eliminado: false }, select: { estado: true } });
      if (existentes.length && !dto.regenerar) throw new BadRequestException('El paquete ya tiene letras. Use "Regenerar" para reemplazarlas.');
      if (existentes.some((l) => l.estado === 'pagada')) {
        throw new BadRequestException('El paquete tiene letras pagadas: no se puede regenerar. Ajuste las letras pendientes una por una.');
      }
      if (existentes.length) {
        await tx.tbl_letras.updateMany({ where: { id_paquete: idPaquete, eliminado: false }, data: { eliminado: true, usuario_modificacion: usuarioId } });
      }
      const ordenadas = [...dto.letras].sort((a, b) => a.fecha_pago.localeCompare(b.fecha_pago));
      await tx.tbl_letras.createMany({
        data: ordenadas.map((l, i) => ({
          id_paquete: idPaquete, numero_cuota: i + 1, moneda: paquete.moneda, monto: redondear2(l.monto),
          fecha_pago: aFecha(l.fecha_pago), fecha_banco: aFecha(sumarDias(l.fecha_pago, -DIAS_BANCO)),
          observaciones: dto.regenerar ? 'REGENERADA' : 'GENERADA', usuario_creacion: usuarioId,
        })),
      });
      await tx.tbl_letras_paquetes.update({
        where: { id: idPaquete }, data: { estado: 'en_proceso', numero_cuotas: ordenadas.length, usuario_modificacion: usuarioId },
      });
      return { id: idPaquete, letras: ordenadas.length, regenerado: !!dto.regenerar };
    });
  }

  /** Arma la entrada del motor: paquete, tipo de cambio, días de no pago, límites y letras ya programadas. */
  private async cargarDatos(idPaquete: string, config: ConfigDistribucion): Promise<DatosDistribucion> {
    const p = await this.prisma.tbl_letras_paquetes.findFirst({
      where: { id: idPaquete, eliminado: false }, include: { proveedor: { select: { letras_pago_unico: true } } },
    });
    if (!p) throw new NotFoundException('Paquete no encontrado');
    if (!['aprobado', 'en_proceso'].includes(p.estado)) throw new BadRequestException('El paquete debe estar Aprobado o En proceso para generar letras');
    if (Number(p.monto_total) <= 0) throw new BadRequestException('El paquete no tiene monto');

    const paquete = {
      id: p.id, id_proveedor: p.id_proveedor, moneda: p.moneda, monto_total: Number(p.monto_total),
      fecha_inicio_pago: aTexto(p.fecha_inicio_pago), fecha_fin_pago: aTexto(p.fecha_fin_pago),
      cuotas_referencial: p.numero_cuotas, pago_unico: p.proveedor.letras_pago_unico,
    };
    const { desde, hasta } = rangoAnalisis(paquete);

    // Tipo de cambio vigente al inicio del pago (venta), igual que obtenerTipoCambio() del PHP.
    const tc = await this.prisma.tbl_tipos_cambio.findFirst({
      where: { eliminado: false, fecha: { lte: aFecha(paquete.fecha_inicio_pago) } }, orderBy: { fecha: 'desc' }, select: { venta: true },
    });
    const [diasNoPago, limites, letras] = await Promise.all([
      this.prisma.tbl_dias_no_pago.findMany({ where: { eliminado: false, estado: true, fecha: { gte: aFecha(desde), lte: aFecha(hasta) } }, select: { fecha: true } }),
      this.prisma.tbl_limites_pago_dia.findMany({ where: { eliminado: false, estado: true } }),
      this.prisma.tbl_letras.findMany({
        where: {
          eliminado: false, estado: { not: 'cancelada' }, id_paquete: { not: idPaquete },
          fecha_pago: { gte: aFecha(desde), lte: aFecha(hasta) }, paquete: { eliminado: false },
        },
        select: { fecha_pago: true, monto: true, moneda: true, paquete: { select: { id_proveedor: true } } },
      }),
    ]);

    return {
      paquete,
      config,
      tipoCambio: tc && Number(tc.venta) > 0 ? Number(tc.venta) : TIPO_CAMBIO_DEFECTO,
      diasNoPago: new Set(diasNoPago.map((d) => aTexto(d.fecha))),
      limites: limites.map((l) => ({ dia_semana: l.dia_semana, moneda: l.moneda, monto_maximo: Number(l.monto_maximo) })),
      letrasProgramadas: letras.map((l) => ({ fecha_pago: aTexto(l.fecha_pago), monto: Number(l.monto), moneda: l.moneda, id_proveedor: l.paquete.id_proveedor })),
    };
  }
}
