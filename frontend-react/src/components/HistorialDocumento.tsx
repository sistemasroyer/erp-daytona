import { Alert, Collapse, Typography } from 'antd';
import dayjs from 'dayjs';
import { nombreUsuario } from '@/utils/format';
import type { ConHistorial, EventoHistorial } from '@/types/historial';

const ACCIONES: Record<string, string> = {
  anular: 'Anuló el documento',
  canjear: 'Canjeó a comprobante',
  'nota-credito': 'Emitió una nota de crédito',
  'reenviar-sunat': 'Envió a SUNAT',
  pagar: 'Registró el pago',
  aprobar: 'Aprobó',
  finalizar: 'Finalizó',
};

function describir(e: EventoHistorial) {
  if (e.accion === 'items') return e.operacion === 'DELETE' ? 'Quitó un producto del conteo' : 'Registró un conteo';
  if (e.accion && ACCIONES[e.accion]) return ACCIONES[e.accion];
  if (e.operacion === 'INSERT') return 'Registró el documento';
  if (e.operacion === 'DELETE') return 'Eliminó';
  return 'Modificó';
}

/** Bloque para el detalle de un documento: aviso de anulación (quién anuló, quién autorizó,
 * cuándo y por qué) + historial de todas las operaciones con su usuario. */
export function HistorialDocumento({ anulacion, historial }: ConHistorial) {
  return (
    <>
      {anulacion && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          title={`Anulado por ${nombreUsuario(anulacion.anulado_por)}${anulacion.autorizado_por ? ` — autorizado por ${nombreUsuario(anulacion.autorizado_por)}` : ''}`}
          description={
            <>
              <div>{dayjs(anulacion.fecha).format('DD/MM/YYYY HH:mm')}</div>
              {anulacion.motivo && <div>Motivo: {anulacion.motivo}</div>}
            </>
          }
        />
      )}
      {!!historial?.length && (
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 12 }}
          items={[{
            key: 'historial',
            label: `Historial de cambios (${historial.length})`,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {historial.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <Typography.Text type="secondary" style={{ minWidth: 120 }}>{dayjs(e.fecha).format('DD/MM/YYYY HH:mm')}</Typography.Text>
                    <Typography.Text strong style={{ minWidth: 160 }}>{nombreUsuario(e.usuario)}</Typography.Text>
                    <Typography.Text>{describir(e)}</Typography.Text>
                  </div>
                ))}
              </div>
            ),
          }]}
        />
      )}
    </>
  );
}
