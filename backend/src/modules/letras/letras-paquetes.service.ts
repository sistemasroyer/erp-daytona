import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, EstadoPaqueteLetras } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { aMayusculas, mayus } from '../../common/utils/texto.util';
import { redondear2 } from '../../common/utils/numero-documento.util';
import { historialDocumento } from '../../common/utils/historial-documento.util';
import { aFecha, aTexto, diasEntre, serializarFechas, sumarDias } from './fechas';
import {
  CreatePaqueteDto, DocumentoLetraDto, FiltroPaquetesDto, ImportarComprasDto, MotivoDto,
  UpdateDocumentoLetraDto, UpdatePaqueteDto,
} from './dto/paquetes.dto';

type Tx = Prisma.TransactionClient;

const ESTADO_LABEL: Record<EstadoPaqueteLetras, string> = {
  borrador: 'Borrador', pendiente_aprobacion: 'Pendiente de aprobación', aprobado: 'Aprobado',
  en_proceso: 'En proceso', completado: 'Completado', cancelado: 'Cancelado',
};

const INCLUDE_LISTADO = {
  proveedor: { select: { id: true, ruc: true, razon_social: true, letras_pago_unico: true } },
  banco: { select: { id: true, nombre: true, siglas: true } },
} satisfies Prisma.tbl_letras_paquetesInclude;

/**
 * Paquetes de letras: agrupan las facturas (y notas de crédito) a crédito de un proveedor en una
 * moneda, para pagarlas en cuotas (letras). Flujo de estados (igual que letras-daytona, pero con
 * transiciones explícitas en vez de un "cambiar estado" libre):
 *
 *   borrador ──enviar──▶ pendiente_aprobacion ──aprobar──▶ aprobado ──(generar letras)──▶ en_proceso ──(todas pagadas)──▶ completado
 *      ▲  └──────────────────aprobar────────────────────────▲   │
 *      └──devolver── pendiente_aprobacion        reabrir ◀──┘ (solo sin letras)
 *   cualquiera salvo completado ──cancelar──▶ cancelado (si no hay letras pagadas)
 *
 * Los documentos solo se agregan/editan en Borrador.
 */
@Injectable()
export class LetrasPaquetesService {
  constructor(private prisma: PrismaService) {}

