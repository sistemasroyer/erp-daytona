import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { ventasApi } from '@/api/ventas';
import { empresaApi } from '@/api/empresa';
import { ApiError } from '@/api/types';
import type { TipoDocumentoVenta } from '@/types/venta';
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
  const qrRef = useRef<HTMLCanvasElement>(null);

  const { data: ventaData, error: ventaError, isLoading: cargandoVenta } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.obtener(id!),
    enabled: !!id,
  });
  const { data: empresaData } = useQuery({ queryKey: ['empresa'], queryFn: empresaApi.obtener });

  const v = ventaData?.data;
  const e = empresaData?.data;
  const envio = v?.sunat_envios?.[0];
  const esOficial = v?.tipo_documento === 'FACTURA' || v?.tipo_documento === 'BOLETA' || v?.tipo_documento === 'NOTA_CREDITO';
  const aceptado = esOficial && envio?.estado === 'aceptado';

  useEffect(() => {
    if (aceptado && envio?.enlace && qrRef.current) {
      QRCode.toCanvas(qrRef.current, envio.enlace, { width: 120, margin: 1 }, () => {});
    }
  }, [aceptado, envio?.enlace]);

  if (!id) {
    return <p style={{ textAlign: 'center', color: '#dc3545' }}>No se especificó una venta</p>;
  }
  if (cargandoVenta) {
    return <p style={{ textAlign: 'center' }}>Cargando...</p>;
  }
  if (ventaError || !v) {
    return (
      <p style={{ textAlign: 'center', color: '#dc3545' }}>
        Error al cargar el comprobante: {ventaError instanceof ApiError ? ventaError.message : 'desconocido'}
      </p>
    );
  }

  const numero = v.numero_comprobante || `${v.serie}-${String(v.correlativo).padStart(8, '0')}`;
  const detalle = v.detalle || [];
  const pagos = v.pagos || [];

  return (
    <>
      <div className="no-print" style={{ padding: 12, textAlign: 'center' }}>
        <button onClick={() => window.print()} style={{ marginRight: 8 }}>Imprimir</button>
        <button onClick={() => window.close()}>Cerrar</button>
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
        <p>Fecha: {new Date(v.fecha_emision).toLocaleString('es-PE')}</p>
        <p>Cliente: {v.cliente?.razon_social || '-'}</p>
        <p>{v.cliente?.tipo_documento || ''}: {v.cliente?.numero_documento || '-'}</p>
        <div className="divider" />
        <table className="items">
          <thead>
            <tr><th>Cant</th><th>Descripción</th><th className="right">P.Unit</th><th className="right">Importe</th></tr>
          </thead>
          <tbody>
            {detalle.map((d) => (
              <tr key={d.id}>
                <td>{Number(d.cantidad).toFixed(2)}</td>
                <td>{d.producto?.nombre || d.descripcion || d.id_producto}</td>
                <td className="right">{Number(d.precio_unitario).toFixed(2)}</td>
                <td className="right">{Number(d.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divider" />
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td>Subtotal:</td><td className="right">{money(v.subtotal, v.moneda)}</td></tr>
            <tr><td>IGV (18%):</td><td className="right">{money(v.igv, v.moneda)}</td></tr>
            <tr><td className="bold">TOTAL:</td><td className="right bold">{money(v.total, v.moneda)}</td></tr>
          </tbody>
        </table>
        {pagos.length > 0 && (
          <>
            <div className="divider" />
            <p className="bold" style={{ marginBottom: 2 }}>Forma de pago:</p>
            {pagos.map((p) => (
              <p key={p.id} style={{ margin: 0 }}>{p.metodo_pago?.nombre || '-'}: {money(p.monto, v.moneda)}</p>
            ))}
          </>
        )}
        {esOficial && (
          aceptado ? (
            <>
              <div className="divider" />
              <p className="center bold" style={{ fontSize: 10 }}>Representación impresa del comprobante electrónico</p>
              {envio?.codigo_hash && <p className="center" style={{ fontSize: 9 }}>Hash: {envio.codigo_hash}</p>}
              <div className="qr-wrap"><canvas ref={qrRef} /></div>
            </>
          ) : (
            <>
              <div className="divider" />
              <p className="center" style={{ fontSize: 10 }}>⚠ Documento aún no enviado/aceptado por SUNAT</p>
            </>
          )
        )}
        <div className="divider" />
        <p className="center" style={{ fontSize: 9 }}>¡Gracias por su compra!</p>
      </div>
    </>
  );
}
