import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from '../inventario/inventario.repository';
import { redondear4 } from '../../common/utils/numero-documento.util';

const TIPOS_EXISTENCIA = [
  { value: '01', label: '01 – Mercadería' },
  { value: '02', label: '02 – Productos terminados' },
  { value: '03', label: '03 – Materias primas' },
  { value: '05', label: '05 – Suministros diversos' },
  { value: '99', label: '99 – Otros' },
];

const CODIGO_EJEMPLO = 'EJEMPLO-001';
const MAX_FILAS = 3000;

interface FilaResultado {
  fila: number;
  codigo: string;
  ok: boolean;
  mensaje: string;
}

export interface ResultadoImportacion {
  total: number;
  creados: number;
  errores: number;
  detalle: FilaResultado[];
}

@Injectable()
export class ProductoImportacionService {
  constructor(
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
  ) {}

  async generarPlantilla(): Promise<Buffer> {
    const [categorias, marcas, unidades, almacenes, margenes] = await Promise.all([
      this.prisma.tbl_categorias.findMany({ where: { eliminado: false, estado: true }, select: { nombre: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.tbl_marcas.findMany({ where: { eliminado: false, estado: true }, select: { nombre: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.tbl_unidades_medida.findMany({ where: { eliminado: false, estado: true }, select: { simbolo: true, descripcion: true }, orderBy: { descripcion: 'asc' } }),
      this.prisma.tbl_almacenes.findMany({ where: { eliminado: false, estado: true }, select: { nombre: true, es_principal: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.tbl_config_margenes.findMany({ where: { activo: true }, orderBy: { numero: 'asc' } }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MARTSOFT';

    // ─── Hoja de instrucciones ────────────────────────────────────────────
    const hojaInstrucciones = workbook.addWorksheet('Instrucciones');
    hojaInstrucciones.columns = [{ width: 28 }, { width: 90 }];
    const filasInstrucciones: [string, string][] = [
      ['Columna', 'Descripción'],
      ['código *', 'Código interno único del producto. Obligatorio. No debe repetirse ni coincidir con uno ya existente.'],
      ['nombre *', 'Nombre / descripción del producto. Obligatorio.'],
      ['unidad_medida *', 'Símbolo o descripción exacta de una unidad de medida existente (ver hoja "Listas"). Obligatorio.'],
      ['categoria', 'Nombre de la categoría. Si no existe, se crea automáticamente. Opcional.'],
      ['marca', 'Nombre de la marca. Si no existe, se crea automáticamente. Opcional.'],
      ['codigo_barras', 'Código de barras EAN/UPC. Opcional.'],
      ['codigo_sunat', 'Código de producto SUNAT (catálogo de bienes y servicios). Opcional.'],
      ['tipo_existencia', 'Uno de los códigos de la hoja "Listas". Si se deja vacío, se usa "01 – Mercadería".'],
      ['afecta_igv', '"Sí" o "No". Si se deja vacío, se asume "Sí".'],
      ['ubicacion', 'Ubicación física en el almacén (ej: Estante A-3). Opcional.'],
      ['stock_minimo', 'Cantidad mínima antes de alertar. Opcional, por defecto 0.'],
      ['stock_maximo', 'Cantidad máxima referencial. Opcional, por defecto 0.'],
      ['costo_unitario', 'Costo de compra sin IGV. Se usa como costo promedio inicial. Opcional, por defecto 0.'],
      ['stock_inicial', 'Cantidad de stock con la que arranca el producto. Si es 0 o se deja vacío, el producto se crea sin stock.'],
      ['almacen', 'Nombre del almacén donde entra el stock_inicial. Si se deja vacío, se usa el almacén principal. Solo aplica si stock_inicial > 0.'],
      ...margenes.map((m, i): [string, string] => [`precio_venta_${i + 1}`, `Precio de venta "${m.nombre}" (margen configurado: ${Number(m.margen)}%). Opcional, por defecto 0.`]),
      ['descripcion', 'Notas adicionales / compatibilidad. Opcional.'],
    ];
    filasInstrucciones.forEach((fila, i) => {
      const row = hojaInstrucciones.addRow(fila);
      if (i === 0) {
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      }
      row.alignment = { wrapText: true, vertical: 'top' };
    });
    hojaInstrucciones.addRow([]);
    hojaInstrucciones.addRow(['Nota', 'Borre la fila de ejemplo (código "EJEMPLO-001") antes de importar, o simplemente sobrescríbala — se ignora automáticamente si queda.']);
    hojaInstrucciones.addRow(['Nota', 'Si una fila falla, no afecta a las demás: el resultado de la importación muestra fila por fila qué se creó y qué falló, y por qué.']);

    // ─── Hoja de listas de referencia (también fuente de los desplegables) ──
    const hojaListas = workbook.addWorksheet('Listas', { state: 'visible' });
    hojaListas.columns = [
      { header: 'Unidad de medida', key: 'unidad', width: 30 },
      { header: 'Categoría', key: 'categoria', width: 30 },
      { header: 'Marca', key: 'marca', width: 30 },
      { header: 'Tipo de existencia', key: 'tipo', width: 30 },
      { header: 'Afecta IGV', key: 'igv', width: 15 },
      { header: 'Almacén', key: 'almacen', width: 30 },
    ];
    hojaListas.getRow(1).font = { bold: true };
    const maxFilasListas = Math.max(unidades.length, categorias.length, marcas.length, TIPOS_EXISTENCIA.length, 2, almacenes.length, 1);
    for (let i = 0; i < maxFilasListas; i++) {
      hojaListas.addRow({
        unidad: unidades[i] ? `${unidades[i].simbolo} — ${unidades[i].descripcion}` : undefined,
        categoria: categorias[i]?.nombre,
        marca: marcas[i]?.nombre,
        tipo: TIPOS_EXISTENCIA[i]?.label,
        igv: i === 0 ? 'Sí' : i === 1 ? 'No' : undefined,
        almacen: almacenes[i]?.nombre,
      });
    }

    // ─── Hoja de datos ────────────────────────────────────────────────────
    const sheet = workbook.addWorksheet('Productos');
    const columnasPrecios = margenes.length ? margenes : [
      { numero: 1, nombre: 'Precio Venta 1' }, { numero: 2, nombre: 'Precio Venta 2' }, { numero: 3, nombre: 'Precio Venta 3' },
      { numero: 4, nombre: 'Precio Venta 4' }, { numero: 5, nombre: 'Precio Venta 5' },
    ];
    sheet.columns = [
      { header: 'codigo *', key: 'codigo', width: 16 },
      { header: 'nombre *', key: 'nombre', width: 40 },
      { header: 'unidad_medida *', key: 'unidad_medida', width: 18 },
      { header: 'categoria', key: 'categoria', width: 20 },
      { header: 'marca', key: 'marca', width: 20 },
      { header: 'codigo_barras', key: 'codigo_barras', width: 16 },
      { header: 'codigo_sunat', key: 'codigo_sunat', width: 14 },
      { header: 'tipo_existencia', key: 'tipo_existencia', width: 22 },
      { header: 'afecta_igv', key: 'afecta_igv', width: 12 },
      { header: 'ubicacion', key: 'ubicacion', width: 16 },
      { header: 'stock_minimo', key: 'stock_minimo', width: 12 },
      { header: 'stock_maximo', key: 'stock_maximo', width: 12 },
      { header: 'costo_unitario', key: 'costo_unitario', width: 14 },
      { header: 'stock_inicial', key: 'stock_inicial', width: 12 },
      { header: 'almacen', key: 'almacen', width: 20 },
      ...columnasPrecios.map((m) => ({ header: `precio_venta_${m.numero} (${m.nombre})`, key: `precio_venta_${m.numero}`, width: 22 })),
      { header: 'descripcion', key: 'descripcion', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };

    sheet.addRow({
      codigo: CODIGO_EJEMPLO,
      nombre: 'Filtro de aceite Toyota Corolla 2019 (fila de ejemplo, bórrela)',
      unidad_medida: unidades[0] ? unidades[0].simbolo : 'UND',
      categoria: categorias[0]?.nombre || '',
      marca: marcas[0]?.nombre || '',
      codigo_barras: '',
      codigo_sunat: '',
      tipo_existencia: TIPOS_EXISTENCIA[0].label,
      afecta_igv: 'Sí',
      ubicacion: 'Estante A-3',
      stock_minimo: 5,
      stock_maximo: 50,
      costo_unitario: 10,
      stock_inicial: 20,
      almacen: almacenes.find((a) => a.es_principal)?.nombre || almacenes[0]?.nombre || '',
      ...Object.fromEntries(columnasPrecios.map((m) => [`precio_venta_${m.numero}`, 0])),
      descripcion: '',
    });
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF999999' } };

    const ultimaFila = 500;
    const col = (key: string) => (sheet.getColumn(key).letter as string);
    const totalFilasListas = maxFilasListas + 1;
    // Los tipos de exceljs 4.4.0 no declaran `dataValidations` en Worksheet, aunque existe en runtime.
    const validaciones = (sheet as unknown as { dataValidations: { add: (range: string, rule: Record<string, unknown>) => void } }).dataValidations;

    validaciones.add(`${col('unidad_medida')}3:${col('unidad_medida')}${ultimaFila}`, {
      type: 'list', allowBlank: false,
      formulae: [`Listas!$A$2:$A$${totalFilasListas}`],
      showErrorMessage: true, errorTitle: 'Unidad inválida', error: 'Seleccione una unidad de la hoja "Listas" (columna Unidad de medida).',
    });
    validaciones.add(`${col('tipo_existencia')}3:${col('tipo_existencia')}${ultimaFila}`, {
      type: 'list', allowBlank: true,
      formulae: [`Listas!$D$2:$D$${totalFilasListas}`],
      showErrorMessage: true, errorTitle: 'Tipo inválido', error: 'Seleccione un tipo de la lista.',
    });
    validaciones.add(`${col('afecta_igv')}3:${col('afecta_igv')}${ultimaFila}`, {
      type: 'list', allowBlank: true,
      formulae: ['Listas!$E$2:$E$3'],
      showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Seleccione Sí o No.',
    });
    if (almacenes.length) {
      validaciones.add(`${col('almacen')}3:${col('almacen')}${ultimaFila}`, {
        type: 'list', allowBlank: true,
        formulae: [`Listas!$F$2:$F$${totalFilasListas}`],
        showErrorMessage: true, errorTitle: 'Almacén inválido', error: 'Seleccione un almacén de la lista (o déjelo vacío para usar el principal).',
      });
    }
    if (categorias.length) {
      validaciones.add(`${col('categoria')}3:${col('categoria')}${ultimaFila}`, {
        type: 'list', allowBlank: true,
        formulae: [`Listas!$B$2:$B$${totalFilasListas}`],
        showErrorMessage: false, // sugerencia: también se puede escribir un nombre nuevo, se crea automáticamente
      });
    }
    if (marcas.length) {
      validaciones.add(`${col('marca')}3:${col('marca')}${ultimaFila}`, {
        type: 'list', allowBlank: true,
        formulae: [`Listas!$C$2:$C$${totalFilasListas}`],
        showErrorMessage: false,
      });
    }

    return workbook.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
  }

  async importar(fileBase64: string, usuarioId: string): Promise<ResultadoImportacion> {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      throw new BadRequestException('El archivo no es un base64 válido');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo. Debe ser un .xlsx válido (use la plantilla descargada).');
    }

    const sheet = workbook.getWorksheet('Productos') || workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no tiene hojas con datos');

    const [categorias, marcas, unidades, almacenes, margenes, productosExistentes] = await Promise.all([
      this.prisma.tbl_categorias.findMany({ where: { eliminado: false }, select: { id: true, nombre: true } }),
      this.prisma.tbl_marcas.findMany({ where: { eliminado: false }, select: { id: true, nombre: true } }),
      this.prisma.tbl_unidades_medida.findMany({ where: { eliminado: false }, select: { id: true, simbolo: true, descripcion: true } }),
      this.prisma.tbl_almacenes.findMany({ where: { eliminado: false, estado: true }, select: { id: true, nombre: true, es_principal: true } }),
      this.prisma.tbl_config_margenes.findMany({ where: { activo: true }, orderBy: { numero: 'asc' } }),
      this.prisma.tbl_productos.findMany({ where: { eliminado: false }, select: { codigo: true } }),
    ]);

    const mapCategorias = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c.id]));
    const mapMarcas = new Map(marcas.map((m) => [m.nombre.toLowerCase(), m.id]));
    const mapUnidades = new Map<string, string>();
    unidades.forEach((u) => {
      mapUnidades.set(u.simbolo.toLowerCase(), u.id);
      mapUnidades.set(u.descripcion.toLowerCase(), u.id);
    });
    const mapAlmacenes = new Map(almacenes.map((a) => [a.nombre.toLowerCase(), a.id]));
    const almacenPrincipal = almacenes.find((a) => a.es_principal) || almacenes[0];
    const codigosExistentes = new Set(productosExistentes.map((p) => p.codigo.toLowerCase()));
    const codigosEnArchivo = new Set<string>();
    const numerosPrecios = margenes.length ? margenes.map((m) => m.numero) : [1, 2, 3, 4, 5];

    const texto = (row: ExcelJS.Row, col: number) => {
      const v = row.getCell(col).value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text).trim();
      if (typeof v === 'object' && 'result' in (v as object)) return String((v as { result: unknown }).result ?? '').trim();
      return String(v).trim();
    };
    const numero = (row: ExcelJS.Row, col: number) => {
      const s = texto(row, col).replace(',', '.');
      if (!s) return 0;
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const detalle: FilaResultado[] = [];
    let creados = 0;
    let procesadas = 0;

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const codigo = texto(row, 1);
      if (!codigo) continue;
      if (codigo.toUpperCase() === CODIGO_EJEMPLO) continue;

      procesadas++;
      if (procesadas > MAX_FILAS) {
        detalle.push({ fila: rowNum, codigo, ok: false, mensaje: `Se alcanzó el máximo de ${MAX_FILAS} filas por importación` });
        break;
      }

      try {
        const nombre = texto(row, 2);
        if (!nombre) throw new Error('Falta el nombre');

        if (codigosEnArchivo.has(codigo.toLowerCase())) throw new Error('Código repetido dentro del archivo');
        if (codigosExistentes.has(codigo.toLowerCase())) throw new Error('Ya existe un producto con ese código');

        const unidadTxt = texto(row, 3);
        const idUnidad = mapUnidades.get(unidadTxt.toLowerCase().split(' — ')[0].trim()) || mapUnidades.get(unidadTxt.toLowerCase());
        if (!idUnidad) throw new Error(`Unidad de medida "${unidadTxt}" no reconocida — use un valor exacto de la hoja "Listas"`);

        let idCategoria: string | undefined;
        const categoriaTxt = texto(row, 4);
        if (categoriaTxt) {
          idCategoria = mapCategorias.get(categoriaTxt.toLowerCase());
          if (!idCategoria) {
            const nueva = await this.prisma.tbl_categorias.create({ data: { nombre: categoriaTxt, usuario_creacion: usuarioId } });
            idCategoria = nueva.id;
            mapCategorias.set(categoriaTxt.toLowerCase(), idCategoria);
          }
        }

        let idMarca: string | undefined;
        const marcaTxt = texto(row, 5);
        if (marcaTxt) {
          idMarca = mapMarcas.get(marcaTxt.toLowerCase());
          if (!idMarca) {
            const nueva = await this.prisma.tbl_marcas.create({ data: { nombre: marcaTxt, usuario_creacion: usuarioId } });
            idMarca = nueva.id;
            mapMarcas.set(marcaTxt.toLowerCase(), idMarca);
          }
        }

        const tipoExistTxt = texto(row, 8);
        const tipoExistencia = tipoExistTxt.match(/^\d{2}/)?.[0] || '01';

        const afectaIgvTxt = texto(row, 9).toLowerCase();
        const afectaIgv = afectaIgvTxt === '' || afectaIgvTxt === 'si' || afectaIgvTxt === 'sí' || afectaIgvTxt === 'true';

        const codigoBarras = texto(row, 6);
        const codigoSunat = texto(row, 7);
        const ubicacion = texto(row, 10);
        const stockMinimo = numero(row, 11);
        const stockMaximo = numero(row, 12);
        const costoUnitario = numero(row, 13);
        const stockInicial = numero(row, 14);
        const almacenTxt = texto(row, 15);

        let idAlmacen: string | undefined;
        if (stockInicial > 0) {
          if (almacenTxt) {
            idAlmacen = mapAlmacenes.get(almacenTxt.toLowerCase());
            if (!idAlmacen) throw new Error(`Almacén "${almacenTxt}" no reconocido`);
          } else if (almacenPrincipal) {
            idAlmacen = almacenPrincipal.id;
          } else {
            throw new Error('Indique el almacén para el stock inicial (no hay almacén configurado)');
          }
        }

        const precios = numerosPrecios.map((_, i) => numero(row, 16 + i));
        const descripcion = texto(row, 16 + numerosPrecios.length);

        const precioCompraSinIgv = costoUnitario;
        const precioCompraConIgv = afectaIgv ? redondear4(costoUnitario * 1.18) : costoUnitario;

        await this.prisma.$transaction(
          async (tx) => {
            const producto = await tx.tbl_productos.create({
              data: {
                codigo,
                nombre,
                codigo_barras: codigoBarras || undefined,
                codigo_sunat: codigoSunat || undefined,
                descripcion: descripcion || undefined,
                id_categoria: idCategoria,
                id_marca: idMarca,
                id_unidad_medida: idUnidad,
                ubicacion: ubicacion || undefined,
                tipo_existencia: tipoExistencia,
                afecta_igv: afectaIgv,
                stock_minimo: stockMinimo,
                stock_maximo: stockMaximo,
                precio_compra_sin_igv: precioCompraSinIgv,
                precio_compra_con_igv: precioCompraConIgv,
                costo_promedio: precioCompraSinIgv,
                precio_venta_1: precios[0] || 0,
                precio_venta_2: precios[1] || 0,
                precio_venta_3: precios[2] || 0,
                precio_venta_4: precios[3] || 0,
                precio_venta_5: precios[4] || 0,
                usuario_creacion: usuarioId,
              },
            });

            if (stockInicial > 0 && idAlmacen) {
              await this.inventarioRepo.registrarMovimientoEnTransaccion(
                {
                  idProducto: producto.id,
                  idAlmacen,
                  tipo: 'entrada',
                  cantidad: stockInicial,
                  costoUnitario,
                  motivo: 'Carga inicial de inventario (importación de catálogo)',
                  idUsuario: usuarioId,
                },
                tx as unknown as Prisma.TransactionClient,
              );
            }
          },
          { maxWait: 10000, timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        codigosEnArchivo.add(codigo.toLowerCase());
        codigosExistentes.add(codigo.toLowerCase());
        creados++;
        detalle.push({ fila: rowNum, codigo, ok: true, mensaje: 'Creado correctamente' });
      } catch (e) {
        detalle.push({ fila: rowNum, codigo, ok: false, mensaje: e instanceof Error ? e.message : 'Error desconocido' });
      }
    }

    return {
      total: detalle.length,
      creados,
      errores: detalle.filter((d) => !d.ok).length,
      detalle,
    };
  }
}