  // ─── Consulta ──────────────────────────────────────────────────────────────
  async listar(filtros: FiltroPaquetesDto) {
    const where: Prisma.tbl_letras_paquetesWhereInput = { eliminado: false };
    if (filtros.estado) where.estado = filtros.estado as EstadoPaqueteLetras;
    if (filtros.id_proveedor) where.id_proveedor = filtros.id_proveedor;
    if (filtros.moneda) where.moneda = filtros.moneda;
    if (filtros.search) {
      where.OR = [
        { codigo: { contains: filtros.search, mode: 'insensitive' } },
        { proveedor: { razon_social: { contains: filtros.search, mode: 'insensitive' } } },
        { proveedor: { ruc: { contains: filtros.search } } },
      ];
    }
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const [paquetes, total] = await Promise.all([
      this.prisma.tbl_letras_paquetes.findMany({
        where, include: INCLUDE_LISTADO, orderBy: { fecha_creacion: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.tbl_letras_paquetes.count({ where }),
    ]);
    const conteos = await this.conteoLetras(paquetes.map((p) => p.id));
    const data = paquetes.map((p) => ({ ...p, letras_total: conteos[p.id]?.total ?? 0, letras_pagadas: conteos[p.id]?.pagadas ?? 0 }));
    return { data: serializarFechas(data), total, page, limit };
  }

  /** Cantidad de paquetes por estado, para las tarjetas de resumen. */
  async resumen() {
    const grupos = await this.prisma.tbl_letras_paquetes.groupBy({ by: ['estado'], where: { eliminado: false }, _count: true });
    const resultado = Object.fromEntries(Object.keys(ESTADO_LABEL).map((e) => [e, 0])) as Record<EstadoPaqueteLetras, number>;
    for (const g of grupos) resultado[g.estado] = g._count;
    return resultado;
  }

  async obtener(id: string) {
    const paquete = await this.prisma.tbl_letras_paquetes.findFirst({
      where: { id, eliminado: false },
      include: {
        ...INCLUDE_LISTADO,
        aprobador: { select: { nombre: true, apellido: true } },
        documentos: {
          where: { eliminado: false }, orderBy: [{ fecha_emision: 'asc' }, { numero: 'asc' }],
          include: { compra: { select: { id: true, numero_interno: true } } },
        },
        letras: {
          where: { eliminado: false }, orderBy: { numero_cuota: 'asc' },
          include: { usuario_pago: { select: { nombre: true, apellido: true } } },
        },
      },
    });
    if (!paquete) throw new NotFoundException('Paquete no encontrado');
    const historial = await historialDocumento(this.prisma, 'letras_paquetes', {
      id: paquete.id, anulado: paquete.estado === 'cancelado',
      usuario_modificacion: paquete.usuario_modificacion, fecha_modificacion: paquete.fecha_modificacion,
    });
    const usuarioCreacion = paquete.usuario_creacion
      ? await this.prisma.tbl_usuarios.findFirst({ where: { id: paquete.usuario_creacion }, select: { nombre: true, apellido: true } })
      : null;
    // Notas de crédito de sus facturas que no están en ningún paquete: un descuento que se perdería.
    const idsFacturas = paquete.documentos.map((d) => d.id_compra).filter((x): x is string => !!x);
    const ncFueraDelPaquete = idsFacturas.length && !['completado', 'cancelado'].includes(paquete.estado)
      ? await this.prisma.tbl_compras.findMany({
          where: {
            id_compra_original: { in: idsFacturas }, tipo_documento: 'nota_credito', estado: 'registrada', eliminado: false,
            documentos_letras: { none: { eliminado: false, paquete: { eliminado: false, estado: { not: 'cancelado' } } } },
          },
          select: { id: true, numero_interno: true, serie: true, numero: true },
        })
      : [];
    // El historial lleva fecha Y hora: no pasa por serializarFechas (que deja solo el día).
    return { ...serializarFechas({ ...paquete, usuario: usuarioCreacion }), nc_fuera_del_paquete: ncFueraDelPaquete, ...historial };
  }

  // ─── Alta / edición ────────────────────────────────────────────────────────
  async crear(dto: CreatePaqueteDto, usuarioId: string) {
    dto = aMayusculas(dto, ['comentarios']);
    const proveedor = await this.prisma.tbl_proveedores.findFirst({ where: { id: dto.id_proveedor, eliminado: false } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    if (dto.id_banco) await this.assertBanco(dto.id_banco);
    if (proveedor.letras_pago_unico && dto.numero_cuotas > 1) {
      throw new BadRequestException('Este proveedor es de PAGO ÚNICO: el paquete debe ser de 1 cuota');
    }

    // El código lleva un correlativo por proveedor y año; si dos usuarios crean a la vez, se reintenta.
    for (let intento = 0; intento < 3; intento++) {
      const codigo = await this.generarCodigo(proveedor.razon_social, proveedor.ruc);
      try {
        const paquete = await this.prisma.$transaction(async (tx) => {
          const creado = await tx.tbl_letras_paquetes.create({
            data: {
              codigo, id_proveedor: dto.id_proveedor, id_banco: dto.id_banco, moneda: dto.moneda,
              fecha_inicio_pago: aFecha(dto.fecha_inicio_pago),
              fecha_fin_pago: aFecha(sumarDias(dto.fecha_inicio_pago, dto.dias_credito)),
              dias_credito: dto.dias_credito, numero_cuotas: dto.numero_cuotas, comentarios: dto.comentarios,
              usuario_creacion: usuarioId,
            },
          });
          // Creado desde Compras: el paquete nace ya con esas facturas (todo o nada).
          if (dto.ids_compras?.length) await this.importarEnTx(tx, creado, dto.ids_compras, usuarioId);
          return tx.tbl_letras_paquetes.findUniqueOrThrow({ where: { id: creado.id }, include: INCLUDE_LISTADO });
        });
        return serializarFechas(paquete);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && intento < 2) continue;
        throw err;
      }
    }
    throw new ConflictException('No se pudo generar un código único para el paquete; intente de nuevo');
  }

  async actualizar(id: string, dto: UpdatePaqueteDto, usuarioId: string) {
    dto = aMayusculas(dto, ['comentarios']);
    const paquete = await this.obtenerBase(id);
    if (!['borrador', 'pendiente_aprobacion'].includes(paquete.estado)) {
      throw new BadRequestException('Solo se puede editar un paquete en Borrador o Pendiente de aprobación');
    }
    if (dto.id_banco) await this.assertBanco(dto.id_banco);
    if (dto.numero_cuotas && dto.numero_cuotas > 1) {
      const prov = await this.prisma.tbl_proveedores.findUnique({ where: { id: paquete.id_proveedor } });
      if (prov?.letras_pago_unico) throw new BadRequestException('Este proveedor es de PAGO ÚNICO: el paquete debe ser de 1 cuota');
    }
    const inicio = dto.fecha_inicio_pago ?? aTexto(paquete.fecha_inicio_pago);
    const dias = dto.dias_credito ?? paquete.dias_credito;
    const actualizado = await this.prisma.tbl_letras_paquetes.update({
      where: { id },
      data: {
        id_banco: dto.id_banco, numero_cuotas: dto.numero_cuotas, comentarios: dto.comentarios,
        dias_credito: dias, fecha_inicio_pago: aFecha(inicio), fecha_fin_pago: aFecha(sumarDias(inicio, dias)),
        usuario_modificacion: usuarioId,
      },
      include: INCLUDE_LISTADO,
    });
    return serializarFechas(actualizado);
  }

  async eliminar(id: string, usuarioId: string) {
    const paquete = await this.obtenerBase(id);
    if (paquete.estado !== 'borrador') throw new BadRequestException('Solo se puede eliminar un paquete en Borrador; si no, cancélelo');
    const letras = await this.prisma.tbl_letras.count({ where: { id_paquete: id, eliminado: false } });
    if (letras > 0) throw new BadRequestException('El paquete tiene letras generadas; no se puede eliminar');
    await this.prisma.$transaction([
      this.prisma.tbl_letras_documentos.updateMany({ where: { id_paquete: id, eliminado: false }, data: { eliminado: true, usuario_modificacion: usuarioId } }),
      this.prisma.tbl_letras_paquetes.update({ where: { id }, data: { eliminado: true, usuario_modificacion: usuarioId } }),
    ]);
    return { id };
  }

  // ─── Estados ───────────────────────────────────────────────────────────────
  async enviar(id: string, usuarioId: string) {
    const paquete = await this.obtenerBase(id);
    this.assertEstado(paquete.estado, ['borrador'], 'enviar a aprobación');
    await this.assertTieneMonto(paquete.id);
    return this.cambiarEstado(id, 'pendiente_aprobacion', usuarioId);
  }

  async devolver(id: string, usuarioId: string) {
    const paquete = await this.obtenerBase(id);
    this.assertEstado(paquete.estado, ['pendiente_aprobacion'], 'devolver a borrador');
    return this.cambiarEstado(id, 'borrador', usuarioId);
  }

  async aprobar(id: string, usuarioId: string) {
    const paquete = await this.obtenerBase(id);
    this.assertEstado(paquete.estado, ['borrador', 'pendiente_aprobacion'], 'aprobar');
    await this.assertTieneMonto(paquete.id);
    return this.cambiarEstado(id, 'aprobado', usuarioId, { id_usuario_aprobador: usuarioId, fecha_aprobacion: new Date() });
  }

  async reabrir(id: string, usuarioId: string) {
    const paquete = await this.obtenerBase(id);
    this.assertEstado(paquete.estado, ['aprobado'], 'reabrir');
    const letras = await this.prisma.tbl_letras.count({ where: { id_paquete: id, eliminado: false } });
    if (letras > 0) throw new BadRequestException('El paquete ya tiene letras generadas; elimínelas antes de reabrirlo');
    return this.cambiarEstado(id, 'borrador', usuarioId, { id_usuario_aprobador: null, fecha_aprobacion: null });
  }

  /** Cancela el paquete: sus letras pendientes quedan canceladas y sus documentos vuelven a estar
   * disponibles para otro paquete. No se permite si ya hay letras pagadas. */
  async cancelar(id: string, dto: MotivoDto, usuarioId: string) {
    const paquete = await this.obtenerBase(id);
    if (['completado', 'cancelado'].includes(paquete.estado)) {
      throw new BadRequestException(`El paquete ya está ${ESTADO_LABEL[paquete.estado].toLowerCase()}`);
    }
    const pagadas = await this.prisma.tbl_letras.count({ where: { id_paquete: id, eliminado: false, estado: 'pagada' } });
    if (pagadas > 0) throw new BadRequestException(`El paquete tiene ${pagadas} letra(s) pagada(s); no se puede cancelar`);
    const motivo = mayus(dto.motivo.trim());
    return this.prisma.$transaction(async (tx) => {
      await tx.tbl_letras.updateMany({
        where: { id_paquete: id, eliminado: false, estado: 'pendiente' },
        data: { estado: 'cancelada', usuario_modificacion: usuarioId },
      });
      const comentarios = [paquete.comentarios, `CANCELADO: ${motivo}`].filter(Boolean).join(' | ').slice(0, 500);
      await tx.tbl_letras_paquetes.update({ where: { id }, data: { estado: 'cancelado', comentarios, usuario_modificacion: usuarioId } });
      return { id, estado: 'cancelado' };
    });
  }

  // ─── Documentos ────────────────────────────────────────────────────────────
  async agregarDocumento(idPaquete: string, dto: DocumentoLetraDto, usuarioId: string) {
    dto = aMayusculas(dto, ['serie', 'numero']);
    const paquete = await this.obtenerBase(idPaquete);
    this.assertEstado(paquete.estado, ['borrador'], 'agregar documentos');
    await this.assertDocumentoUnico(paquete.id_proveedor, dto.serie, dto.numero);
    return this.prisma.$transaction(async (tx) => {
      const vencimiento = dto.fecha_vencimiento ?? dto.fecha_emision;
      const doc = await tx.tbl_letras_documentos.create({
        data: {
          id_paquete: idPaquete, tipo: dto.tipo, serie: dto.serie, numero: dto.numero, moneda: paquete.moneda,
          monto: this.montoConSigno(dto.tipo, dto.monto),
          fecha_emision: aFecha(dto.fecha_emision), fecha_vencimiento: aFecha(vencimiento),
          dias_credito: Math.max(0, diasEntre(dto.fecha_emision, vencimiento)),
          usuario_creacion: usuarioId,
        },
      });
      await this.recalcularTotal(tx, idPaquete);
      return serializarFechas(doc);
    });
  }

  async actualizarDocumento(idPaquete: string, idDocumento: string, dto: UpdateDocumentoLetraDto, usuarioId: string) {
    dto = aMayusculas(dto, ['serie', 'numero']);
    const paquete = await this.obtenerBase(idPaquete);
    this.assertEstado(paquete.estado, ['borrador'], 'editar documentos');
    const doc = await this.prisma.tbl_letras_documentos.findFirst({ where: { id: idDocumento, id_paquete: idPaquete, eliminado: false } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (doc.id_compra && (dto.monto !== undefined || dto.tipo || dto.serie || dto.numero)) {
      throw new BadRequestException('Este documento viene de una compra registrada: sus datos se corrigen en Compras, no aquí');
    }
    const serie = dto.serie ?? doc.serie;
    const numero = dto.numero ?? doc.numero;
    if (serie !== doc.serie || numero !== doc.numero) await this.assertDocumentoUnico(paquete.id_proveedor, serie, numero, idDocumento);
    const tipo = dto.tipo ?? doc.tipo;
    const emision = dto.fecha_emision ?? aTexto(doc.fecha_emision);
    const vencimiento = dto.fecha_vencimiento ?? (doc.fecha_vencimiento ? aTexto(doc.fecha_vencimiento) : emision);
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.tbl_letras_documentos.update({
        where: { id: idDocumento },
        data: {
          tipo, serie, numero,
          monto: this.montoConSigno(tipo, dto.monto ?? Math.abs(Number(doc.monto))),
          fecha_emision: aFecha(emision), fecha_vencimiento: aFecha(vencimiento),
          dias_credito: Math.max(0, diasEntre(emision, vencimiento)),
          usuario_modificacion: usuarioId,
        },
      });
      await this.recalcularTotal(tx, idPaquete);
      return serializarFechas(actualizado);
    });
  }

  async eliminarDocumento(idPaquete: string, idDocumento: string, usuarioId: string) {
    const paquete = await this.obtenerBase(idPaquete);
    this.assertEstado(paquete.estado, ['borrador'], 'quitar documentos');
    const doc = await this.prisma.tbl_letras_documentos.findFirst({ where: { id: idDocumento, id_paquete: idPaquete, eliminado: false } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    await this.prisma.$transaction(async (tx) => {
      await tx.tbl_letras_documentos.update({ where: { id: idDocumento }, data: { eliminado: true, usuario_modificacion: usuarioId } });
      await this.recalcularTotal(tx, idPaquete);
    });
    return { id: idDocumento };
  }

  /**
   * Compras del proveedor que se pueden pasar al paquete (reemplaza la tabla de "facturas importables"
   * de letras-daytona): facturas a CRÉDITO registradas en la moneda del paquete, y las notas de crédito
   * de esas compras, que todavía no estén en otro paquete vigente. El monto es el de la factura en su
   * moneda original (suma de importe_linea), no el total convertido a soles que guarda la compra.
   */
  async comprasDisponibles(idPaquete: string) {
    const paquete = await this.obtenerBase(idPaquete);
    return serializarFechas(await this.buscarComprasDisponibles(this.prisma, paquete.id_proveedor, paquete.moneda));
  }

  async importarCompras(idPaquete: string, dto: ImportarComprasDto, usuarioId: string) {
    const paquete = await this.obtenerBase(idPaquete);
    this.assertEstado(paquete.estado, ['borrador'], 'agregar documentos');
    return this.prisma.$transaction(async (tx) => {
      await this.importarEnTx(tx, paquete, dto.ids, usuarioId);
      return { importados: dto.ids.length };
    });
  }

  /**
   * Nota de crédito de compra recién registrada (dentro de la transacción de Compras): si su factura
   * está en un paquete en Borrador, se agrega sola al paquete; si el paquete ya avanzó, se devuelve un
   * aviso de qué hacer (queda disponible para descontarse en otro paquete del proveedor).
   */
  async ubicarNotaCreditoEnTx(tx: Tx, idNc: string, idCompraOriginal: string, usuarioId: string) {
    const doc = await tx.tbl_letras_documentos.findFirst({
      where: { id_compra: idCompraOriginal, eliminado: false, paquete: { eliminado: false, estado: { not: 'cancelado' } } },
      select: { paquete: { select: { id: true, codigo: true, estado: true, id_proveedor: true, moneda: true } } },
    });
    if (!doc) return null;
    const p = doc.paquete;
    const base = { id_paquete: p.id, codigo: p.codigo, estado: p.estado };
    if (p.estado === 'borrador') {
      await this.importarEnTx(tx, p, [idNc], usuarioId);
      return { ...base, agregada: true, mensaje: `La nota de crédito se agregó al paquete de letras ${p.codigo} (Borrador) y su total bajó.` };
    }
    const queHacer: Record<string, string> = {
      pendiente_aprobacion: 'Para descontarla de este paquete, devuélvalo a Borrador y agréguela con "Agregar desde Compras".',
      aprobado: 'Para descontarla de este paquete, reábralo y agréguela con "Agregar desde Compras".',
      en_proceso: 'Ese paquete ya tiene letras generadas, así que no se cambió.',
      completado: 'Ese paquete ya está pagado, así que no se cambió.',
    };
    return {
      ...base, agregada: false,
      mensaje: `La factura de esta nota de crédito está en el paquete de letras ${p.codigo}. ${queHacer[p.estado] ?? ''} `
        + 'Si no, la nota queda disponible para descontarse en el próximo paquete de este proveedor.',
    };
  }

  private async importarEnTx(tx: Tx, paquete: { id: string; id_proveedor: string; moneda: 'PEN' | 'USD' }, ids: string[], usuarioId: string) {
    const disponibles = await this.buscarComprasDisponibles(tx, paquete.id_proveedor, paquete.moneda);
    const porId = new Map(disponibles.map((c) => [c.id, c]));
    const noDisponibles = ids.filter((id) => !porId.has(id));
    if (noDisponibles.length) {
      throw new BadRequestException(`${noDisponibles.length} compra(s) no se pueden agregar: ya están en otro paquete, son de otro proveedor u otra moneda, o no son a crédito. Actualice la lista.`);
    }
    for (const id of new Set(ids)) {
      const c = porId.get(id)!;
      await tx.tbl_letras_documentos.create({
        data: {
          id_paquete: paquete.id, id_compra: c.id, tipo: c.tipo, serie: c.serie, numero: c.numero, moneda: paquete.moneda,
          monto: c.monto, fecha_emision: c.fecha_emision, fecha_vencimiento: c.fecha_vencimiento,
          dias_credito: c.dias_credito, usuario_creacion: usuarioId,
        },
      });
    }
    await this.recalcularTotal(tx, paquete.id);
  }

  private buscarComprasDisponibles(db: Tx | PrismaService, idProveedor: string, moneda: 'PEN' | 'USD') {
    return this.comprasSinPaquete(db, { id_proveedor: idProveedor, moneda });
  }

  /** Facturas a crédito (y sus NC) de Compras que todavía no están en un paquete vigente: deuda que aún no pasó a letras. */
  async comprasSinPaquete(db: Tx | PrismaService, filtro: { id_proveedor?: string; moneda?: 'PEN' | 'USD' } = {}) {
    const compras = await db.tbl_compras.findMany({
      where: {
        ...(filtro.id_proveedor && { id_proveedor: filtro.id_proveedor }), ...(filtro.moneda && { moneda: filtro.moneda }),
        estado: 'registrada', eliminado: false,
        OR: [
          { condicion_pago: 'credito', tipo_documento: { not: 'nota_credito' } },
          { tipo_documento: 'nota_credito' },
        ],
        // No incluida ya en un paquete vigente (los paquetes cancelados o eliminados la liberan).
        documentos_letras: { none: { eliminado: false, paquete: { eliminado: false, estado: { not: 'cancelado' } } } },
      },
      select: {
        id: true, numero_interno: true, tipo_documento: true, serie: true, numero: true, fecha_emision: true,
        fecha_vencimiento: true, condicion_pago: true, id_compra_original: true, id_proveedor: true, moneda: true,
        proveedor: { select: { dias_credito: true } },
        detalle: { select: { importe_linea: true } },
      },
      orderBy: { fecha_emision: 'asc' },
    });

    // Una NC solo entra si su compra original fue a crédito (las NC se registran "al contado").
    const idsOriginales = compras.filter((c) => c.tipo_documento === 'nota_credito' && c.id_compra_original).map((c) => c.id_compra_original!);
    const originalesCredito = new Set(
      (await db.tbl_compras.findMany({ where: { id: { in: idsOriginales }, condicion_pago: 'credito' }, select: { id: true } })).map((c) => c.id),
    );

    return compras
      .filter((c) => c.tipo_documento !== 'nota_credito' || (c.id_compra_original && originalesCredito.has(c.id_compra_original)))
      .map((c) => {
        const esNc = c.tipo_documento === 'nota_credito';
        const importe = redondear2(c.detalle.reduce((s, d) => s + Number(d.importe_linea), 0));
        const emision = aTexto(c.fecha_emision);
        const vencimiento = c.fecha_vencimiento ? aTexto(c.fecha_vencimiento) : sumarDias(emision, esNc ? 0 : c.proveedor.dias_credito);
        return {
          id: c.id,
          id_proveedor: c.id_proveedor,
          moneda: c.moneda as 'PEN' | 'USD',
          numero_interno: c.numero_interno,
          tipo: (esNc ? 'nota_credito' : c.tipo_documento === 'factura' ? 'factura' : 'otro') as 'nota_credito' | 'factura' | 'otro',
          serie: c.serie || '-',
          numero: c.numero || c.numero_interno,
          monto: esNc ? -importe : importe,
          fecha_emision: aFecha(emision),
          fecha_vencimiento: aFecha(vencimiento),
          dias_credito: Math.max(0, diasEntre(emision, vencimiento)),
        };
      });
  }

  // ─── Utilidades ────────────────────────────────────────────────────────────
  private montoConSigno(tipo: string, monto: number) {
    const valor = redondear2(Math.abs(monto));
    return tipo === 'nota_credito' ? -valor : valor;
  }

  private async recalcularTotal(tx: Tx, idPaquete: string) {
    const suma = await tx.tbl_letras_documentos.aggregate({ where: { id_paquete: idPaquete, eliminado: false }, _sum: { monto: true } });
    await tx.tbl_letras_paquetes.update({ where: { id: idPaquete }, data: { monto_total: redondear2(Number(suma._sum.monto ?? 0)) } });
  }

  private async assertTieneMonto(idPaquete: string) {
    const paquete = await this.prisma.tbl_letras_paquetes.findUnique({ where: { id: idPaquete }, select: { monto_total: true } });
    const docs = await this.prisma.tbl_letras_documentos.count({ where: { id_paquete: idPaquete, eliminado: false } });
    if (docs === 0) throw new BadRequestException('El paquete no tiene documentos');
    if (Number(paquete?.monto_total ?? 0) <= 0) throw new BadRequestException('El monto total del paquete debe ser mayor a cero');
  }

  private async assertDocumentoUnico(idProveedor: string, serie: string, numero: string, excluirId?: string) {
    const existe = await this.prisma.tbl_letras_documentos.findFirst({
      where: {
        serie: { equals: serie, mode: 'insensitive' }, numero: { equals: numero, mode: 'insensitive' }, eliminado: false,
        paquete: { id_proveedor: idProveedor, eliminado: false, estado: { not: 'cancelado' } },
        ...(excluirId ? { id: { not: excluirId } } : {}),
      },
      include: { paquete: { select: { codigo: true } } },
    });
    if (existe) throw new ConflictException(`El documento ${serie}-${numero} ya está en el paquete ${existe.paquete.codigo}`);
  }

  private async assertBanco(idBanco: string) {
    const banco = await this.prisma.tbl_bancos.findFirst({ where: { id: idBanco, eliminado: false } });
    if (!banco) throw new NotFoundException('Banco no encontrado');
  }

  private assertEstado(actual: EstadoPaqueteLetras, permitidos: EstadoPaqueteLetras[], accion: string) {
    if (!permitidos.includes(actual)) {
      throw new BadRequestException(`No se puede ${accion}: el paquete está ${ESTADO_LABEL[actual].toLowerCase()}`);
    }
  }

  private async obtenerBase(id: string) {
    const paquete = await this.prisma.tbl_letras_paquetes.findFirst({ where: { id, eliminado: false } });
    if (!paquete) throw new NotFoundException('Paquete no encontrado');
    return paquete;
  }

  private async cambiarEstado(id: string, estado: EstadoPaqueteLetras, usuarioId: string, extra: Prisma.tbl_letras_paquetesUncheckedUpdateInput = {}) {
    const paquete = await this.prisma.tbl_letras_paquetes.update({
      where: { id }, data: { estado, ...extra, usuario_modificacion: usuarioId }, include: INCLUDE_LISTADO,
    });
    return serializarFechas(paquete);
  }

  /** "AAAA-XXNNN-0001": año, 2 primeras letras de la razón social, 3 últimos dígitos del RUC y correlativo
   * (mismo formato que letras-daytona, para que los códigos migrados y los nuevos sigan una sola serie). */
  private async generarCodigo(razonSocial: string, ruc: string) {
    const anio = new Date().getFullYear();
    const prefijo = `${anio}-${razonSocial.slice(0, 2).toUpperCase()}${ruc.slice(-3)}`;
    const ultimo = await this.prisma.tbl_letras_paquetes.findFirst({
      where: { codigo: { startsWith: `${prefijo}-` } }, orderBy: { codigo: 'desc' }, select: { codigo: true },
    });
    const correlativo = ultimo ? Number(ultimo.codigo.split('-').pop()) + 1 : 1;
    return `${prefijo}-${String(correlativo).padStart(4, '0')}`;
  }

  private async conteoLetras(ids: string[]) {
    if (!ids.length) return {} as Record<string, { total: number; pagadas: number }>;
    const grupos = await this.prisma.tbl_letras.groupBy({
      by: ['id_paquete', 'estado'], where: { id_paquete: { in: ids }, eliminado: false }, _count: true,
    });
    const resultado: Record<string, { total: number; pagadas: number }> = {};
    for (const g of grupos) {
      const r = (resultado[g.id_paquete] ??= { total: 0, pagadas: 0 });
      if (g.estado !== 'cancelada') r.total += g._count;
      if (g.estado === 'pagada') r.pagadas += g._count;
    }
    return resultado;
  }
}
