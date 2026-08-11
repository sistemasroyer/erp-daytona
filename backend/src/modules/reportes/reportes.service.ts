import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from '../inventario/inventario.repository';
import { finDeDia } from '../../common/utils/fecha.util';
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

@Injectable()
export class ReportesService {
  constructor(
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
  ) {}

  async reporteVentas(filtros: FiltroReporte) {
    const where: any = { eliminado: false, estado_venta: { not: 'canjeada' } };

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

  async reporteCompras(filtros: FiltroReporte) {
    const where: any = { eliminado: false };

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

    const detalle = await this.prisma.tbl_detalle_tomas_inventario.findMany({
      where,
      include: {
        producto: { select: { codigo: true, nombre: true, ubicacion: true, unidad_medida: { select: { simbolo: true } } } },
        toma: { select: { numero_interno: true, estado: true, fecha_inicio: true, usuario: { select: { nombre: true, apellido: true } } } },
      },
      orderBy: { fecha_conteo: 'desc' },
      take: 1000,
    });

    const totales = {
      cantidad: detalle.length,
      sobran: detalle.filter((d) => Number(d.diferencia) > 0).length,
      faltan: detalle.filter((d) => Number(d.diferencia) < 0).length,
      ok: detalle.filter((d) => Number(d.diferencia) === 0).length,
    };

    return { detalle, totales };
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
    workbook.creator = 'ERP Daytona';
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
}
