import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { NubefactService, NubefactRespuesta } from './nubefact.service';
import { redondear2 } from '../../common/utils/numero-documento.util';

@Injectable()
export class SunatEnvioService {
  private readonly logger = new Logger(SunatEnvioService.name);

  constructor(
    private prisma: PrismaService,
    private nubefact: NubefactService,
    private configService: ConfigService,
  ) {}

  async procesarEnvio(idVenta: string): Promise<void> {
    const venta = await this.prisma.tbl_ventas.findFirst({
      where: { id: idVenta },
      include: {
        cliente: true,
        detalle: {
          include: {
            producto: {
              include: { unidad_medida: true },
            },
          },
        },
      },
    });

    if (!venta) {
      this.logger.error(`Venta ${idVenta} no encontrada`);
      return;
    }

    const empresa = await this.prisma.tbl_empresas.findFirst({
      where: { eliminado: false },
    });

    if (!empresa) {
      this.logger.error('No hay empresa configurada');
      return;
    }

    const codigoTipo = this.getCodigoTipo(venta.tipo_documento as string);
    const identificador = `${empresa.ruc}-${codigoTipo}-${venta.serie}-${String(venta.correlativo).padStart(8, '0')}`;

    const envio = await this.prisma.tbl_sunat_envios.create({
      data: {
        id_venta: idVenta,
        tipo_documento: codigoTipo,
        identificador,
        estado: 'pendiente',
        intento_numero: 1,
        usuario_creacion: 'sistema',
      },
    });

    try {
      const totalGravada = venta.detalle
        .filter((d) => d.afecta_igv)
        .reduce((acc, d) => acc + Number(d.subtotal), 0);
      const totalInafecta = venta.detalle
        .filter((d) => !d.afecta_igv)
        .reduce((acc, d) => acc + Number(d.subtotal), 0);

      const modoSunat = this.configService.get<string>('sunat.mode');

      let documentoModificado: { tipo: 'FACTURA' | 'BOLETA'; serie: string; numero: number } | undefined;
      let tipoNotaCredito: number | undefined;

      if (venta.tipo_documento === 'NOTA_CREDITO' && venta.id_nota_original) {
        const original = await this.prisma.tbl_ventas.findFirst({ where: { id: venta.id_nota_original } });
        if (original && (original.tipo_documento === 'FACTURA' || original.tipo_documento === 'BOLETA')) {
          documentoModificado = { tipo: original.tipo_documento, serie: original.serie, numero: original.correlativo };
        }
        if (venta.codigo_motivo_nota) tipoNotaCredito = parseInt(venta.codigo_motivo_nota, 10);
      }

      let respuesta: NubefactRespuesta;

      if (modoSunat === 'mock') {
        respuesta = this.simularRespuestaNubefact(venta.tipo_documento as string, venta.serie, venta.correlativo);
      } else {
        respuesta = await this.nubefact.generarComprobante({
          tipoDocumento: venta.tipo_documento as any,
          serie: venta.serie,
          numero: venta.correlativo,
          fechaEmision: venta.fecha_emision,
          moneda: venta.moneda as any,
          tipoCambio: Number(venta.tipo_cambio),
          cliente: {
            tipoDocumento: venta.cliente.tipo_documento as any,
            numeroDocumento: venta.cliente.numero_documento,
            razonSocial: venta.cliente.razon_social,
            direccion: venta.cliente.direccion || undefined,
            email: venta.cliente.email || undefined,
          },
          totales: {
            gravada: redondear2(totalGravada),
            inafecta: redondear2(totalInafecta),
            igv: Number(venta.igv),
            total: Number(venta.total),
          },
          observaciones: venta.observaciones || undefined,
          documentoModificado,
          tipoNotaCredito,
          items: venta.detalle.map((d) => ({
            unidadMedida: d.producto.unidad_medida.codigo_sunat,
            codigo: d.producto.codigo,
            descripcion: d.descripcion || d.producto.nombre,
            cantidad: Number(d.cantidad),
            valorUnitario: Number(d.valor_unitario),
            precioUnitario: Number(d.precio_unitario),
            descuento: Number(d.descuento) || undefined,
            subtotal: Number(d.subtotal),
            gravado: d.afecta_igv,
            igv: Number(d.igv),
            total: Number(d.total),
          })),
        });
      }

      await this.prisma.tbl_sunat_respuestas.create({
        data: {
          id_envio: envio.id,
          codigo_respuesta: respuesta.sunatResponseCode,
          descripcion_respuesta: respuesta.sunatDescripcion || respuesta.errorMensaje,
          observaciones: respuesta.sunatNota,
          es_exitoso: respuesta.aceptado,
          respuesta_raw: respuesta.raw ?? undefined,
          fecha_respuesta: new Date(),
        },
      });

      const nuevoEstado = respuesta.aceptado ? 'aceptado' : 'rechazado';

      await this.prisma.tbl_sunat_envios.update({
        where: { id: envio.id },
        data: {
          estado: nuevoEstado as any,
          fecha_envio: new Date(),
          enlace: respuesta.enlace,
          enlace_pdf: respuesta.enlacePdf,
          enlace_xml: respuesta.enlaceXml,
          enlace_cdr: respuesta.enlaceCdr,
          codigo_hash: respuesta.codigoHash,
          error_mensaje: respuesta.aceptado ? null : respuesta.errorMensaje?.substring(0, 490),
        },
      });

      await this.prisma.tbl_ventas.update({
        where: { id: idVenta },
        data: { estado_sunat: nuevoEstado as any },
      });

      this.logger.log(`Venta ${idVenta} → SUNAT (NubeFact): ${nuevoEstado}`);
    } catch (error) {
      this.logger.error(`Error procesando venta ${idVenta}: ${error.message}`);

      await this.prisma.tbl_sunat_envios.update({
        where: { id: envio.id },
        data: {
          estado: 'error',
          error_mensaje: error.message?.substring(0, 490),
        },
      });

      await this.prisma.tbl_ventas.update({
        where: { id: idVenta },
        data: { estado_sunat: 'error' },
      });

      throw error;
    }
  }

  private simularRespuestaNubefact(tipoDocumento: string, serie: string, correlativo: number): NubefactRespuesta {
    const nombre = `${serie}-${String(correlativo).padStart(8, '0')}`;
    return {
      aceptado: true,
      serie,
      numero: correlativo,
      enlace: `https://mock.nubefact.local/cpe/${nombre}`,
      enlacePdf: `https://mock.nubefact.local/cpe/${nombre}.pdf`,
      enlaceXml: `https://mock.nubefact.local/cpe/${nombre}.xml`,
      enlaceCdr: `https://mock.nubefact.local/cpe/${nombre}.cdr`,
      codigoHash: 'MOCK-HASH',
      sunatDescripcion: `[MODO MOCK] Comprobante ${nombre} aceptado`,
      sunatResponseCode: '0',
      raw: null,
    };
  }

  private getCodigoTipo(tipo: string): string {
    const codigos: Record<string, string> = {
      FACTURA: '01', BOLETA: '03', NOTA_CREDITO: '07', NOTA_DEBITO: '08',
    };
    return codigos[tipo] || '01';
  }
}
