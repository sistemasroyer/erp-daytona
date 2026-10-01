import { useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { empresaApi } from '@/api/empresa';
import { letrasPaquetesApi, letrasReportesApi } from '@/api/letras';
import { formatMoneda, nombreUsuario } from '@/utils/format';
import { ESTADO_PAQUETE_LABEL, TIPO_DOCUMENTO_LETRA_LABEL, type MonedaLetras } from '@/types/letras';
import { estadoLetraVisible } from './PaqueteLetrasDetallePage';
import './imprimir-letras.css';

const f = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '-');
const ESTADO_LETRA_TEXTO: Record<string, string> = { pendiente: 'Pendiente', pagada: 'Pagada', cancelada: 'Cancelada', vencida: 'Vencida' };

/** Hoja A4 con cabecera de la empresa y barra "Imprimir" que no sale en papel. */
function Hoja({ titulo, subtitulo, cargando, error, children }: { titulo: string; subtitulo?: ReactNode; cargando: boolean; error?: unknown; children?: ReactNode }) {
  const { data: empresa } = useQuery({ queryKey: ['empresa'], queryFn: empresaApi.obtener });
  const e = empresa?.data;
  // El @page va en un <style> agregado al final del <head> solo mientras la hoja está abierta: así gana al
  // @page de 80 mm del ticket de ventas (CSS global) sin afectar a ninguna otra impresión.
  useEffect(() => {
    const estilo = document.createElement('style');
    estilo.textContent = '@page { size: A4; margin: 12mm; }';
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, []);
  if (cargando) return <div className="barra-imprimir">Cargando…</div>;
  if (error) return <div className="barra-imprimir">No se pudo cargar: {error instanceof Error ? error.message : 'error'}</div>;
  return (
    <>
      <div className="barra-imprimir"><button onClick={() => window.print()}>Imprimir / Guardar PDF</button></div>
      <div className="hoja-letras">
        <div className="cabecera">
          <div>
            <h1>{titulo}</h1>
            {subtitulo}
          </div>
          <div style={{ textAlign: 'right' }}>
            {e?.logo_base64 && <img src={e.logo_base64} alt="" />}
            <div><b>{e?.razon_social}</b></div>
            {e && <div>RUC {e.ruc}</div>}
            {e?.direccion && <div>{e.direccion}</div>}
          </div>
        </div>
        {children}
        <div className="pie">Impreso el {dayjs().format('DD/MM/YYYY HH:mm')}</div>
      </div>
    </>
  );
}

/** Hoja del paquete: proveedor, documentos y cronograma de letras (reemplaza al PDF de letras-daytona). */
export function ImprimirPaquetePage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['letras-paquete', id], queryFn: () => letrasPaquetesApi.obtener(id!), enabled: !!id });
  const p = data?.data;
  const m = (p?.moneda ?? 'PEN') as MonedaLetras;
  const letras = p?.letras ?? [];
  const vigentes = letras.filter((l) => l.estado !== 'cancelada');
  return (
    <Hoja titulo={`Paquete de letras ${p?.codigo ?? ''}`} subtitulo={p && <div>Estado: {ESTADO_PAQUETE_LABEL[p.estado]}</div>} cargando={isLoading} error={error}>
      {p && (
        <>
          <div className="datos">
            <div><b>Proveedor:</b> {p.proveedor.razon_social}</div>
            <div><b>RUC:</b> {p.proveedor.ruc}</div>
            <div><b>Moneda:</b> {m === 'PEN' ? 'Soles' : 'Dólares'}</div>
            <div><b>Banco:</b> {p.banco ? `${p.banco.siglas ? `${p.banco.siglas} — ` : ''}${p.banco.nombre}` : '-'}</div>
            <div><b>Periodo de pago:</b> {f(p.fecha_inicio_pago)} al {f(p.fecha_fin_pago)}</div>
            <div><b>Días de crédito:</b> {p.dias_credito}</div>
            <div><b>Registrado por:</b> {nombreUsuario(p.usuario)}</div>
            <div><b>Aprobado por:</b> {p.aprobador ? `${nombreUsuario(p.aprobador)} (${f(p.fecha_aprobacion)})` : '-'}</div>
            {p.comentarios && <div style={{ gridColumn: '1 / 3' }}><b>Comentarios:</b> {p.comentarios}</div>}
          </div>

          <h2>Documentos</h2>
          <table>
            <thead><tr><th>Tipo</th><th>Documento</th><th>Emisión</th><th>Vencimiento</th><th className="der">Monto</th></tr></thead>
            <tbody>
              {(p.documentos ?? []).map((d) => (
                <tr key={d.id}>
                  <td>{TIPO_DOCUMENTO_LETRA_LABEL[d.tipo]}</td><td>{d.serie}-{d.numero}</td><td>{f(d.fecha_emision)}</td><td>{f(d.fecha_vencimiento)}</td>
                  <td className={`der ${Number(d.monto) < 0 ? 'rojo' : ''}`}>{formatMoneda(d.monto, m)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4} className="der">Total del paquete</td><td className="der">{formatMoneda(p.monto_total, m)}</td></tr></tfoot>
          </table>

          <h2>Cronograma de letras</h2>
          {letras.length ? (
            <table>
              <thead><tr><th className="centro">Cuota</th><th>Fecha banco</th><th>Fecha de pago</th><th>Código banco</th><th className="der">Monto</th><th>Estado</th><th>Pago</th></tr></thead>
              <tbody>
                {letras.map((l) => (
                  <tr key={l.id}>
                    <td className="centro">{l.numero_cuota}</td><td>{f(l.fecha_banco)}</td><td>{dayjs(l.fecha_pago).format('ddd DD/MM/YYYY')}</td>
                    <td>{l.codigo_banco ?? ''}</td><td className="der">{formatMoneda(l.monto, m)}</td>
                    <td className={estadoLetraVisible(l) === 'vencida' ? 'rojo' : ''}>{ESTADO_LETRA_TEXTO[estadoLetraVisible(l)]}</td>
                    <td>{l.estado === 'pagada' ? `${f(l.fecha_pago_efectivo)} ${l.metodo_pago ?? ''} ${l.numero_operacion ? `#${l.numero_operacion}` : ''}` : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4} className="der">Total de letras</td><td className="der">{formatMoneda(vigentes.reduce((s, l) => s + Number(l.monto), 0), m)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          ) : <p>El paquete todavía no tiene letras generadas.</p>}

          <div className="firmas"><div>Elaborado por</div><div>Aprobado por</div></div>
        </>
      )}
    </Hoja>
  );
}

/** Estado de cuenta de un proveedor: lo que se le debe, con detalle, a la fecha. */
export function ImprimirEstadoCuentaPage() {
  const { idProveedor } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['letras-estado-cuenta', idProveedor], queryFn: () => letrasReportesApi.estadoCuenta(idProveedor!), enabled: !!idProveedor });
  const ec = data?.data;
  return (
    <Hoja titulo="Estado de cuenta de proveedor" subtitulo={ec && <div>Al {f(ec.fecha)}</div>} cargando={isLoading} error={error}>
      {ec && (
        <>
          <div className="datos">
            <div><b>Proveedor:</b> {ec.proveedor.razon_social}</div>
            <div><b>RUC:</b> {ec.proveedor.ruc}</div>
            {ec.proveedor.direccion && <div><b>Dirección:</b> {ec.proveedor.direccion}</div>}
            <div><b>Días de crédito:</b> {ec.proveedor.dias_credito}{ec.proveedor.letras_pago_unico ? ' (pago único)' : ''}</div>
          </div>

          <h2>Resumen</h2>
          {ec.resumen.length ? (
            <table>
              <thead><tr><th>Moneda</th><th className="der">Compras sin paquete</th><th className="der">En trámite</th><th className="der">Letras por vencer</th><th className="der">Letras vencidas</th><th className="der">Deuda total</th></tr></thead>
              <tbody>
                {ec.resumen.map((r) => (
                  <tr key={r.moneda}>
                    <td>{r.moneda === 'PEN' ? 'Soles' : 'Dólares'}</td>
                    <td className="der">{formatMoneda(r.sin_paquete.monto, r.moneda)}</td><td className="der">{formatMoneda(r.en_tramite.monto, r.moneda)}</td>
                    <td className="der">{formatMoneda(r.por_vencer.monto, r.moneda)}</td><td className="der rojo">{formatMoneda(r.vencidas.monto, r.moneda)}</td>
                    <td className="der"><b>{formatMoneda(r.total, r.moneda)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No hay deuda pendiente con este proveedor.</p>}

          {ec.letras_pendientes.length > 0 && (
            <>
              <h2>Letras pendientes</h2>
              <table>
                <thead><tr><th>Fecha de pago</th><th>Fecha banco</th><th>Paquete</th><th className="centro">Cuota</th><th>Banco / código</th><th className="der">Monto</th><th>Estado</th></tr></thead>
                <tbody>
                  {ec.letras_pendientes.map((l) => (
                    <tr key={l.id}>
                      <td>{dayjs(l.fecha_pago).format('ddd DD/MM/YYYY')}</td><td>{f(l.fecha_banco)}</td><td>{l.paquete.codigo}</td><td className="centro">{l.numero_cuota}</td>
                      <td>{[l.paquete.banco?.siglas || l.paquete.banco?.nombre, l.codigo_banco].filter(Boolean).join(' / ')}</td>
                      <td className="der">{formatMoneda(l.monto, l.moneda)}</td>
                      <td className={estadoLetraVisible(l) === 'vencida' ? 'rojo' : ''}>{ESTADO_LETRA_TEXTO[estadoLetraVisible(l)]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {ec.paquetes_en_tramite.length > 0 && (
            <>
              <h2>Paquetes en trámite (sin letras)</h2>
              <table>
                <thead><tr><th>Paquete</th><th>Estado</th><th>Periodo de pago</th><th className="der">Monto</th></tr></thead>
                <tbody>
                  {ec.paquetes_en_tramite.map((p) => (
                    <tr key={p.id}><td>{p.codigo}</td><td>{ESTADO_PAQUETE_LABEL[p.estado]}</td><td>{f(p.fecha_inicio_pago)} al {f(p.fecha_fin_pago)}</td><td className="der">{formatMoneda(p.monto_total, p.moneda)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {ec.compras_sin_paquete.length > 0 && (
            <>
              <h2>Compras a crédito sin paquete</h2>
              <table>
                <thead><tr><th>Documento</th><th>N° interno</th><th>Emisión</th><th>Vencimiento</th><th className="der">Monto</th></tr></thead>
                <tbody>
                  {ec.compras_sin_paquete.map((c) => (
                    <tr key={c.id}>
                      <td>{TIPO_DOCUMENTO_LETRA_LABEL[c.tipo]} {c.serie}-{c.numero}</td><td>{c.numero_interno}</td><td>{f(c.fecha_emision)}</td>
                      <td className={c.fecha_vencimiento < ec.fecha ? 'rojo' : ''}>{f(c.fecha_vencimiento)}</td>
                      <td className={`der ${c.monto < 0 ? 'rojo' : ''}`}>{formatMoneda(c.monto, c.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {ec.ultimos_pagos.length > 0 && (
            <>
              <h2>Últimos pagos</h2>
              <table>
                <thead><tr><th>Fecha pagada</th><th>Paquete</th><th className="centro">Cuota</th><th>Método</th><th>N° operación</th><th className="der">Monto</th></tr></thead>
                <tbody>
                  {ec.ultimos_pagos.map((l) => (
                    <tr key={l.id}><td>{f(l.fecha_pago_efectivo)}</td><td>{l.paquete.codigo}</td><td className="centro">{l.numero_cuota}</td><td>{l.metodo_pago}</td><td>{l.numero_operacion}</td><td className="der">{formatMoneda(l.monto_pagado ?? l.monto, l.moneda)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </Hoja>
  );
}
