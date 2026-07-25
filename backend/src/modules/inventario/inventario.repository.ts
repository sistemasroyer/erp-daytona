import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StockInsuficienteException } from '../../common/exceptions/stock-insuficiente.exception';
import { ConcurrenciaException } from '../../common/exceptions/concurrencia.exception';
import { Prisma } from '@prisma/client';

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
    const esSalida = ['salida', 'transferencia_salida'].includes(input.tipo);

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

    await tx.tbl_productos.update({
      where: { id: idProducto },
      data: {
        costo_promedio: parseFloat(nuevoPromedio.toFixed(4)),
        precio_compra_sin_igv: parseFloat(nuevoPromedio.toFixed(4)),
        precio_compra_con_igv: parseFloat((nuevoPromedio * 1.18).toFixed(4)),
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
    metodo: 'peps' | 'ueps' | 'promedio' = 'promedio',
  ) {
    const where: any = { id_producto: idProducto };
    if (idAlmacen) where.id_almacen = idAlmacen;
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = fechaDesde;
      if (fechaHasta) where.fecha.lte = fechaHasta;
    }

    return this.prisma.tbl_kardex.findMany({
      where,
      include: {
        producto: { select: { nombre: true, codigo: true } },
      },
      orderBy: { fecha: 'asc' },
    });
  }
}
