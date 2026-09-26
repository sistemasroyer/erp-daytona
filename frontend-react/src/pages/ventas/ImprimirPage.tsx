import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { ventasApi } from '@/api/ventas';
import { empresaApi } from '@/api/empresa';
import { ApiError } from '@/api/types';
import type { TipoDocumentoVenta } from '@/types/venta';
import { contenidoQrComprobante } from '@/utils/comprobante-impreso';
import './imprimir.css';

const TIPO_DOC_LABEL: Partial<Record<TipoDocumentoVenta, string>> = {
  FACTURA: 'FACTURA ELECTRÓNICA',
  BOLETA: 'BOLETA DE VENTA ELECTRÓNICA',
  NOTA_CREDITO: 'NOTA DE CRÉDITO ELECTRÓNICA',
  NOTA_DEBITO: 'NOTA DE DÉBITO ELECTRÓNICA',
  NOTA_VENTA: 'NOTA DE VENTA',
  COTIZACION: 'COTIZACIÓN',
};

function money(v: string | number | undefined, moneda: string | undefined) {
  const simb = moneda === 'USD' ? 'US$' : 'S/';
  return `${simb} ${Number(v || 0).toFixed(2)}`;
}

export function ImprimirPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const [qr, setQr] = useState<{ contenido: string; imagen: string } | null>(null);
  const [qrError, setQrError] = useState(false);

  const { data: ventaData, error: ventaError, isLoading: cargandoVenta } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.obtener(id!),
    enabled: !!id,
  });
  const { data: empresaData, isLoading: cargandoEmpresa, error: empresaError } = useQuery({ queryKey: ['empresa'], queryFn: empresaApi.obtener });

  const v = ventaData?.data;
  const e = empresaData?.data;
  const envio = v?.sunat_envios?.[0];
  const esOficial = !!v && ['FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO'].includes(v.tipo_documento);
  const contenidoQr = v && e ? contenidoQrComprobante(v, e.ruc, envio?.codigo_hash) : '';
  const qrListo = !!contenidoQr && qr?.contenido === contenidoQr;

  useEffect(() => {
    let cancelado = false;
    setQrError(false);
    if (contenidoQr) {
      QRCode.toDataURL(contenidoQr, { width: 360, margin: 4, errorCorrectionLevel: 'Q' })
        .then((imagen) => { if (!cancelado) setQr({ contenido: contenidoQr, imagen }); })
        .catch(() => { if (!cancelado) setQrError(true); });
    }
    return () => { cancelado = true; };
  }, [contenidoQr]);

  if (!id) {
    return <p style={{ textAlign: 'center', color: '#dc3545' }}>No se especificó una venta</p>;
  }
  if (cargandoVenta || cargandoEmpresa) {
    return <p style={{ textAlign: 'center' }}>Cargando...</p>;
  }
  if (ventaError || !v) {
    return (
      <p style={{ textAlign: 'center', color: '#dc3545' }}>
        Error al cargar el comprobante: {ventaError instanceof ApiError ? ventaError.message : 'desconocido'}
      </p>
    );
  }
  if (empresaError || !e) return <p>No se pudieron cargar los datos del emisor.</p>;

  const numero = v.numero_comprobante || `${v.serie}-${String(v.correlativo).padStart(8, '0')}`;
  const detalle = v.detalle || [];
  const pagos = v.pagos || [];
  const gravadas = detalle.filter((d) => d.afecta_igv === true).reduce((total, d) => total + Number(d.subtotal), 0);
  const inafectas = detalle.filter((d) => d.afecta_igv === false).reduce((total, d) => total + Number(d.subtotal), 0);
  const tieneAfectacion = detalle.length > 0 && detalle.every((d) => typeof d.afecta_igv === 'boolean');

  return (
    <>
      <div className="no-print" style={{ padding: 12, textAlign: 'center' }}>
        <button disabled={esOficial && !qrListo} onClick={() => window.print()} style={{ marginRight: 8 }}>Imprimir</button>
        <button onClick={() => window.close()}>Cerrar</button>
        {qrError && <p>No se pudo generar el QR. Recargue la página.</p>}
      </div>

      <div className="ticket">
        {e?.logo_base64 && <img className="logo" src={e.logo_base64} alt="logo" />}
        <h1>{e?.nombre_comercial || e?.razon_social || ''}</h1>
        <p className="center">{e?.razon_social || ''}</p>
        <p className="center">RUC: {e?.ruc || ''}</p>
        <p className="center">{e?.direccion || ''}</p>
        {e?.telefono && <p className="center">Tel: {e.telefono}</p>}
        <div className="divider" />
        <p className="center bold">{TIPO_DOC_LABEL[v.tipo_documento] || v.tipo_documento}</p>
        <p className="center bold">{numero}</p>
        <div className="divider" />
        <p>Fecha: {new Date(v.fecha_emision).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p>
        <p>Cliente: {v.cliente?.razon_social || '-'}</p>
        <p>{v.cliente?.tipo_documento || ''}: {v.cliente?.numero_documento || '-'}</p>
        {v.cliente?.direccion && <p>Dirección: {v.cliente.direccion}</p>}
        <div className="divider" />
        <table className="items">
          <thead>
            <tr><th>Cant</th><th>Descripción</th><th className="right">P.Unit</th><th className="right">Importe</th></tr>
          </thead>
          <tbody>
            {detalle.map((d) => (
              <tr key={d.id}>
                <td>{Number(d.cantidad).toLocaleString('es-PE', { maximumFractionDigits: 6 })} {d.producto?.unidad_medida?.simbolo}</td>
                <td>{d.descripcion || d.producto?.nombre || d.id_producto}</td>
                <td className="right">{Number(d.precio_unitario).toFixed(2)}</td>
                <td className="right">{Number(d.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divider" />
        <table style={{ width: '100%' }}>
          <tbody>
            {tieneAfectacion ? <>
              {gravadas > 0 && <tr><td>Op. gravadas:</td><td className="right">{money(gravadas, v.moneda)}</td></tr>}
              {inafectas > 0 && <tr><td>Op. inafectas:</td><td className="right">{money(inafectas, v.moneda)}</td></tr>}
            </> : <tr><td>Subtotal:</td><td className="right">{money(v.subtotal, v.moneda)}</td></tr>}
            <tr><td>IGV:</td><td className="right">{money(v.igv, v.moneda)}</td></tr>
            <tr><td className="bold">TOTAL:</td><td className="right bold">{money(v.total, v.moneda)}</td></tr>
          </tbody>
        </table>
        {pagos.length > 0 && (
          <>
            <div className="divider" />
            <p className="bold" style={{ marginBottom: 2 }}>Medios de pago:</p>
            {pagos.map((p) => (
              <p key={p.id} style={{ margin: 0 }}>{p.metodo_pago?.nombre || '-'}: {money(p.monto, v.moneda)}</p>
            ))}
          </>
        )}
        {esOficial && (
            <>
              <div className="divider" />
              <p className="center bold" style={{ fontSize: 10 }}>Representación impresa de {TIPO_DOC_LABEL[v.tipo_documento]?.toLocaleLowerCase('es-PE')}</p>
              {envio?.codigo_hash && <p className="center" style={{ fontSize: 9 }}>Hash: {envio.codigo_hash}</p>}
              {qrListo && <div className="qr-wrap"><img src={qr.imagen} alt="Código QR del comprobante" /></div>}
            </>
        )}
        <div className="divider" />
        <p className="center" style={{ fontSize: 9 }}>¡Gracias por su compra!</p>
      </div>
    </>
  );
}
