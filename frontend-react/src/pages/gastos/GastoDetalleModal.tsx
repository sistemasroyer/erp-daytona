import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Modal, Descriptions, Button, Alert, Space, Typography, Select, Input } from 'antd';
import { CloseCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { gastosApi } from '@/api/gastos';
import { metodosPagoApi } from '@/api/metodos-pago';
import { cajaApi } from '@/api/caja';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import { CATEGORIAS_GASTO_LABEL } from '@/types/gasto';
import type { Gasto } from '@/types/gasto';

interface Props {
  id: string | null;
  onClose: () => void;
  onCambiado: () => void;
}

export function GastoDetalleModal({ id, onClose, onCambiado }: Props) {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [modalPago, setModalPago] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['gasto', id],
    queryFn: () => gastosApi.obtener(id!),
    enabled: !!id,
  });
  const gasto = data?.data;

  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: ['gasto', id] });
    onCambiado();
  };

  const anular = async () => {
    if (!gasto) return;
    const ok = await confirmar(`¿Anular el gasto ${gasto.numero_interno}?`, 'Anular Gasto');
    if (!ok) return;
    const motivo = window.prompt('Motivo de anulación (requerido):');
    if (!motivo?.trim()) { message.warning('Ingrese un motivo de anulación'); return; }
    try {
      await gastosApi.anular(gasto.id, motivo.trim());
      message.success('Gasto anulado correctamente');
      recargar();
      onClose();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al anular el gasto');
    }
  };

  if (!gasto) {
    return <Modal title="Detalle de Gasto" open={!!id} onCancel={onClose} footer={null}>{isFetching ? 'Cargando...' : null}</Modal>;
  }

  const puedeAnular = gasto.estado === 'registrado' && !gasto.pagado;
  const puedePagar = gasto.estado === 'registrado' && !gasto.pagado;

  return (
    <>
      <Modal
        title="Detalle de Gasto"
        open={!!id}
        onCancel={onClose}
        width={700}
        footer={
          <Space wrap>
            {puedePagar && <Button type="primary" icon={<DollarOutlined />} onClick={() => setModalPago(true)}>Registrar pago</Button>}
            {puedeAnular && <Button danger icon={<CloseCircleOutlined />} onClick={anular}>Anular</Button>}
          </Space>
        }
      >
        <Descriptions column={2} size="small">
          <Descriptions.Item label="N° interno"><strong>{gasto.numero_interno}</strong></Descriptions.Item>
          <Descriptions.Item label="Categoría">{CATEGORIAS_GASTO_LABEL[gasto.categoria]}</Descriptions.Item>
          <Descriptions.Item label="Comprobante">{gasto.tipo_documento} {gasto.serie ? `${gasto.serie}-${gasto.numero}` : gasto.numero || '-'}</Descriptions.Item>
          <Descriptions.Item label="Fecha emisión">{new Date(gasto.fecha_emision).toLocaleDateString('es-PE')}</Descriptions.Item>
          <Descriptions.Item label="Emisor">{gasto.razon_social_emisor}</Descriptions.Item>
          <Descriptions.Item label="RUC emisor">{gasto.ruc_emisor || '-'}</Descriptions.Item>
          <Descriptions.Item label="Proveedor vinculado">{gasto.proveedor?.razon_social || '-'}</Descriptions.Item>
          <Descriptions.Item label="Condición de pago">{gasto.condicion_pago === 'credito' ? `Crédito${gasto.fecha_vencimiento ? ` (vence ${new Date(gasto.fecha_vencimiento).toLocaleDateString('es-PE')})` : ''}` : 'Contado'}</Descriptions.Item>
          <Descriptions.Item label="Subtotal">{formatMoneda(gasto.subtotal, gasto.moneda)}</Descriptions.Item>
          <Descriptions.Item label="IGV">{formatMoneda(gasto.igv, gasto.moneda)}</Descriptions.Item>
          <Descriptions.Item label="Total"><strong>{formatMoneda(gasto.total, gasto.moneda)}</strong></Descriptions.Item>
          <Descriptions.Item label="Estado"><EstadoTag estado={gasto.estado} /></Descriptions.Item>
          {gasto.observaciones && <Descriptions.Item label="Observaciones" span={2}>{gasto.observaciones}</Descriptions.Item>}
        </Descriptions>

        <Alert
          style={{ marginTop: 16 }}
          type={gasto.pagado ? 'success' : 'warning'}
          showIcon
          title={gasto.pagado
            ? <>Pagado{gasto.metodo_pago ? ` (${gasto.metodo_pago.nombre})` : ''}{gasto.fecha_pago ? ` — ${new Date(gasto.fecha_pago).toLocaleDateString('es-PE')}` : ''}</>
            : 'Pendiente de pago'}
        />
      </Modal>

      <PagarGastoModal open={modalPago} gasto={gasto} onClose={() => setModalPago(false)} onPagado={() => { setModalPago(false); recargar(); }} />
    </>
  );
}

function PagarGastoModal({ open, gasto, onClose, onPagado }: { open: boolean; gasto: Gasto | undefined; onClose: () => void; onPagado: () => void }) {
  const { message } = App.useApp();
  const [idMetodoPago, setIdMetodoPago] = useState<string | undefined>(undefined);
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { data: metodosData } = useQuery({ queryKey: ['metodos-pago'], queryFn: metodosPagoApi.listar, enabled: open });
  const { data: apertura } = useQuery({ queryKey: ['mi-apertura-activa'], queryFn: () => cajaApi.miAperturaActiva(), enabled: open });

  const confirmarPago = async () => {
    if (!gasto) return;
    if (!idMetodoPago) { message.warning('Seleccione un método de pago'); return; }
    setEnviando(true);
    try {
      await gastosApi.pagar(gasto.id, {
        id_metodo_pago: idMetodoPago,
        referencia: referencia.trim() || undefined,
        id_caja_apertura: apertura?.id,
      });
      message.success('Pago registrado correctamente');
      setIdMetodoPago(undefined);
      setReferencia('');
      onPagado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar el pago');
    } finally {
      setEnviando(false);
    }
  };

  if (!gasto) return null;

  return (
    <Modal
      title={<><DollarOutlined /> Registrar pago de gasto</>}
      open={open}
      onCancel={onClose}
      onOk={confirmarPago}
      confirmLoading={enviando}
      okText="Confirmar Pago"
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        title={<>Gasto <strong>{gasto.numero_interno}</strong> — {gasto.razon_social_emisor} — Total: <strong>{formatMoneda(gasto.total, gasto.moneda)}</strong></>}
      />
      {apertura ? (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Se registrará como egreso en la caja abierta: {apertura.caja?.nombre || 'Caja'}
        </Typography.Text>
      ) : (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="No hay una caja abierta — el gasto se marcará como pagado sin afectar caja." />
      )}
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Método de pago *</Typography.Text>
      <Select
        value={idMetodoPago} onChange={setIdMetodoPago} style={{ width: '100%', marginBottom: 12 }}
        placeholder="Seleccione"
        options={(metodosData?.data || []).map((m) => ({ value: m.id, label: m.nombre }))}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Referencia (opcional)</Typography.Text>
      <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° operación, voucher, etc." />
    </Modal>
  );
}
