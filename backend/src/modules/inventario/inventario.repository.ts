import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StockInsuficienteException } from '../../common/exceptions/stock-insuficiente.exception';
import { ConcurrenciaException } from '../../common/exceptions/concurrencia.exception';
import { finDeDia } from '../../common/utils/fecha.util';
import { Prisma } from '@prisma/client';
import { obtenerTasaIgv } from '../../common/utils/igv.util';
import { redondear2, redondear4 } from '../../common/utils/numero-documento.util';

export interface MovimientoInventarioInput {
  idProducto: string;
  idAlmacen: string;
  tipo: string;
  cantidad: number;
  costoUnitario?: number;
  motivo?: string;
  idReferencia?: string;
  tipoReferencia?: string;
  idUsuario?: string;
  metodoValuacion?: 'peps' | 'ueps' | 'promedio';
}

@Injectable()
export class InventarioRepository {
  private readonly logger = new Logger(InventarioRepository.name);

  constructor(private prisma: PrismaService) {}

  async registrarMovimiento(input: MovimientoInventarioInput) {
    return this.prisma.$transaction(async (tx) => {
      return this.registrarMovimientoEnTransaccion(input, tx as any);
    }, {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async registrarMovimientoEnTransaccion(
    input: MovimientoInventarioInput,
    tx: Prisma.TransactionClient,
  ) {
    // 1. BLOQUEAR registro con SELECT FOR UPDATE (evita condiciones de carrera)
    const inventarios = await tx.$queryRaw<any[]>`
      SELECT id, id_producto, id_almacen, stock_actual, stock_reservado, version
      FROM tbl_inventario
      WHERE id_producto::text = ${input.idProducto}
        AND id_almacen::text = ${input.idAlmacen}
        AND eliminado = false
      FOR UPDATE
    `;

    let inventario = inventarios[0];

    if (!inventario) {
      // Crear registro de inventario inicial
      const nuevo = await tx.tbl_inventario.create({
        data: {
          id_producto: input.idProducto,
          id_almacen: input.idAlmacen,
          stock_actual: 0,
          stock_reservado: 0,
          usuario_creacion: input.idUsuario,
        },
      });
      // Volver a bloquear el nuevo registro
      const bloqueados = await tx.$queryRaw<any[]>`
        SELECT id, id_producto, id_almacen, stock_actual, stock_reservado, version
        FROM tbl_inventario WHERE id::text = ${nuevo.id} FOR UPDATE
      `;
      inventario = bloqueados[0];
    }

    const stockActual = parseFloat(inventario.stock_actual);
    const cantidad = Math.abs(input.cantidad);
    const esSalida = ['salida', 'ajuste_negativo', 'transferencia_salida'].includes(input.tipo);

    // 2. VALIDAR stock suficiente
    if (esSalida && stockActual < cantidad) {
      const producto = await tx.tbl_productos.findFirst({
        where: { id: input.idProducto },
        select: { nombre: true },
      });
      throw new StockInsuficienteException(
        producto?.nombre,
        stockActual,
        cantidad,
      );
    }

    const nuevoStock = esSalida ? stockActual - cantidad : stockActual + cantidad;

    // 3. REGISTRAR movimiento
    const movimiento = await tx.tbl_movimientos_inventario.create({
      data: {
        id_producto: input.idProducto,
        id_almacen: input.idAlmacen,
        tipo: input.tipo as any,
        motivo: input.motivo,
        cantidad,
        stock_antes: stockActual,
        stock_despues: nuevoStock,
        costo_unitario: input.costoUnitario || 0,
        id_referencia: input.idReferencia,
        tipo_referencia: input.tipoReferencia as any,
        id_usuario: input.idUsuario,
        fecha: new Date(),
      },
    });

    // 4. INSERTAR en kardex (inmutable, solo INSERT)
    const costoTotal = (input.costoUnitario || 0) * cantidad;
    await tx.tbl_kardex.create({
      data: {
        id_producto: input.idProducto,
        id_almacen: input.idAlmacen,
        id_movimiento: movimiento.id,
        fecha: new Date(),
        tipo_movimiento: input.tipo,
        cantidad_entrada: esSalida ? 0 : cantidad,
        cantidad_salida: esSalida ? cantidad : 0,
        costo_unitario: input.costoUnitario || 0,
        costo_total: costoTotal,
        stock_resultante: nuevoStock,
        metodo_valuacion: input.metodoValuacion || 'promedio',
        id_referencia: input.idReferencia,
        tipo_referencia: input.tipoReferencia,
        descripcion: input.motivo,
      },
    });

    // 5. ACTUALIZAR stock con control optimista (version)
    const updated = await tx.$executeRaw`
      UPDATE tbl_inventario
      SET stock_actual = ${nuevoStock},
          version = version + 1,
          fecha_modificacion = NOW()
      WHERE id::text = ${String(inventario.id)}
        AND version = ${Number(inventario.version)}
    `;

    if (updated === 0) {
      throw new ConcurrenciaException('inventario');
    }

    // 6. ACTUALIZAR stock en tbl_productos (campo desnormalizado para rendimiento)
    await this.actualizarStockProducto(tx, input.idProducto);

    // 7. ACTUALIZAR costo promedio si es entrada
    if (!esSalida && input.costoUnitario && input.costoUnitario > 0) {
      await this.actualizarCostoPromedio(tx, input.idProducto, cantidad, input.costoUnitario);
    }

    return { movimiento, nuevoStock, stockAntes: stockActual };
  }

  private async actualizarStockProducto(tx: Prisma.TransactionClient, idProducto: string) {
    const agregado = await tx.tbl_inventario.aggregate({
      where: { id_producto: idProducto, eliminado: false },
      _sum: { stock_actual: true },
    });

    const stockTotal = Number(agregado._sum.stock_actual || 0);

    await tx.tbl_productos.update({
      where: { id: idProducto },
      data: { stock_actual: stockTotal },
    });
  }

  private async actualizarCostoPromedio(
    tx: Prisma.TransactionClient,
    idProducto: string,
    cantidadEntrada: number,
    costoNuevo: number,
  ) {
    const producto = await tx.tbl_productos.findFirst({
      where: { id: idProducto },
      select: { stock_actual: true, costo_promedio: true },
    });

    if (!producto) return;

    const stockAnterior = Number(producto.stock_actual) - cantidadEntrada;
    const costoAnterior = Number(producto.costo_promedio);

    const nuevoPromedio =
      stockAnterior <= 0
        ? costoNuevo
        : (stockAnterior * costoAnterior + cantidadEntrada * costoNuevo) /
          (stockAnterior + cantidadEntrada);
    const tasaIgv = await obtenerTasaIgv(tx);

    await tx.tbl_productos.update({
      where: { id: idProducto },
      data: {
        costo_promedio: parseFloat(nuevoPromedio.toFixed(4)),
        precio_compra_sin_igv: parseFloat(nuevoPromedio.toFixed(4)),
        precio_compra_con_igv: parseFloat((nuevoPromedio * (1 + tasaIgv)).toFixed(4)),
        fecha_ultima_compra: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async obtenerKardex(
    idProducto: string,
    idAlmacen?: string,
    fechaDesde?: Date,
    fechaHasta?: Date,
    _metodo: 'peps' | 'ueps' | 'promedio' = 'promedio',
    limit = 500,
    skip = 0,
  ) {
    // El costo promedio y el saldo valorizado de cada momento no se guardan en tbl_kardex:
    // se reconstruyen recorriendo TODO el historial del producto en orden, con la misma regla
    // que `actualizarCostoPromedio` (el promedio es por producto, no por almacén, y solo lo
    // mueven las entradas con costo > 0). Recién después se aplican filtros y paginación,
    // para que el saldo de la primera fila de un rango ya venga con todo lo anterior.
    const todos = await this.prisma.tbl_kardex.findMany({
      where: { id_producto: idProducto },
      include: {
        producto: { select: { nombre: true, codigo: true } },
        movimiento: { select: { id_usuario: true } },
      },
      orderBy: [{ fecha: 'asc' }, { fecha_creacion: 'asc' }],
    });

    let stockGlobal = 0;
    let costoPromedio = 0;
    const conSaldos = todos.map((k) => {
      const entrada = Number(k.cantidad_entrada);
      const salida = Number(k.cantidad_salida);
      const costoUnitario = Number(k.costo_unitario);
      const costoPromedioAnterior = costoPromedio;
      if (entrada > 0 && costoUnitario > 0) {
        costoPromedio = stockGlobal <= 0
          ? costoUnitario
          : (stockGlobal * costoPromedio + entrada * costoUnitario) / (stockGlobal + entrada);
      }
      stockGlobal += entrada - salida;
      const stock = Number(k.stock_resultante);
      const stockAnterior = stock - entrada + salida;
      return {
        ...k,
        costo_promedio: redondear4(costoPromedio),
        valor_saldo: redondear2(stock * costoPromedio),
        stock_anterior: stockAnterior,
        valor_saldo_anterior: redondear2(stockAnterior * costoPromedioAnterior),
      };
    });

    const hastaFin = fechaHasta ? finDeDia(fechaHasta) : undefined;
    const filtrados = conSaldos.filter((k) =>
      (!idAlmacen || k.id_almacen === idAlmacen)
      && (!fechaDesde || k.fecha >= fechaDesde)
      && (!hastaFin || k.fecha <= hastaFin));

    const pagina = filtrados.slice(skip, skip + Math.min(limit, 1000));
    const conDocumentos = await this.resolverDocumentosOrigen(pagina);
    return { data: await this.resolverUsuarios(conDocumentos), total: filtrados.length };
  }

  private async resolverUsuarios<K extends { movimiento?: { id_usuario: string | null } | null }>(data: K[]) {
    const ids = [...new Set(data.map((k) => k.movimiento?.id_usuario).filter((id): id is string => !!id))];
    const usuarios = ids.length
      ? await this.prisma.tbl_usuarios.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, apellido: true } })
      : [];
    const mapa = new Map(usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]));
    return data.map(({ movimiento, ...k }) => ({
      ...k,
      usuario: movimiento?.id_usuario ? mapa.get(movimiento.id_usuario) ?? null : null,
    }));
  }

  private async resolverDocumentosOrigen(data: any[]) {
    const idsVenta = data.filter((k) => k.tipo_referencia === 'venta' && k.id_referencia).map((k) => k.id_referencia as string);
    const idsCompra = data.filter((k) => k.tipo_referencia === 'compra' && k.id_referencia).map((k) => k.id_referencia as string);
    const idsAjuste = data.filter((k) => k.tipo_referencia === 'ajuste' && k.id_referencia).map((k) => k.id_referencia as string);

    const [ventas, detallesVenta, compras, ajustes] = await Promise.all([
      this.prisma.tbl_ventas.findMany({ where: { id: { in: idsVenta } }, select: { id: true, numero_comprobante: true, tipo_documento: true } }),
      this.prisma.tbl_detalle_ventas.findMany({ where: { id_venta: { in: idsVenta } }, select: { id_venta: true, id_producto: true, precio_unitario: true } }),
      this.prisma.tbl_compras.findMany({ where: { id: { in: idsCompra } }, select: { id: true, numero_interno: true, serie: true, numero: true, tipo_documento: true } }),
      this.prisma.tbl_ajustes_inventario.findMany({ where: { id: { in: idsAjuste } }, select: { id: true, numero_interno: true } }),
    ]);
    const mapaVentas = new Map(ventas.map((v) => [v.id, v]));
    // Precio al que se vendió (con IGV) el producto de esa fila del kardex.
    const precioVenta = new Map<string, string>();
    for (const d of detallesVenta) {
      const clave = `${d.id_venta}|${d.id_producto}`;
      if (!precioVenta.has(clave)) precioVenta.set(clave, d.precio_unitario.toString());
    }
    const mapaCompras = new Map(compras.map((c) => [c.id, c]));
    const mapaAjustes = new Map(ajustes.map((a) => [a.id, a]));

    return data.map((k) => {
      if (k.tipo_referencia === 'venta' && k.id_referencia) {
        const v = mapaVentas.get(k.id_referencia);
        return {
          ...k,
          numero_documento: v?.numero_comprobante ?? null,
          tipo_documento_origen: v?.tipo_documento ?? null,
          precio_venta: precioVenta.get(`${k.id_referencia}|${k.id_producto}`) ?? null,
        };
      }
      if (k.tipo_referencia === 'compra' && k.id_referencia) {
        const c = mapaCompras.get(k.id_referencia);
        const numeroFactura = c ? (c.serie ? `${c.serie}-${c.numero}` : c.numero) : null;
        return { ...k, numero_documento: numeroFactura || c?.numero_interno || null, tipo_documento_origen: c?.tipo_documento ?? null, precio_venta: null };
      }
      if (k.tipo_referencia === 'ajuste' && k.id_referencia) {
        const a = mapaAjustes.get(k.id_referencia);
        return { ...k, numero_documento: a?.numero_interno ?? null, tipo_documento_origen: null, precio_venta: null };
      }
      return { ...k, numero_documento: null, tipo_documento_origen: null, precio_venta: null };
    });
  }
}
