import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { redondear2 } from '../../common/utils/numero-documento.util';
import { aTexto, hoyLima, serializarFechas } from './fechas';
import { LetrasPaquetesService } from './letras-paquetes.service';
import { LetrasCuotasService } from './letras-cuotas.service';
import { FiltroDeudaDto } from './dto/reportes.dto';
import { FiltroLetrasDto } from './dto/cuotas.dto';

type Moneda = 'PEN' | 'USD';
interface Monto { cantidad: number; monto: number }

export interface FilaDeuda {
  proveedor: { id: string; ruc: string; razon_social: string };
  moneda: Moneda;
  /** Facturas a crédito de Compras que aún no están en ningún paquete. */
  sin_paquete: Monto & { vencido: number };
  /** Paquetes en borrador, por aprobar o aprobados que todavía no tienen letras. */
  en_tramite: Monto;
  por_vencer: Monto;
  vencidas: Monto;
  total: number;
  proxima_fecha: string | null;
}

/** Estados de paquete cuya deuda aún no se convirtió en letras. */
const EN_TRAMITE = ['borrador', 'pendiente_aprobacion', 'aprobado'] as const;
const vacio = (): Monto => ({ cantidad: 0, monto: 0 });

/**
 * Deuda con proveedores (lo que reemplaza a "Deuda corriente" de letras-daytona, que solo miraba los
 * documentos ya puestos en paquetes) y exportaciones a Excel.
 */
@Injectable()
export class LetrasReportesService {
  constructor(
    private prisma: PrismaService,
    private paquetes: LetrasPaquetesService,
    private cuotas: LetrasCuotasService,
  ) {}

  async deuda(f: FiltroDeudaDto) {
    const hoy = hoyLima();
    const filtroProv = { ...(f.id_proveedor && { id_proveedor: f.id_proveedor }), ...(f.moneda && { moneda: f.moneda }) };
    const [compras, tramite, letras] = await Promise.all([
      this.paquetes.comprasSinPaquete(this.prisma, filtroProv),
      this.prisma.tbl_letras_paquetes.findMany({
        where: { ...filtroProv, eliminado: false, estado: { in: [...EN_TRAMITE] } }, select: { id_proveedor: true, moneda: true, monto_total: true },
      }),
      this.prisma.tbl_letras.findMany({
        where: { eliminado: false, estado: 'pendiente', ...(f.moneda && { moneda: f.moneda }), paquete: { eliminado: false, estado: { not: 'cancelado' }, ...(f.id_proveedor && { id_proveedor: f.id_proveedor }) } },
        select: { monto: true, moneda: true, fecha_pago: true, paquete: { select: { id_proveedor: true } } },
      }),
    ]);

    const filas = new Map<string, Omit<FilaDeuda, 'proveedor'> & { id_proveedor: string }>();
    const fila = (idProveedor: string, moneda: Moneda) => {
      const k = `${idProveedor}|${moneda}`;
      if (!filas.has(k)) {
        filas.set(k, { id_proveedor: idProveedor, moneda, sin_paquete: { ...vacio(), vencido: 0 }, en_tramite: vacio(), por_vencer: vacio(), vencidas: vacio(), total: 0, proxima_fecha: null });
      }
      return filas.get(k)!;
    };
    const sumar = (m: Monto, v: number) => { m.cantidad++; m.monto = redondear2(m.monto + v); };

    for (const c of compras) {
      const r = fila(c.id_proveedor, c.moneda);
      sumar(r.sin_paquete, c.monto);
      if (aTexto(c.fecha_vencimiento) < hoy) r.sin_paquete.vencido = redondear2(r.sin_paquete.vencido + c.monto);
    }
    for (const p of tramite) sumar(fila(p.id_proveedor, p.moneda).en_tramite, Number(p.monto_total));
    for (const l of letras) {
      const r = fila(l.paquete.id_proveedor, l.moneda);
      const fecha = aTexto(l.fecha_pago);
      if (fecha < hoy) sumar(r.vencidas, Number(l.monto));
      else {
        sumar(r.por_vencer, Number(l.monto));
        if (!r.proxima_fecha || fecha < r.proxima_fecha) r.proxima_fecha = fecha;
      }
    }

    const proveedores = await this.prisma.tbl_proveedores.findMany({
      where: { id: { in: [...new Set([...filas.values()].map((r) => r.id_proveedor))] } }, select: { id: true, ruc: true, razon_social: true },
    });
    const porId = new Map(proveedores.map((p) => [p.id, p]));
    const buscar = f.search?.trim().toUpperCase();
    const data: FilaDeuda[] = [...filas.values()]
      .map(({ id_proveedor, ...r }) => ({ ...r, proveedor: porId.get(id_proveedor)!, total: redondear2(r.sin_paquete.monto + r.en_tramite.monto + r.por_vencer.monto + r.vencidas.monto) }))
      .filter((r) => r.proveedor && Math.abs(r.total) >= 0.005)
      .filter((r) => !buscar || r.proveedor.razon_social.toUpperCase().includes(buscar) || r.proveedor.ruc.includes(buscar))
      .sort((a, b) => b.vencidas.monto - a.vencidas.monto || b.total - a.total);

    const totales: Record<Moneda, { sin_paquete: number; en_tramite: number; por_vencer: number; vencidas: number; total: number }> = {
      PEN: { sin_paquete: 0, en_tramite: 0, por_vencer: 0, vencidas: 0, total: 0 }, USD: { sin_paquete: 0, en_tramite: 0, por_vencer: 0, vencidas: 0, total: 0 },
    };
    for (const r of data) {
      const t = totales[r.moneda];
      t.sin_paquete = redondear2(t.sin_paquete + r.sin_paquete.monto);
      t.en_tramite = redondear2(t.en_tramite + r.en_tramite.monto);
      t.por_vencer = redondear2(t.por_vencer + r.por_vencer.monto);
      t.vencidas = redondear2(t.vencidas + r.vencidas.monto);
      t.total = redondear2(t.total + r.total);
    }
    return { data, totales, fecha: hoy };
  }

