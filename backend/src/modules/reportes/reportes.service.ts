import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from '../inventario/inventario.repository';
import { finDeDia } from '../../common/utils/fecha.util';
import { redondear2 } from '../../common/utils/numero-documento.util';
import * as ExcelJS from 'exceljs';

export interface FiltroReporte {
  fecha_desde?: string;
  fecha_hasta?: string;
  id_usuario?: string;
  id_almacen?: string;
  id_proveedor?: string;
  id_cliente?: string;
  id_punto_venta?: string;
  estado?: string;
}

export type AgrupacionVentas = 'producto' | 'marca' | 'punto_venta';

export interface GrupoProductoTomaInventario {
  clave: string;
  nombre: string;
  diferencia_unidades: number;
  valor_diferencia: number;
  veces_contado: number;
}

@Injectable()
export class ReportesService {
  constructor(
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
  ) {}

  async reporteVentas(filtros: FiltroReporte) {
    const where: any = { eliminado: false, estado_venta: { notIn: ['canjeada', 'anulada'] } };

    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha_emision = {};
      if (filtros.fecha_desde) where.fecha_emision.gte = new Date(filtros.fecha_desde);
      if (filtros.fecha_hasta) where.fecha_emision.lte = finDeDia(filtros.fecha_hasta);
    }
    if (filtros.id_usuario) where.id_usuario_vendedor = filtros.id_usuario;
    if (filtros.id_punto_venta) where.id_punto_venta = filtros.id_punto_venta;
    if (filtros.estado) where.estado_sunat = filtros.estado;

    const ventas = await this.prisma.tbl_ventas.findMany({
      where,
      include: {
        cliente: { select: { razon_social: true, numero_documento: true } },
        vendedor: { select: { nombre: true, apellido: true } },
        pagos: { include: { metodo_pago: { select: { nombre: true } } } },
      },
      orderBy: { fecha_emision: 'asc' },
    });

    const totales = ventas.reduce((acc, v) => ({
      subtotal: acc.subtotal + Number(v.subtotal),
      igv: acc.igv + Number(v.igv),
      total: acc.total + Number(v.total),
    }), { subtotal: 0, igv: 0, total: 0 });

