import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { SunatXmlService, DatosDocumentoSunat } from './sunat-xml.service';

@Injectable()
export class SunatEnvioService {
  private readonly logger = new Logger(SunatEnvioService.name);

  constructor(
    private prisma: PrismaService,
    private sunatXml: SunatXmlService,
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

    const envio = await this.prisma.tbl_sunat_envios.create({
      data: {
        id_venta: idVenta,
        tipo_documento: this.getCodigoTipo(venta.tipo_documento as string),
        nombre_xml: this.sunatXml.generarNombreZip(
          empresa.ruc,
          this.getCodigoTipo(venta.tipo_documento as string),
          venta.serie,
          venta.correlativo,
        ),
        estado: 'pendiente',
        intento_numero: 1,
        usuario_creacion: 'sistema',
      },
    });

    try {
      const datosDocumento: DatosDocumentoSunat = {
        tipoDocumento: venta.tipo_documento as string,
        serie: venta.serie,
        correlativo: venta.correlativo,
        fechaEmision: venta.fecha_emision,
        moneda: venta.moneda as string,
        emisor: {
          ruc: empresa.ruc,
          razonSocial: empresa.razon_social,
          nombreComercial: empresa.nombre_comercial || undefined,
          direccion: empresa.direccion || undefined,
          ubigeo: empresa.ubigeo || undefined,
          departamento: empresa.departamento || undefined,
          provincia: empresa.provincia || undefined,
          distrito: empresa.distrito || undefined,
        },
        receptor: {
          tipoDoc: venta.cliente.tipo_documento as string,
          numeroDoc: venta.cliente.numero_documento,
          razonSocial: venta.cliente.razon_social,
        },
        detalle: venta.detalle.map((d) => ({
          codigo: d.producto.codigo,
          descripcion: d.descripcion || d.producto.nombre,
          cantidad: Number(d.cantidad),
          unidadMedida: d.producto.unidad_medida.codigo_sunat,
          precioUnitario: Number(d.precio_unitario),
          valorUnitario: Number(d.valor_unitario),
          subtotal: Number(d.subtotal),
          igv: Number(d.igv),
          total: Number(d.total),
        })),
        totales: {
          subtotal: Number(venta.subtotal),
          igv: Number(venta.igv),
          total: Number(venta.total),
        },
      };

      // Generar XML UBL 2.1
      const xmlSinFirma = this.sunatXml.generarXmlFactura(datosDocumento);

      // Firmar XML
      const certPath = this.configService.get<string>('sunat.certPath') || '';
      const certPassword = this.configService.get<string>('sunat.certPassword') || '';
      const xmlFirmado = await this.sunatXml.firmarXml(xmlSinFirma, certPath, certPassword);

      // Hash del XML
      const hash = require('crypto').createHash('sha256').update(xmlFirmado).digest('hex');

      // Guardar XML localmente
      const xmlsPath = this.configService.get<string>('storage.xmlsPath') || './storage/xmls';
      if (!fs.existsSync(xmlsPath)) fs.mkdirSync(xmlsPath, { recursive: true });
      fs.writeFileSync(path.join(xmlsPath, `${envio.nombre_xml}.xml`), xmlFirmado, 'utf8');

      // Comprimir en ZIP
      const zipBuffer = await this.sunatXml.comprimirXml(xmlFirmado, envio.nombre_xml);
      const zipBase64 = zipBuffer.toString('base64');

      await this.prisma.tbl_sunat_envios.update({
        where: { id: envio.id },
        data: {
          xml_sin_firma: xmlSinFirma,
          xml_firmado: xmlFirmado,
          hash_xml: hash,
          zip_base64: zipBase64,
          estado: 'enviado',
          fecha_envio: new Date(),
        },
      });

      const modoSunat = this.configService.get<string>('sunat.mode');
      let respuesta: { codigo: string; descripcion: string; cdrXml?: string; exitoso: boolean };

      if (modoSunat === 'mock') {
        respuesta = await this.simularRespuestaSunat(empresa.ruc, envio.nombre_xml);
      } else {
        respuesta = await this.enviarASunat(empresa.ruc, envio.nombre_xml, zipBase64);
      }

      await this.prisma.tbl_sunat_respuestas.create({
        data: {
          id_envio: envio.id,
          codigo_respuesta: respuesta.codigo,
          descripcion_respuesta: respuesta.descripcion,
          cdr_xml: respuesta.cdrXml,
          es_exitoso: respuesta.exitoso,
          fecha_respuesta: new Date(),
        },
      });

      const nuevoEstado = respuesta.exitoso ? 'aceptado' : 'rechazado';
      await this.prisma.tbl_sunat_envios.update({
        where: { id: envio.id },
        data: { estado: nuevoEstado as any },
      });

      await this.prisma.tbl_ventas.update({
        where: { id: idVenta },
        data: { estado_sunat: nuevoEstado as any },
      });

      this.logger.log(`Venta ${idVenta} → SUNAT: ${nuevoEstado} (${respuesta.codigo})`);
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

  private async simularRespuestaSunat(ruc: string, nombreXml: string) {
    await new Promise((r) => setTimeout(r, 100));

    const cdrXml = `<?xml version="1.0" encoding="UTF-8"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>CDR-${nombreXml}</cbc:ID>
  <cbc:IssueDate>${new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ResponseCode>0</cbc:ResponseCode>
      <cbc:Description>La Factura numero ${nombreXml.split('-').slice(-2).join('-')}, ha sido aceptada</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ApplicationResponse>`;

    return {
      codigo: '0',
      descripcion: `La Factura ${nombreXml} ha sido aceptada [MODO MOCK]`,
      cdrXml,
      exitoso: true,
    };
  }

  private async enviarASunat(ruc: string, nombreZip: string, zipBase64: string) {
    const oseUrl = this.configService.get<string>('sunat.oseUrl') ?? '';
    const claveSolUser = this.configService.get<string>('sunat.claveSolUsuario') ?? '';
    const claveSolPass = this.configService.get<string>('sunat.claveSolPassword') ?? '';

    try {
      const response = await axios.post(
        oseUrl,
        {
          ruc,
          fileName: `${nombreZip}.zip`,
          contentFile: zipBase64,
        },
        {
          auth: { username: `${ruc}${claveSolUser}`, password: claveSolPass },
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      return {
        codigo: response.data.codigoRespuesta || '0',
        descripcion: response.data.descripcionRespuesta || 'Aceptado',
        cdrXml: response.data.cdrZip
          ? Buffer.from(response.data.cdrZip, 'base64').toString('utf8')
          : undefined,
        exitoso: response.data.codigoRespuesta === '0',
      };
    } catch (error) {
      throw new Error(`Error comunicando con SUNAT/OSE: ${error.message}`);
    }
  }

  private getCodigoTipo(tipo: string): string {
    const codigos: Record<string, string> = {
      FACTURA: '01', BOLETA: '03', NOTA_CREDITO: '07', NOTA_DEBITO: '08',
    };
    return codigos[tipo] || '01';
  }
}
