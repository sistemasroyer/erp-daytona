import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Modal, Select, Typography } from 'antd';
import { ventasApi } from '@/api/ventas';
import { seriesDocumentoApi } from '@/api/series-documento';
import { metodosPagoApi } from '@/api/metodos-pago';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import type { Venta } from '@/types/venta';

interface Props {
  open: boolean;
  venta: Venta | undefined;
  onClose: () => void;
  onCanjeado: () => void;
}

export function CanjeModal({ open, venta, onClose, onCanjeado }: Props) {
  const { message } = App.useApp();
  const [tipo, setTipo] = useState<'BOLETA' | 'FACTURA'>('BOLETA');
  const [idSerie, setIdSerie] = useState<string | undefined>(undefined);
  const [idMetodo, setIdMetodo] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  let idPuntoVenta: string | null = null;
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    idPuntoVenta = user?.idPuntoVenta || null;
  } catch { /* ignore */ }

  const { data: seriesData } = useQuery({ queryKey: ['series-documento', idPuntoVenta], queryFn: () => seriesDocumentoApi.listar(idPuntoVenta || undefined), enabled: open });
  const { data: metodosData } = useQuery({ queryKey: ['metodos-pago'], queryFn: () => metodosPagoApi.listar(), enabled: open });

  const seriesDisponibles = (seriesData?.data || []).filter((s) => s.activo && s.tipo_documento === tipo);

  useEffect(() => {
    if (!open) { setTipo('BOLETA'); setIdSerie(undefined); setIdMetodo(undefined); }
  }, [open]);

  useEffect(() => {
    setIdSerie(seriesDisponibles[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, seriesData]);

  const confirmar = async () => {
    if (!venta) return;
    if (!idSerie) { message.warning('No hay serie disponible para ese tipo de documento'); return; }
    if (!idMetodo) { message.warning('Seleccione un método de pago'); return; }
    setSaving(true);
    try {
      await ventasApi.canjear(venta.id, {
        tipo_documento: tipo,
        id_serie_documento: idSerie,
        pagos: [{ id_metodo_pago: idMetodo, monto: Number(venta.total) }],
      });
      message.success('Documento canjeado correctamente');
      onCanjeado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al canjear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Canjear a documento oficial"
      open={open}
      onCancel={onClose}
      onOk={confirmar}
      confirmLoading={saving}
      okText="Confirmar Canje"
      okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
      cancelText="Cancelar"
      destroyOnHidden
    >
      {venta && (
        <Typography.Paragraph type="secondary">
          Canjeando {venta.numero_comprobante || `${venta.serie}-${venta.correlativo}`} — Total: {formatMoneda(venta.total, venta.moneda)}
        </Typography.Paragraph>
      )}
      <Typography.Text strong>Tipo de documento</Typography.Text>
      <Select value={tipo} onChange={setTipo} style={{ width: '100%', margin: '4px 0 12px' }} options={[{ value: 'BOLETA', label: 'Boleta' }, { value: 'FACTURA', label: 'Factura' }]} />
      <Typography.Text strong>Serie</Typography.Text>
      <Select
        value={idSerie} onChange={setIdSerie} style={{ width: '100%', margin: '4px 0 12px' }}
        placeholder={seriesDisponibles.length ? 'Seleccione' : 'Sin series configuradas'}
        options={seriesDisponibles.map((s) => ({ value: s.id, label: s.serie }))}
      />
      <Typography.Text strong>Método de pago</Typography.Text>
      <Select
        value={idMetodo} onChange={setIdMetodo} style={{ width: '100%', marginTop: 4 }}
        placeholder="Seleccione"
        options={(metodosData?.data || []).map((m) => ({ value: m.id, label: m.nombre }))}
      />
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4 }}>El documento oficial requiere el pago completo del total.</Typography.Paragraph>
    </Modal>
  );
}