    return {
      ventas,
      totales: {
        subtotal: Math.round(totales.subtotal * 100) / 100,
        igv: Math.round(totales.igv * 100) / 100,
        total: Math.round(totales.total * 100) / 100,
        cantidad: ventas.length,
      },
      filtros,
    };
  }

  /**
   * Ventas agrupadas por producto/marca/punto de venta, en unidades y soles.
   * Solo cuenta ventas reales (afecto_stock: true — excluye Cotizaciones) y no duplica una
   * Nota de Venta ya canjeada a Boleta/Factura (mismo criterio que reporteVentas). Las Notas
   * de Crédito restan (son una devolución), para que el neto refleje lo realmente vendido.
   */
  async reporteVentasAgrupado(filtros: FiltroReporte & { agrupar_por: AgrupacionVentas }) {
    const whereVenta: any = {
      eliminado: false,
      estado_venta: { notIn: ['canjeada', 'anulada'] },
      afecto_stock: true,
    };
    if (filtros.fecha_desde || filtros.fecha_hasta) {
      whereVenta.fecha_emision = {};
      if (filtros.fecha_desde) whereVenta.fecha_emision.gte = new Date(filtros.fecha_desde);
      if (filtros.fecha_hasta) whereVenta.fecha_emision.lte = finDeDia(filtros.fecha_hasta);
    }
    if (filtros.id_punto_venta) whereVenta.id_punto_venta = filtros.id_punto_venta;

    const detalles = await this.prisma.tbl_detalle_ventas.findMany({
      where: { venta: whereVenta },
      select: {
        id_venta: true,
        cantidad: true,
        subtotal: true,
        igv: true,
        total: true,
        producto: {
          select: {
            id: true, codigo: true, nombre: true,
            marca: { select: { id: true, nombre: true } },
          },
        },
        // tbl_ventas.id_punto_venta no tiene relación FK real hacia tbl_puntos_venta
        // (vínculo débil, mismo patrón que id_compra_relacionada/id_orden_compra en otros
        // módulos), así que el nombre de la tienda se resuelve aparte en lote más abajo.
        venta: {
          select: { tipo_documento: true, id_punto_venta: true },
        },
      },
    });

    let nombresPuntoVenta = new Map<string, string>();
    if (filtros.agrupar_por === 'punto_venta') {
      const idsPuntoVenta = [...new Set(detalles.map((d) => d.venta.id_punto_venta).filter((id): id is string => !!id))];
      const puntosVenta = await this.prisma.tbl_puntos_venta.findMany({
        where: { id: { in: idsPuntoVenta } },
        select: { id: true, nombre: true },
      });
      nombresPuntoVenta = new Map(puntosVenta.map((p) => [p.id, p.nombre]));
    }

    interface Grupo { clave: string; nombre: string; unidades: number; subtotal: number; igv: number; total: number; comprobantes: Set<string> }
    const grupos = new Map<string, Grupo>();

    for (const d of detalles) {
      const signo = d.venta.tipo_documento === 'NOTA_CREDITO' ? -1 : 1;

      let clave: string;
      let nombre: string;
      if (filtros.agrupar_por === 'producto') {
        clave = d.producto.id;
        nombre = `${d.producto.codigo} - ${d.producto.nombre}`;
      } else if (filtros.agrupar_por === 'marca') {
        clave = d.producto.marca?.id || 'sin-marca';
        nombre = d.producto.marca?.nombre || 'Sin marca';
      } else if (filtros.agrupar_por === 'punto_venta') {
        clave = d.venta.id_punto_venta || 'sin-tienda';
        nombre = (d.venta.id_punto_venta && nombresPuntoVenta.get(d.venta.id_punto_venta)) || 'Sin tienda';
      } else {
        throw new BadRequestException('agrupar_por inválido');
      }

      let grupo = grupos.get(clave);
      if (!grupo) {
        grupo = { clave, nombre, unidades: 0, subtotal: 0, igv: 0, total: 0, comprobantes: new Set() };
        grupos.set(clave, grupo);
      }
      grupo.unidades += signo * Number(d.cantidad);
      grupo.subtotal += signo * Number(d.subtotal);
      grupo.igv += signo * Number(d.igv);
      grupo.total += signo * Number(d.total);
      grupo.comprobantes.add(d.id_venta);
    }

    const data = Array.from(grupos.values())
      .map((g) => ({
        clave: g.clave,
        nombre: g.nombre,
        unidades: redondear2(g.unidades),
        comprobantes: g.comprobantes.size,
        subtotal: redondear2(g.subtotal),
        igv: redondear2(g.igv),
        total: redondear2(g.total),
      }))
      .sort((a, b) => b.total - a.total);

    const totales = {
      ...data.reduce(
        (acc, g) => ({
          unidades: acc.unidades + g.unidades,
          subtotal: redondear2(acc.subtotal + g.subtotal),
          igv: redondear2(acc.igv + g.igv),
          total: redondear2(acc.total + g.total),
        }),
        { unidades: 0, subtotal: 0, igv: 0, total: 0 },
      ),
      comprobantes: new Set(detalles.map((d) => d.id_venta)).size,
    };

    return { data, totales };
  }

  async reporteCompras(filtros: FiltroReporte) {
    const where: any = { eliminado: false, estado: { not: 'anulada' } };

    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha_emision = {};
      if (filtros.fecha_desde) where.fecha_emision.gte = new Date(filtros.fecha_desde);
      if (filtros.fecha_hasta) where.fecha_emision.lte = finDeDia(filtros.fecha_hasta);
    }
    if (filtros.id_proveedor) where.id_proveedor = filtros.id_proveedor;

    const compras = await this.prisma.tbl_compras.findMany({
      where,
      include: {
        proveedor: { select: { razon_social: true, ruc: true } },
        almacen: { select: { nombre: true } },
      },
      orderBy: { fecha_emision: 'asc' },
    });

    const totales = compras.reduce((acc, c) => ({
      subtotal: acc.subtotal + Number(c.subtotal),
      igv: acc.igv + Number(c.igv),
      total: acc.total + Number(c.total),
    }), { subtotal: 0, igv: 0, total: 0 });

    return { compras, totales: { ...totales, cantidad: compras.length }, filtros };
  }

  async reporteInventario(filtros: FiltroReporte) {
    const where: any = { eliminado: false };
    if (filtros.id_almacen) where.id_almacen = filtros.id_almacen;

    return this.prisma.tbl_inventario.findMany({
      where,
      include: {
        producto: {
          select: {
            codigo: true, nombre: true, stock_minimo: true, stock_maximo: true,
            precio_venta_1: true, costo_promedio: true,
            categoria: { select: { nombre: true } },
            unidad_medida: { select: { simbolo: true } },
          },
        },
        almacen: { select: { nombre: true } },
      },
      orderBy: { producto: { nombre: 'asc' } },
    });
  }

  async reporteTomasInventario(filtros: FiltroReporte & { search?: string; tipo_diferencia?: 'sobra' | 'falta' | 'ok'; estado_toma?: string }) {
    const where: any = {};

    if (filtros.search) {
      where.producto = {
        OR: [
          { nombre: { contains: filtros.search, mode: 'insensitive' } },
          { codigo: { contains: filtros.search, mode: 'insensitive' } },
        ],
      };
    }
    if (filtros.tipo_diferencia === 'sobra') where.diferencia = { gt: 0 };
    else if (filtros.tipo_diferencia === 'falta') where.diferencia = { lt: 0 };
    else if (filtros.tipo_diferencia === 'ok') where.diferencia = 0;

    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha_conteo = {};
      if (filtros.fecha_desde) where.fecha_conteo.gte = new Date(filtros.fecha_desde);
      if (filtros.fecha_hasta) where.fecha_conteo.lte = finDeDia(filtros.fecha_hasta);
    }
    if (filtros.estado_toma) where.toma = { estado: filtros.estado_toma };

    const detalleCrudo = await this.prisma.tbl_detalle_tomas_inventario.findMany({
      where,
      include: {
        producto: {
          select: {
            codigo: true, nombre: true, ubicacion: true, costo_promedio: true,
            unidad_medida: { select: { simbolo: true } },
          },
        },
        toma: { select: { numero_interno: true, estado: true, fecha_inicio: true, usuario: { select: { nombre: true, apellido: true } } } },
      },
      orderBy: { fecha_conteo: 'desc' },
      take: 1000,
    });

    // Valor de la diferencia al costo promedio actual del producto: una falta es plata que ya no
    // está (pérdida), un sobra es inventario de más que el sistema no sabía que tenía.
    const detalle = detalleCrudo.map((d) => ({
      ...d,
      valor_diferencia: redondear2(Number(d.diferencia) * Number(d.producto.costo_promedio)),
    }));

    const totales = {
      cantidad: detalle.length,
      sobran: detalle.filter((d) => Number(d.diferencia) > 0).length,
      faltan: detalle.filter((d) => Number(d.diferencia) < 0).length,
      ok: detalle.filter((d) => Number(d.diferencia) === 0).length,
      valor_sobrante: redondear2(detalle.filter((d) => d.valor_diferencia > 0).reduce((s, d) => s + d.valor_diferencia, 0)),
      valor_faltante: redondear2(detalle.filter((d) => d.valor_diferencia < 0).reduce((s, d) => s + d.valor_diferencia, 0)),
      valor_neto: redondear2(detalle.reduce((s, d) => s + d.valor_diferencia, 0)),
    };

    // Ranking por producto (puede aparecer en varias tomas): útil para ver qué producto se
    // sigue perdiendo/sobrando de forma recurrente, no solo el conteo de una toma puntual.
    const porProductoMap = new Map<string, GrupoProductoTomaInventario>();
    for (const d of detalle) {
      const clave = `${d.producto.codigo}|${d.producto.nombre}`;
      let g = porProductoMap.get(clave);
      if (!g) {
        g = { clave, nombre: `${d.producto.codigo} - ${d.producto.nombre}`, diferencia_unidades: 0, valor_diferencia: 0, veces_contado: 0 };
        porProductoMap.set(clave, g);
      }
      g.diferencia_unidades = redondear2(g.diferencia_unidades + Number(d.diferencia));
      g.valor_diferencia = redondear2(g.valor_diferencia + d.valor_diferencia);
      g.veces_contado += 1;
    }
    const porProducto = Array.from(porProductoMap.values()).sort((a, b) => a.valor_diferencia - b.valor_diferencia);

    return { detalle, totales, porProducto };
  }

  async reporteKardex(idProducto: string, filtros: FiltroReporte & { limit?: number; skip?: number }) {
    return this.inventarioRepo.obtenerKardex(
      idProducto,
      filtros.id_almacen,
      filtros.fecha_desde ? new Date(filtros.fecha_desde) : undefined,
      filtros.fecha_hasta ? new Date(filtros.fecha_hasta) : undefined,
      undefined,
      Number(filtros.limit) || undefined,
      Number(filtros.skip) || undefined,
    );
  }

  async reporteAuditoria(filtros: FiltroReporte & { tabla?: string }) {
    const where: any = {};
    if (filtros.id_usuario) where.id_usuario = filtros.id_usuario;
    if (filtros['tabla']) where.tabla = filtros['tabla'];
    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha = {};
      if (filtros.fecha_desde) where.fecha.gte = new Date(filtros.fecha_desde);
      if (filtros.fecha_hasta) where.fecha.lte = finDeDia(filtros.fecha_hasta);
    }

    return this.prisma.tbl_auditoria.findMany({
      where,
      include: { usuario: { select: { nombre: true, apellido: true, email: true } } },
      orderBy: { fecha: 'desc' },
      take: 500,
    });
  }

  async exportarVentasExcel(filtros: FiltroReporte): Promise<Buffer> {
    const { ventas, totales } = await this.reporteVentas(filtros);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MARTSOFT';
    const sheet = workbook.addWorksheet('Ventas');

    sheet.columns = [
      { header: 'Comprobante', key: 'comprobante', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Cliente', key: 'cliente', width: 40 },
      { header: 'RUC/DNI', key: 'documento', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'IGV', key: 'igv', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Total', key: 'total', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Moneda', key: 'moneda', width: 10 },
      { header: 'Estado SUNAT', key: 'estado_sunat', width: 15 },
      { header: 'Vendedor', key: 'vendedor', width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    ventas.forEach((v) => {
      sheet.addRow({
        comprobante: v.numero_comprobante,
        fecha: v.fecha_emision.toISOString().split('T')[0],
        cliente: v.cliente.razon_social,
        documento: v.cliente.numero_documento,
        subtotal: Number(v.subtotal),
        igv: Number(v.igv),
        total: Number(v.total),
        moneda: v.moneda,
        estado_sunat: v.estado_sunat,
        vendedor: v.vendedor ? `${v.vendedor.nombre} ${v.vendedor.apellido}` : '',
      });
    });

    const filaTotal = sheet.addRow({
      comprobante: 'TOTALES',
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
    });
    filaTotal.font = { bold: true };
    filaTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };

    return workbook.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
  }

  private static readonly NOMBRE_AGRUPACION: Record<AgrupacionVentas, string> = {
    producto: 'Producto',
    marca: 'Marca',
    punto_venta: 'Punto de Venta',
  };

  async exportarVentasAgrupadoExcel(filtros: FiltroReporte & { agrupar_por: AgrupacionVentas }): Promise<Buffer> {
    const { data, totales } = await this.reporteVentasAgrupado(filtros);
    const etiqueta = ReportesService.NOMBRE_AGRUPACION[filtros.agrupar_por];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MARTSOFT';
    const sheet = workbook.addWorksheet(`Ventas por ${etiqueta}`);

    sheet.columns = [
      { header: etiqueta, key: 'nombre', width: 45 },
      { header: 'Unidades', key: 'unidades', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Comprobantes', key: 'comprobantes', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'IGV', key: 'igv', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Total', key: 'total', width: 15, style: { numFmt: '#,##0.00' } },
    ];

    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.forEach((g) => sheet.addRow(g));

    const filaTotal = sheet.addRow({
      nombre: 'TOTALES',
      unidades: totales.unidades,
      comprobantes: totales.comprobantes,
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
    });
    filaTotal.font = { bold: true };
    filaTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };

    return workbook.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
  }

  async exportarInventarioExcel(filtros: FiltroReporte): Promise<Buffer> {
    const inventario = await this.reporteInventario(filtros);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');

    sheet.columns = [
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Producto', key: 'nombre', width: 45 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Almacén', key: 'almacen', width: 20 },
      { header: 'Stock', key: 'stock', width: 12, style: { numFmt: '#,##0.0000' } },
      { header: 'Stock Mín.', key: 'stock_min', width: 12 },
      { header: 'Stock Máx.', key: 'stock_max', width: 12 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      { header: 'Costo Prom.', key: 'costo', width: 15, style: { numFmt: '#,##0.0000' } },
      { header: 'Precio Vta 1', key: 'precio', width: 15, style: { numFmt: '#,##0.0000' } },
      { header: 'Valor Stock', key: 'valor', width: 15, style: { numFmt: '#,##0.00' } },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };

    inventario.forEach((inv) => {
      const stock = Number(inv.stock_actual);
      const costo = Number(inv.producto.costo_promedio);
      sheet.addRow({
        codigo: inv.producto.codigo,
        nombre: inv.producto.nombre,
        categoria: inv.producto.categoria?.nombre || '',
        almacen: inv.almacen.nombre,
        stock,
        stock_min: Number(inv.producto.stock_minimo),
        stock_max: Number(inv.producto.stock_maximo),
        unidad: inv.producto.unidad_medida.simbolo,
        costo,
        precio: Number(inv.producto.precio_venta_1),
        valor: Math.round(stock * costo * 100) / 100,
      });
    });

    return workbook.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
  }

  async exportarTomasInventarioExcel(filtros: FiltroReporte & { search?: string; tipo_diferencia?: 'sobra' | 'falta' | 'ok'; estado_toma?: string }): Promise<Buffer> {
    const { detalle, totales } = await this.reporteTomasInventario(filtros);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MARTSOFT';
    const sheet = workbook.addWorksheet('Tomas de Inventario');

    sheet.columns = [
      { header: 'Toma', key: 'toma', width: 15 },
      { header: 'Fecha conteo', key: 'fecha', width: 18 },
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Producto', key: 'nombre', width: 40 },
      { header: 'Ubicación', key: 'ubicacion', width: 15 },
      { header: 'Stock sistema', key: 'stock_sistema', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Cant. contada', key: 'cant_contada', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Diferencia', key: 'diferencia', width: 12, style: { numFmt: '#,##0' } },
      { header: 'Valor diferencia (S/)', key: 'valor', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Responsable', key: 'responsable', width: 25 },
      { header: 'Observaciones', key: 'observaciones', width: 30 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };

    detalle.forEach((d) => {
      sheet.addRow({
        toma: d.toma.numero_interno,
        fecha: d.fecha_conteo.toISOString().split('T')[0],
        codigo: d.producto.codigo,
        nombre: d.producto.nombre,
        ubicacion: d.producto.ubicacion || '',
        stock_sistema: Number(d.stock_sistema),
        cant_contada: Number(d.cantidad_contada),
        diferencia: Number(d.diferencia),
        valor: d.valor_diferencia,
        responsable: d.toma.usuario ? `${d.toma.usuario.nombre} ${d.toma.usuario.apellido}` : '',
        observaciones: d.observaciones || '',
      });
    });

    const filaTotal = sheet.addRow({ toma: 'TOTALES', valor: totales.valor_neto });
    filaTotal.font = { bold: true };
    filaTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };

    return workbook.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
  }
}