  /** Estado de cuenta de un proveedor: compras sin paquete, paquetes en trámite y letras pendientes. */
  async estadoCuenta(idProveedor: string) {
    const proveedor = await this.prisma.tbl_proveedores.findFirst({
      where: { id: idProveedor }, select: { id: true, ruc: true, razon_social: true, direccion: true, telefono: true, email: true, dias_credito: true, letras_pago_unico: true },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    const [compras, tramite, letras, pagadas] = await Promise.all([
      this.paquetes.comprasSinPaquete(this.prisma, { id_proveedor: idProveedor }),
      this.prisma.tbl_letras_paquetes.findMany({
        where: { id_proveedor: idProveedor, eliminado: false, estado: { in: [...EN_TRAMITE] } },
        select: { id: true, codigo: true, estado: true, moneda: true, monto_total: true, fecha_inicio_pago: true, fecha_fin_pago: true }, orderBy: { fecha_inicio_pago: 'asc' },
      }),
      this.prisma.tbl_letras.findMany({
        where: { eliminado: false, estado: 'pendiente', paquete: { id_proveedor: idProveedor, eliminado: false, estado: { not: 'cancelado' } } },
        include: { paquete: { select: { id: true, codigo: true, banco: { select: { nombre: true, siglas: true } } } } }, orderBy: [{ fecha_pago: 'asc' }, { numero_cuota: 'asc' }],
      }),
      // Últimos pagos, para referencia.
      this.prisma.tbl_letras.findMany({
        where: { eliminado: false, estado: 'pagada', paquete: { id_proveedor: idProveedor, eliminado: false } },
        include: { paquete: { select: { id: true, codigo: true } } }, orderBy: { fecha_pago_efectivo: 'desc' }, take: 10,
      }),
    ]);
    const resumen = (await this.deuda({ id_proveedor: idProveedor })).data;
    return { ...serializarFechas({ proveedor, resumen, compras_sin_paquete: compras, paquetes_en_tramite: tramite, letras_pendientes: letras, ultimos_pagos: pagadas }), fecha: hoyLima() };
  }

  // ─── Excel ─────────────────────────────────────────────────────────────────
  async deudaExcel(f: FiltroDeudaDto): Promise<Buffer> {
    const { data, totales, fecha } = await this.deuda(f);
    const libro = new ExcelJS.Workbook();
    libro.creator = 'MARTSOFT';
    const hoja = libro.addWorksheet('Deuda con proveedores');
    hoja.columns = [
      { header: 'RUC', key: 'ruc', width: 14 },
      { header: 'Proveedor', key: 'proveedor', width: 42 },
      { header: 'Moneda', key: 'moneda', width: 8 },
      { header: 'Compras sin paquete', key: 'sin_paquete', width: 18, style: { numFmt: '#,##0.00' } },
      { header: '…de ellas vencidas', key: 'sin_paquete_vencido', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Paquetes en trámite', key: 'en_tramite', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Letras por vencer', key: 'por_vencer', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Letras vencidas', key: 'vencidas', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Deuda total', key: 'total', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Próxima letra', key: 'proxima', width: 14 },
    ];
    this.estiloCabecera(hoja);
    for (const r of data) {
      hoja.addRow({
        ruc: r.proveedor.ruc, proveedor: r.proveedor.razon_social, moneda: r.moneda, sin_paquete: r.sin_paquete.monto, sin_paquete_vencido: r.sin_paquete.vencido,
        en_tramite: r.en_tramite.monto, por_vencer: r.por_vencer.monto, vencidas: r.vencidas.monto, total: r.total, proxima: r.proxima_fecha ? this.ddmmyyyy(r.proxima_fecha) : '',
      });
    }
    for (const m of ['PEN', 'USD'] as const) {
      const t = totales[m];
      if (!t.total) continue;
      const fila = hoja.addRow({ proveedor: `TOTAL ${m === 'PEN' ? 'SOLES' : 'DÓLARES'}`, moneda: m, sin_paquete: t.sin_paquete, en_tramite: t.en_tramite, por_vencer: t.por_vencer, vencidas: t.vencidas, total: t.total });
      fila.font = { bold: true };
      fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    }
    hoja.addRow([]);
    hoja.addRow([`Al ${this.ddmmyyyy(fecha)}`]);
    return libro.xlsx.writeBuffer().then((b) => Buffer.from(b));
  }

  async letrasExcel(f: FiltroLetrasDto): Promise<Buffer> {
    const { data } = await this.cuotas.listar({ ...f, page: 1, limit: 100_000 } as FiltroLetrasDto);
    const hoy = hoyLima();
    const libro = new ExcelJS.Workbook();
    libro.creator = 'MARTSOFT';
    const hoja = libro.addWorksheet('Letras');
    hoja.columns = [
      { header: 'Fecha de pago', key: 'fecha_pago', width: 13 },
      { header: 'Fecha banco', key: 'fecha_banco', width: 13 },
      { header: 'RUC', key: 'ruc', width: 14 },
      { header: 'Proveedor', key: 'proveedor', width: 40 },
      { header: 'Paquete', key: 'paquete', width: 18 },
      { header: 'Cuota', key: 'cuota', width: 7 },
      { header: 'Moneda', key: 'moneda', width: 8 },
      { header: 'Monto', key: 'monto', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Banco', key: 'banco', width: 12 },
      { header: 'Código banco', key: 'codigo', width: 16 },
      { header: 'Estado', key: 'estado', width: 11 },
      { header: 'Fecha pagada', key: 'pagada', width: 13 },
      { header: 'Método', key: 'metodo', width: 16 },
      { header: 'N° operación', key: 'operacion', width: 16 },
    ];
    this.estiloCabecera(hoja);
    const totales: Record<string, number> = {};
    for (const l of data) {
      const fechaPago = l.fecha_pago as unknown as string;
      const estado = l.estado === 'pendiente' && fechaPago < hoy ? 'VENCIDA' : l.estado.toUpperCase();
      const fila = hoja.addRow({
        fecha_pago: this.ddmmyyyy(fechaPago), fecha_banco: this.ddmmyyyy(l.fecha_banco as unknown as string), ruc: l.paquete.proveedor.ruc,
        proveedor: l.paquete.proveedor.razon_social, paquete: l.paquete.codigo, cuota: l.numero_cuota, moneda: l.moneda, monto: Number(l.monto),
        banco: l.paquete.banco?.siglas || l.paquete.banco?.nombre || '', codigo: l.codigo_banco ?? '', estado,
        pagada: l.fecha_pago_efectivo ? this.ddmmyyyy(l.fecha_pago_efectivo as unknown as string) : '', metodo: l.metodo_pago ?? '', operacion: l.numero_operacion ?? '',
      });
      if (estado === 'VENCIDA') fila.getCell('estado').font = { color: { argb: 'FFCF1322' }, bold: true };
      if (l.estado !== 'cancelada') totales[l.moneda] = redondear2((totales[l.moneda] ?? 0) + Number(l.monto));
    }
    for (const [m, t] of Object.entries(totales)) {
      const fila = hoja.addRow({ proveedor: `TOTAL ${m === 'PEN' ? 'SOLES' : 'DÓLARES'} (sin canceladas)`, moneda: m, monto: t });
      fila.font = { bold: true };
      fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    }
    return libro.xlsx.writeBuffer().then((b) => Buffer.from(b));
  }

  private estiloCabecera(hoja: ExcelJS.Worksheet) {
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private ddmmyyyy(texto: string) {
    const [a, m, d] = texto.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
}
