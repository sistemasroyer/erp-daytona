import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface NubefactItemInput {
  unidadMedida: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  precioUnitario: number;
  descuento?: number;
  subtotal: number;
  gravado: boolean;
  igv: number;
  total: number;
}

export interface NubefactComprobanteInput {
  tipoDocumento: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  serie: string;
  numero: number;
  fechaEmision: Date;
  moneda: 'PEN' | 'USD';
  tipoCambio?: number;
  cliente: {
    tipoDocumento: 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';
    numeroDocumento: string;
    razonSocial: string;
    direccion?: string;
    email?: string;
  };
  totales: {
    gravada: number;
    inafecta: number;
    igv: number;
    total: number;
  };
  observaciones?: string;
  items: NubefactItemInput[];
  /** Solo para NOTA_CREDITO/NOTA_DEBITO: documento que se está modificando */
  documentoModificado?: {
    tipo: 'FACTURA' | 'BOLETA';
    serie: string;
    numero: number;
  };
  /** Solo para NOTA_CREDITO: catálogo 09 SUNAT (1..13) */
  tipoNotaCredito?: number;
}

export interface NubefactRespuesta {
  aceptado: boolean;
  serie?: string;
  numero?: number;
  enlace?: string;
  enlacePdf?: string;
  enlaceXml?: string;
  enlaceCdr?: string;
  codigoHash?: string;
  sunatDescripcion?: string;
  sunatNota?: string;
  sunatResponseCode?: string;
  sunatTicketNumero?: string;
  errorMensaje?: string;
  raw: any;
}

const TIPO_COMPROBANTE_CODIGO: Record<string, number> = {
  FACTURA: 1,
  BOLETA: 2,
  NOTA_CREDITO: 3,
  NOTA_DEBITO: 4,
};

const TIPO_DOC_CLIENTE_CODIGO: Record<string, number> = {
  DNI: 1,
  RUC: 6,
  CE: 4,
  PASAPORTE: 7,
};

@Injectable()
export class NubefactService {
  private readonly logger = new Logger(NubefactService.name);
  private readonly client: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.client = axios.create({
      baseURL: this.configService.get<string>('nubefact.ruta') || '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token token=${this.configService.get<string>('nubefact.token') || ''}`,
      },
    });
  }

  async generarComprobante(input: NubefactComprobanteInput): Promise<NubefactRespuesta> {
    const payload: Record<string, any> = {
      operacion: 'generar_comprobante',
      tipo_de_comprobante: TIPO_COMPROBANTE_CODIGO[input.tipoDocumento] ?? 1,
      serie: input.serie,
      numero: input.numero,
      sunat_transaction: 1,
      cliente_tipo_de_documento: TIPO_DOC_CLIENTE_CODIGO[input.cliente.tipoDocumento] ?? 1,
      cliente_numero_de_documento: input.cliente.numeroDocumento,
      cliente_denominacion: input.cliente.razonSocial,
      cliente_direccion: input.cliente.direccion || '-',
      cliente_email: input.cliente.email || '',
      fecha_de_emision: this.formatearFecha(input.fechaEmision),
      moneda: input.moneda === 'USD' ? 2 : 1,
      tipo_de_cambio: input.moneda === 'USD' ? input.tipoCambio : '',
      porcentaje_de_igv: 18.0,
      total_gravada: input.totales.gravada || '',
      total_inafecta: input.totales.inafecta || '',
      total_igv: input.totales.igv || '',
      total: input.totales.total,
      observaciones: input.observaciones || '',
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: !!input.cliente.email,
      cancelado: true,
      ...(input.documentoModificado
        ? {
            documento_que_se_modifica_tipo: input.documentoModificado.tipo === 'FACTURA' ? 1 : 2,
            documento_que_se_modifica_serie: input.documentoModificado.serie,
            documento_que_se_modifica_numero: input.documentoModificado.numero,
          }
        : {}),
      ...(input.tipoNotaCredito ? { tipo_de_nota_de_credito: input.tipoNotaCredito } : {}),
      items: input.items.map((item) => ({
        unidad_de_medida: item.unidadMedida,
        codigo: item.codigo || '',
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        valor_unitario: item.valorUnitario,
        precio_unitario: item.precioUnitario,
        descuento: item.descuento || '',
        subtotal: item.subtotal,
        tipo_de_igv: item.gravado ? 1 : 9,
        igv: item.igv,
        total: item.total,
        anticipo_regularizacion: false,
      })),
    };

    return this.enviar(payload);
  }

  async consultarComprobante(tipoDocumento: string, serie: string, numero: number): Promise<NubefactRespuesta> {
    return this.enviar({
      operacion: 'consultar_comprobante',
      tipo_de_comprobante: TIPO_COMPROBANTE_CODIGO[tipoDocumento] ?? 1,
      serie,
      numero,
    });
  }

  async generarAnulacion(
    tipoDocumento: string,
    serie: string,
    numero: number,
    motivo: string,
  ): Promise<NubefactRespuesta> {
    return this.enviar({
      operacion: 'generar_anulacion',
      tipo_de_comprobante: TIPO_COMPROBANTE_CODIGO[tipoDocumento] ?? 1,
      serie,
      numero,
      motivo,
    });
  }

  async consultarAnulacion(tipoDocumento: string, serie: string, numero: number): Promise<NubefactRespuesta> {
    return this.enviar({
      operacion: 'consultar_anulacion',
      tipo_de_comprobante: TIPO_COMPROBANTE_CODIGO[tipoDocumento] ?? 1,
      serie,
      numero,
    });
  }

  private async enviar(payload: Record<string, any>): Promise<NubefactRespuesta> {
    try {
      const { data } = await this.client.post('', payload);
      return this.mapearRespuesta(data);
    } catch (error: any) {
      return this.mapearError(error);
    }
  }

  private mapearRespuesta(data: any): NubefactRespuesta {
    if (data?.errors) {
      return {
        aceptado: false,
        errorMensaje: `[NubeFact ${data.codigo ?? '?'}] ${data.errors}`,
        raw: data,
      };
    }

    return {
      aceptado: !!data.aceptada_por_sunat,
      serie: data.serie,
      numero: data.numero,
      enlace: data.enlace,
      enlacePdf: data.enlace_del_pdf,
      enlaceXml: data.enlace_del_xml,
      enlaceCdr: data.enlace_del_cdr,
      codigoHash: data.codigo_hash,
      sunatDescripcion: data.sunat_description,
      sunatNota: data.sunat_note,
      sunatResponseCode: data.sunat_responsecode,
      sunatTicketNumero: data.sunat_ticket_numero,
      raw: data,
    };
  }

  private mapearError(error: any): NubefactRespuesta {
    const data = error?.response?.data;
    if (data?.errors) {
      return {
        aceptado: false,
        errorMensaje: `[NubeFact ${data.codigo ?? '?'}] ${data.errors}`,
        raw: data,
      };
    }

    const mensaje = error?.message || 'Error desconocido comunicando con NubeFact';
    this.logger.error(`Error comunicando con NubeFact: ${mensaje}`);
    return { aceptado: false, errorMensaje: mensaje, raw: data ?? null };
  }

  private formatearFecha(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}-${mes}-${anio}`;
  }
}
