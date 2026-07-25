import { Injectable, Logger } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SunatXmlService {
  private readonly logger = new Logger(SunatXmlService.name);

  constructor(private configService: ConfigService) {}

  generarXmlFactura(datos: DatosDocumentoSunat): string {
    const {
      tipoDocumento, serie, correlativo, fechaEmision,
      emisor, receptor, detalle, totales,
    } = datos;

    const codigoTipo = this.getCodigoTipo(tipoDocumento);
    const nombreDocumento = `${emisor.ruc}-${codigoTipo}-${serie}-${String(correlativo).padStart(8, '0')}`;

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele(tipoDocumento === 'FACTURA' || tipoDocumento === 'BOLETA' ? 'Invoice' : 'CreditNote', {
        'xmlns': tipoDocumento === 'FACTURA' || tipoDocumento === 'BOLETA'
          ? 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
          : 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      });

    // UBL Extensions (para firma digital)
    doc.ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
        .ele('ext:ExtensionContent').up()
      .up()
    .up();

    doc.ele('cbc:UBLVersionID').txt('2.1').up();
    doc.ele('cbc:CustomizationID').txt('2.0').up();
    doc.ele('cbc:ID').txt(`${serie}-${String(correlativo).padStart(8, '0')}`).up();
    doc.ele('cbc:IssueDate').txt(fechaEmision.toISOString().split('T')[0]).up();
    doc.ele('cbc:IssueTime').txt(fechaEmision.toTimeString().split(' ')[0]).up();
    doc.ele('cbc:InvoiceTypeCode', { listAgencyName: 'PE:SUNAT', listName: 'Tipo de Documento', listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01' }).txt(codigoTipo).up();
    doc.ele('cbc:Note', { languageLocaleID: '1000' }).txt(`${this.numeroALetras(totales.total)} SOLES`).up();
    doc.ele('cbc:DocumentCurrencyCode').txt(datos.moneda || 'PEN').up();
    doc.ele('cbc:LineCountNumeric').txt(String(detalle.length)).up();

    // Firma placeholder
    const signature = doc.ele('cac:Signature');
    signature.ele('cbc:ID').txt('IDFirma').up();
    signature.ele('cac:SignatoryParty')
      .ele('cac:PartyIdentification')
        .ele('cbc:ID').txt(emisor.ruc).up()
      .up()
      .ele('cac:PartyName')
        .ele('cbc:Name').txt(emisor.razonSocial).up()
      .up()
    .up();
    signature.ele('cac:DigitalSignatureAttachment')
      .ele('cac:ExternalReference')
        .ele('cbc:URI').txt('#IDFirma').up()
      .up()
    .up();

    // Emisor
    const accountingSupplier = doc.ele('cac:AccountingSupplierParty');
    accountingSupplier.ele('cbc:CustomerAssignedAccountID').txt(emisor.ruc).up();
    accountingSupplier.ele('cbc:AdditionalAccountID').txt('6').up();
    const partyEmisor = accountingSupplier.ele('cac:Party');
    partyEmisor.ele('cac:PartyName').ele('cbc:Name').txt(emisor.nombreComercial || emisor.razonSocial).up().up();
    partyEmisor.ele('cac:PostalAddress')
      .ele('cbc:ID').txt(emisor.ubigeo || '150101').up()
      .ele('cbc:StreetName').txt(emisor.direccion || '').up()
      .ele('cbc:CitySubdivisionName').txt(emisor.urbanizacion || '').up()
      .ele('cbc:CityName').txt(emisor.provincia || 'LIMA').up()
      .ele('cbc:CountrySubentity').txt(emisor.departamento || 'LIMA').up()
      .ele('cbc:District').txt(emisor.distrito || 'LIMA').up()
      .ele('cac:Country').ele('cbc:IdentificationCode').txt('PE').up().up()
    .up();
    partyEmisor.ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName').txt(emisor.razonSocial).up()
      .ele('cbc:CompanyID', { schemeID: '6', schemeName: 'SUNAT:Identificador De Documento De Identidad', schemeAgencyName: 'PE:SUNAT' }).txt(emisor.ruc).up()
      .ele('cac:TaxScheme').ele('cbc:ID').txt('6').up().ele('cbc:Name').txt('IGV').up().ele('cbc:TaxTypeCode').txt('VAT').up().up()
    .up();
    partyEmisor.ele('cac:PartyLegalEntity').ele('cbc:RegistrationName').txt(emisor.razonSocial).up().up();

    // Receptor
    const accountingCustomer = doc.ele('cac:AccountingCustomerParty');
    const tipoDocRecep = receptor.tipoDoc === 'RUC' ? '6' : (receptor.tipoDoc === 'DNI' ? '1' : '0');
    accountingCustomer.ele('cbc:CustomerAssignedAccountID').txt(receptor.numeroDoc).up();
    accountingCustomer.ele('cbc:AdditionalAccountID').txt(tipoDocRecep).up();
    const partyReceptor = accountingCustomer.ele('cac:Party');
    partyReceptor.ele('cac:PostalAddress').ele('cbc:ID').txt('0000').up().ele('cac:Country').ele('cbc:IdentificationCode').txt('PE').up().up().up();
    partyReceptor.ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName').txt(receptor.razonSocial).up()
      .ele('cbc:CompanyID', { schemeID: tipoDocRecep }).txt(receptor.numeroDoc).up()
      .ele('cac:TaxScheme').ele('cbc:ID').txt(tipoDocRecep).up().ele('cbc:Name').txt('').up().ele('cbc:TaxTypeCode').txt('').up().up()
    .up();
    partyReceptor.ele('cac:PartyLegalEntity').ele('cbc:RegistrationName').txt(receptor.razonSocial).up().up();

    // Totales por impuesto
    const taxTotal = doc.ele('cac:TaxTotal');
    taxTotal.ele('cbc:TaxAmount', { currencyID: datos.moneda || 'PEN' }).txt(totales.igv.toFixed(2)).up();
    const taxSubtotal = taxTotal.ele('cac:TaxSubtotal');
    taxSubtotal.ele('cbc:TaxableAmount', { currencyID: datos.moneda || 'PEN' }).txt(totales.subtotal.toFixed(2)).up();
    taxSubtotal.ele('cbc:TaxAmount', { currencyID: datos.moneda || 'PEN' }).txt(totales.igv.toFixed(2)).up();
    const taxCategory = taxSubtotal.ele('cac:TaxCategory');
    taxCategory.ele('cbc:ID', { schemeID: 'UN/ECE 5305', schemeName: 'Tax Category Identifier', schemeAgencyName: 'United Nations Economic Commission for Europe' }).txt('S').up();
    taxCategory.ele('cbc:Percent').txt('18.00').up();
    taxCategory.ele('cbc:TaxExemptionReasonCode', { listAgencyName: 'PE:SUNAT', listName: 'Afectacion del IGV', listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07' }).txt('10').up();
    taxCategory.ele('cac:TaxScheme')
      .ele('cbc:ID').txt('1000').up()
      .ele('cbc:Name').txt('IGV').up()
      .ele('cbc:TaxTypeCode').txt('VAT').up()
    .up();

    // LegalMonetaryTotal
    const legalTotal = doc.ele('cac:LegalMonetaryTotal');
    legalTotal.ele('cbc:LineExtensionAmount', { currencyID: datos.moneda || 'PEN' }).txt(totales.subtotal.toFixed(2)).up();
    legalTotal.ele('cbc:TaxInclusiveAmount', { currencyID: datos.moneda || 'PEN' }).txt(totales.total.toFixed(2)).up();
    legalTotal.ele('cbc:AllowanceTotalAmount', { currencyID: datos.moneda || 'PEN' }).txt('0.00').up();
    legalTotal.ele('cbc:ChargeTotalAmount', { currencyID: datos.moneda || 'PEN' }).txt('0.00').up();
    legalTotal.ele('cbc:PayableAmount', { currencyID: datos.moneda || 'PEN' }).txt(totales.total.toFixed(2)).up();

    // Líneas de detalle
    detalle.forEach((item, idx) => {
      const line = doc.ele('cac:InvoiceLine');
      line.ele('cbc:ID').txt(String(idx + 1)).up();
      line.ele('cbc:InvoicedQuantity', { unitCode: item.unidadMedida || 'NIU' }).txt(String(item.cantidad)).up();
      line.ele('cbc:LineExtensionAmount', { currencyID: datos.moneda || 'PEN' }).txt(item.subtotal.toFixed(2)).up();

      const pricingRef = line.ele('cac:PricingReference');
      pricingRef.ele('cac:AlternativeConditionPrice')
        .ele('cbc:PriceAmount', { currencyID: datos.moneda || 'PEN' }).txt(item.precioUnitario.toFixed(2)).up()
        .ele('cbc:PriceTypeCode').txt('01').up()
      .up();

      const lineTaxTotal = line.ele('cac:TaxTotal');
      lineTaxTotal.ele('cbc:TaxAmount', { currencyID: datos.moneda || 'PEN' }).txt(item.igv.toFixed(2)).up();
      const lineTaxSub = lineTaxTotal.ele('cac:TaxSubtotal');
      lineTaxSub.ele('cbc:TaxableAmount', { currencyID: datos.moneda || 'PEN' }).txt(item.subtotal.toFixed(2)).up();
      lineTaxSub.ele('cbc:TaxAmount', { currencyID: datos.moneda || 'PEN' }).txt(item.igv.toFixed(2)).up();
      const lineTaxCat = lineTaxSub.ele('cac:TaxCategory');
      lineTaxCat.ele('cbc:ID').txt('S').up();
      lineTaxCat.ele('cbc:Percent').txt('18.00').up();
      lineTaxCat.ele('cbc:TaxExemptionReasonCode').txt('10').up();
      lineTaxCat.ele('cac:TaxScheme').ele('cbc:ID').txt('1000').up().ele('cbc:Name').txt('IGV').up().ele('cbc:TaxTypeCode').txt('VAT').up().up();

      const lineItem = line.ele('cac:Item');
      lineItem.ele('cbc:Description').txt(item.descripcion).up();
      lineItem.ele('cac:SellersItemIdentification').ele('cbc:ID').txt(item.codigo || '').up().up();

      const linePrice = line.ele('cac:Price');
      linePrice.ele('cbc:PriceAmount', { currencyID: datos.moneda || 'PEN' }).txt(item.valorUnitario.toFixed(4)).up();
    });

    return doc.end({ prettyPrint: true });
  }

  async firmarXml(xmlString: string, rutaCertificado: string, passwordCertificado: string): Promise<string> {
    try {
      if (!fs.existsSync(rutaCertificado)) {
        this.logger.warn('Certificado no encontrado, usando firma simulada');
        return this.firmarXmlSimulado(xmlString);
      }

      const pfxBuffer = fs.readFileSync(rutaCertificado);
      const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passwordCertificado);

      let privateKey: forge.pki.rsa.PrivateKey | null = null;
      let certificate: forge.pki.Certificate | null = null;

      p12.safeContents.forEach((safeContent) => {
        safeContent.safeBags.forEach((bag) => {
          if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && bag.key) {
            privateKey = bag.key as forge.pki.rsa.PrivateKey;
          }
          if (bag.type === forge.pki.oids.certBag && bag.cert) {
            certificate = bag.cert;
          }
        });
      });

      if (!privateKey || !certificate) {
        throw new Error('No se pudo extraer clave o certificado del PFX');
      }

      const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
      const certPem = forge.pki.certificateToPem(certificate);

      return this.aplicarFirmaDigital(xmlString, privateKeyPem, certPem);
    } catch (error) {
      this.logger.error(`Error firmando XML: ${error.message}`);
      return this.firmarXmlSimulado(xmlString);
    }
  }

  private aplicarFirmaDigital(xml: string, privateKeyPem: string, certPem: string): string {
    const xmlCrypto = require('xml-crypto');

    const sig = new xmlCrypto.SignedXml({ privateKey: privateKeyPem });
    sig.addReference('//*[local-name(.)="Invoice"]', [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ], 'http://www.w3.org/2001/04/xmlenc#sha256');

    sig.signingKey = privateKeyPem;
    sig.keyInfoProvider = {
      getKeyInfo: () => `<X509Data><X509Certificate>${certPem.replace(/-----BEGIN CERTIFICATE-----\n|-----END CERTIFICATE-----\n/g, '')}</X509Certificate></X509Data>`,
    };

    sig.computeSignature(xml);
    return sig.getSignedXml();
  }

  private firmarXmlSimulado(xmlString: string): string {
    const hash = crypto.createHash('sha256').update(xmlString).digest('hex');
    const firmaSimulada = `<!-- FIRMA_SIMULADA:${hash} -->`;
    return xmlString.replace('</ext:ExtensionContent>', `${firmaSimulada}</ext:ExtensionContent>`);
  }

  generarNombreZip(ruc: string, tipoDoc: string, serie: string, correlativo: number): string {
    const correlativoStr = String(correlativo).padStart(8, '0');
    return `${ruc}-${tipoDoc}-${serie}-${correlativoStr}`;
  }

  async comprimirXml(xmlString: string, nombreArchivo: string): Promise<Buffer> {
    const archiver = require('archiver');
    const { Writable } = require('stream');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const output = new Writable({
        write(chunk, _, cb) {
          chunks.push(Buffer.from(chunk));
          cb();
        },
      });

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', reject);
      output.on('finish', () => resolve(Buffer.concat(chunks)));

      archive.pipe(output);
      archive.append(xmlString, { name: `${nombreArchivo}.xml` });
      archive.finalize();
    });
  }

  private getCodigoTipo(tipo: string): string {
    const codigos: Record<string, string> = {
      FACTURA: '01',
      BOLETA: '03',
      NOTA_CREDITO: '07',
      NOTA_DEBITO: '08',
    };
    return codigos[tipo] || '01';
  }

  private numeroALetras(numero: number): string {
    const entero = Math.floor(numero);
    const decimales = Math.round((numero - entero) * 100);
    return `SON ${entero} CON ${String(decimales).padStart(2, '0')}/100`;
  }
}

export interface DatosDocumentoSunat {
  tipoDocumento: string;
  serie: string;
  correlativo: number;
  fechaEmision: Date;
  moneda: string;
  emisor: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    direccion?: string;
    ubigeo?: string;
    urbanizacion?: string;
    provincia?: string;
    departamento?: string;
    distrito?: string;
  };
  receptor: {
    tipoDoc: string;
    numeroDoc: string;
    razonSocial: string;
  };
  detalle: Array<{
    codigo?: string;
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    valorUnitario: number;
    subtotal: number;
    igv: number;
    total: number;
  }>;
  totales: {
    subtotal: number;
    igv: number;
    total: number;
  };
}
