import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../database/prisma.service';

const TIPO_COMPROBANTE: Record<string, string> = {
  '01': 'factura',
  '03': 'boleta',
};

@Injectable()
export class CompraXmlService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true,
  });

  constructor(private prisma: PrismaService) {}

  async parsear(xml: string) {
    let doc: any;
    try {
      doc = this.parser.parse(xml);
    } catch {
      throw new BadRequestException('El archivo no es un XML válido');
    }

    const invoice = doc?.Invoice;
    if (!invoice) {
      throw new BadRequestException(
        'El XML no contiene un comprobante (Invoice) reconocible. Solo se admiten Facturas/Boletas en formato UBL 2.1.',
      );
    }

    const idCompleto = this.texto(invoice['cbc:ID']);
    const [serie, numeroStr] = idCompleto.includes('-') ? idCompleto.split('-') : [idCompleto, ''];
    const numero = numeroStr ? String(parseInt(numeroStr, 10)) : numeroStr;

    const tipoCodigo = this.texto(invoice['cbc:InvoiceTypeCode']);
    const tipoDocumento = TIPO_COMPROBANTE[tipoCodigo] || 'factura';

    const fechaEmision = this.texto(invoice['cbc:IssueDate']);
    const moneda = this.texto(invoice['cbc:DocumentCurrencyCode']) || 'PEN';

    const supplierParty = invoice['cac:AccountingSupplierParty']?.['cac:Party'];
    const ruc = this.extraerRuc(supplierParty);
    const razonSocial = this.texto(supplierParty?.['cac:PartyLegalEntity']?.['cbc:RegistrationName']);

    const legalTotal = invoice['cac:LegalMonetaryTotal'] || {};
    const subtotal = this.numero(legalTotal['cbc:LineExtensionAmount']);
    const total = this.numero(legalTotal['cbc:PayableAmount'] ?? legalTotal['cbc:TaxInclusiveAmount']);
    const taxTotal = this.arr(invoice['cac:TaxTotal'])[0];
    const igv = this.numero(taxTotal?.['cbc:TaxAmount']);

    const proveedor = ruc
      ? await this.prisma.tbl_proveedores.findFirst({ where: { ruc, eliminado: false } })
      : null;

    const detalle: any[] = [];
    for (const linea of this.arr(invoice['cac:InvoiceLine'])) {
      const cantidad = this.numero(linea['cbc:InvoicedQuantity']);
      const unidadCodigo = this.atributo(linea['cbc:InvoicedQuantity'], '@_unitCode');
      const subtotalLinea = this.numero(linea['cbc:LineExtensionAmount']);
      const item = linea['cac:Item'] || {};
      const descripcion = this.texto(item['cbc:Description']);
      const codigoProveedor = this.texto(item['cac:SellersItemIdentification']?.['cbc:ID']);
      const valorUnitario = this.numero(linea['cac:Price']?.['cbc:PriceAmount']);

      const igvLinea = this.numero(linea['cac:TaxTotal']?.['cbc:TaxAmount']);
      const taxSubtotal = this.arr(linea['cac:TaxTotal']?.['cac:TaxSubtotal'])[0];
      const codigoAfectacion = this.texto(taxSubtotal?.['cac:TaxCategory']?.['cbc:TaxExemptionReasonCode']);
      const afectaIgv = codigoAfectacion ? codigoAfectacion === '10' : igvLinea > 0;

      const producto = await this.buscarProducto(codigoProveedor, proveedor?.id);

      detalle.push({
        codigo_proveedor: codigoProveedor,
        descripcion,
        cantidad,
        unidad_codigo: unidadCodigo,
        valor_unitario: valorUnitario,
        importe_linea: redondear2(subtotalLinea + igvLinea),
        afecta_igv: afectaIgv,
        producto: producto
          ? {
              id: producto.id,
              codigo: producto.codigo,
              nombre: producto.nombre,
              afecta_igv: producto.afecta_igv,
              precio_compra_sin_igv: producto.precio_compra_sin_igv,
              unidad_medida: producto.unidad_medida ? { simbolo: producto.unidad_medida.simbolo } : null,
            }
          : null,
      });
    }

    return {
      tipo_documento: tipoDocumento,
      serie,
      numero,
      fecha_emision: fechaEmision,
      moneda,
      totales: { subtotal: redondear2(subtotal), igv: redondear2(igv), total: redondear2(total) },
      proveedor: proveedor
        ? { encontrado: true, id: proveedor.id, ruc: proveedor.ruc, razon_social: proveedor.razon_social }
        : { encontrado: false, ruc: ruc || null, razon_social: razonSocial || null },
      detalle,
    };
  }

  private async buscarProducto(codigoProveedor: string, idProveedor?: string) {
    if (!codigoProveedor) return null;

    if (idProveedor) {
      const codigoAlterno = await this.prisma.tbl_producto_codigos_proveedor.findFirst({
        where: { id_proveedor: idProveedor, codigo_alterno: codigoProveedor },
        include: { producto: { include: { unidad_medida: true } } },
      });
      if (codigoAlterno) return codigoAlterno.producto;
    }

    return this.prisma.tbl_productos.findFirst({
      where: { codigo: codigoProveedor, eliminado: false },
      include: { unidad_medida: true },
    });
  }

  private texto(v: any): string {
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return String(v['#text'] ?? '').trim();
    return String(v).trim();
  }

  private atributo(v: any, nombre: string): string {
    if (v && typeof v === 'object') return String(v[nombre] ?? '');
    return '';
  }

  private numero(v: any): number {
    const n = parseFloat(this.texto(v));
    return isNaN(n) ? 0 : n;
  }

  private arr(v: any): any[] {
    if (v === undefined || v === null) return [];
    return Array.isArray(v) ? v : [v];
  }

  private extraerRuc(party: any): string {
    if (!party) return '';
    const ids = this.arr(party['cac:PartyIdentification']);
    for (const pid of ids) {
      const id = pid?.['cbc:ID'];
      if (id && typeof id === 'object' && id['@_schemeID'] === '6') return this.texto(id);
    }
    return ids[0] ? this.texto(ids[0]['cbc:ID']) : '';
  }
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}
