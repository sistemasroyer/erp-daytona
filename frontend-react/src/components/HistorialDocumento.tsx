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
  // Letras
  enviar: 'Envió a aprobación',
  devolver: 'Devolvió a borrador',
  reabrir: 'Reabrió el paquete',
  cancelar: 'Canceló',
  'importar-compras': 'Agregó documentos desde Compras',
  generar: 'Generó las letras',
};

function describir(e: EventoHistorial) {
  // Las rutas anidadas llegan como "paquetes/aprobar": cuenta el último tramo.
  const accion = e.accion?.split('/').pop() ?? null;
  if (accion === 'items') return e.operacion === 'DELETE' ? 'Quitó un producto del conteo' : 'Registró un conteo';
  if (accion === 'documentos') return e.operacion === 'DELETE' ? 'Quitó un documento' : e.operacion === 'UPDATE' ? 'Modificó un documento' : 'Agregó un documento';
  if (accion && ACCIONES[accion]) return ACCIONES[accion];
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
