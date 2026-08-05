import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { AgregarCodigoProveedorDto } from './dto/agregar-codigo-proveedor.dto';
import { calcularIgv, redondear4 } from '../../common/utils/numero-documento.util';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductoDto, creadorId: string) {
    const existente = await this.prisma.tbl_productos.findFirst({
      where: { codigo: dto.codigo, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe un producto con ese código');

    if (dto.codigos_proveedor?.length) {
      const proveedores = dto.codigos_proveedor.map((c) => c.id_proveedor);
      if (new Set(proveedores).size !== proveedores.length) {
        throw new ConflictException('No se puede repetir el mismo proveedor en los códigos alternos');
      }
    }

    let precioCompraConIgv = dto.precio_compra_con_igv || 0;
    let precioCompraSinIgv = dto.precio_compra_sin_igv || 0;

    if (dto.afecta_igv !== false) {
      if (precioCompraSinIgv > 0 && precioCompraConIgv === 0) {
        precioCompraConIgv = redondear4(precioCompraSinIgv * 1.18);
      } else if (precioCompraConIgv > 0 && precioCompraSinIgv === 0) {
        precioCompraSinIgv = redondear4(precioCompraConIgv / 1.18);
      }
    }

    return this.prisma.tbl_productos.create({
      data: {
        codigo: dto.codigo,
        codigo_barras: dto.codigo_barras,
        codigo_sunat: dto.codigo_sunat,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        id_categoria: dto.id_categoria,
        id_subcategoria: dto.id_subcategoria,
        id_marca: dto.id_marca,
        id_unidad_medida: dto.id_unidad_medida,
        ubicacion: dto.ubicacion,
        tipo_existencia: dto.tipo_existencia || '01',
        afecta_igv: dto.afecta_igv !== false,
        stock_minimo: dto.stock_minimo || 0,
        stock_maximo: dto.stock_maximo || 0,
        precio_compra_sin_igv: precioCompraSinIgv,
        precio_compra_con_igv: precioCompraConIgv,
        precio_venta_1: dto.precio_venta_1 || 0,
        precio_venta_2: dto.precio_venta_2 || 0,
        precio_venta_3: dto.precio_venta_3 || 0,
        precio_venta_4: dto.precio_venta_4 || 0,
        precio_venta_5: dto.precio_venta_5 || 0,
        costo_promedio: precioCompraSinIgv,
        usuario_creacion: creadorId,
        codigos_proveedor: dto.codigos_proveedor?.length
          ? {
              create: dto.codigos_proveedor.map((c) => ({
                id_proveedor: c.id_proveedor,
                codigo_alterno: c.codigo_alterno,
              })),
            }
          : undefined,
      },
      include: {
        categoria: { select: { id: true, nombre: true } },
        subcategoria: { select: { id: true, nombre: true } },
        marca: { select: { id: true, nombre: true } },
        unidad_medida: { select: { id: true, descripcion: true, simbolo: true } },
        codigos_proveedor: {
          include: { proveedor: { select: { id: true, razon_social: true } } },
        },
      },
    });
  }

  async findAll(pagination: PaginationDto & { id_categoria?: string; con_stock?: boolean }) {
    const where: any = { eliminado: false };

    if (pagination.search) {
      where.OR = [
        { nombre: { contains: pagination.search, mode: 'insensitive' } },
        { codigo: { contains: pagination.search, mode: 'insensitive' } },
        { codigo_barras: { contains: pagination.search } },
        { codigos_proveedor: { some: { codigo_alterno: { contains: pagination.search, mode: 'insensitive' } } } },
      ];
    }

    if (pagination.id_categoria) where.id_categoria = pagination.id_categoria;
    if (pagination.con_stock) where.stock_actual = { gt: 0 };

    const [data, total] = await Promise.all([
      this.prisma.tbl_productos.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { nombre: 'asc' },
        include: {
          categoria: { select: { id: true, nombre: true } },
          subcategoria: { select: { id: true, nombre: true } },
          marca: { select: { id: true, nombre: true } },
          unidad_medida: { select: { id: true, descripcion: true, simbolo: true } },
          codigos_proveedor: {
            include: { proveedor: { select: { id: true, razon_social: true } } },
          },
        },
      }),
      this.prisma.tbl_productos.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const producto = await this.prisma.tbl_productos.findFirst({
      where: { id, eliminado: false },
      include: {
        categoria: { select: { id: true, nombre: true } },
        subcategoria: { select: { id: true, nombre: true } },
        marca: { select: { id: true, nombre: true } },
        unidad_medida: { select: { id: true, descripcion: true, simbolo: true } },
        inventarios: {
          include: { almacen: { select: { id: true, nombre: true } } },
        },
        codigos_proveedor: {
          include: { proveedor: { select: { id: true, razon_social: true } } },
        },
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  async findByCodigoBarras(codigoBarras: string) {
    const producto = await this.prisma.tbl_productos.findFirst({
      where: { codigo_barras: codigoBarras, eliminado: false, estado: true },
      include: {
        unidad_medida: { select: { simbolo: true } },
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado con ese código de barras');
    return producto;
  }

  async update(id: string, dto: Partial<CreateProductoDto>, modificadorId: string) {
    const producto = await this.findOne(id);

    if (dto.codigos_proveedor?.length) {
      const proveedores = dto.codigos_proveedor.map((c) => c.id_proveedor);
      if (new Set(proveedores).size !== proveedores.length) {
        throw new ConflictException('No se puede repetir el mismo proveedor en los códigos alternos');
      }
    }

    const data: any = { usuario_modificacion: modificadorId };

    const campos = [
      'codigo_barras', 'codigo_sunat', 'nombre', 'descripcion',
      'id_categoria', 'id_subcategoria', 'id_marca', 'id_unidad_medida',
      'ubicacion', 'tipo_existencia', 'afecta_igv', 'estado',
      'stock_minimo', 'stock_maximo',
      'precio_venta_1', 'precio_venta_2', 'precio_venta_3', 'precio_venta_4', 'precio_venta_5',
    ];

    for (const campo of campos) {
      if (dto[campo] !== undefined) data[campo] = dto[campo];
    }

    if (dto.codigos_proveedor !== undefined) {
      data.codigos_proveedor = {
        deleteMany: {},
        create: dto.codigos_proveedor.map((c) => ({
          id_proveedor: c.id_proveedor,
          codigo_alterno: c.codigo_alterno,
        })),
      };
    }

    if (dto.precio_compra_sin_igv !== undefined || dto.precio_compra_con_igv !== undefined) {
      const afectaIgv = dto.afecta_igv !== undefined ? dto.afecta_igv : producto.afecta_igv;
      let sinIgv = dto.precio_compra_sin_igv ?? Number(producto.precio_compra_sin_igv);
      let conIgv = dto.precio_compra_con_igv ?? Number(producto.precio_compra_con_igv);

      if (afectaIgv) {
        if (dto.precio_compra_sin_igv !== undefined) conIgv = redondear4(sinIgv * 1.18);
        else sinIgv = redondear4(conIgv / 1.18);
      }

      data.precio_compra_sin_igv = sinIgv;
      data.precio_compra_con_igv = conIgv;

      await this.prisma.tbl_productos.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
    }

    return this.prisma.tbl_productos.update({
      where: { id },
      data,
      include: {
        categoria: { select: { id: true, nombre: true } },
        unidad_medida: { select: { id: true, descripcion: true, simbolo: true } },
        codigos_proveedor: {
          include: { proveedor: { select: { id: true, razon_social: true } } },
        },
      },
    });
  }

  async agregarCodigoProveedor(idProducto: string, dto: AgregarCodigoProveedorDto) {
    await this.findOne(idProducto);

    const proveedor = await this.prisma.tbl_proveedores.findFirst({
      where: { id: dto.id_proveedor, eliminado: false },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    return this.prisma.tbl_producto_codigos_proveedor.upsert({
      where: { id_producto_id_proveedor: { id_producto: idProducto, id_proveedor: dto.id_proveedor } },
      update: { codigo_alterno: dto.codigo_alterno },
      create: { id_producto: idProducto, id_proveedor: dto.id_proveedor, codigo_alterno: dto.codigo_alterno },
      include: { proveedor: { select: { id: true, razon_social: true } } },
    });
  }

  async getPreciosByTipo(id: string, tipo: number): Promise<number> {
    const producto = await this.prisma.tbl_productos.findFirst({
      where: { id, eliminado: false },
      select: {
        precio_venta_1: true, precio_venta_2: true, precio_venta_3: true,
        precio_venta_4: true, precio_venta_5: true,
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const precios: Record<number, any> = {
      1: producto.precio_venta_1,
      2: producto.precio_venta_2,
      3: producto.precio_venta_3,
      4: producto.precio_venta_4,
      5: producto.precio_venta_5,
    };

    return Number(precios[tipo] || producto.precio_venta_1);
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_productos.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }

  async getStockAlerta() {
    return this.prisma.tbl_productos.findMany({
      where: {
        eliminado: false,
        estado: true,
        stock_minimo: { gt: 0 },
        stock_actual: { lte: this.prisma.tbl_productos.fields.stock_minimo as any },
      },
      select: {
        id: true, codigo: true, nombre: true,
        stock_actual: true, stock_minimo: true,
        unidad_medida: { select: { simbolo: true } },
      },
      orderBy: { stock_actual: 'asc' },
      take: 50,
    });
  }
}
