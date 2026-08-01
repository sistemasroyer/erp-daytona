import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Modal, Descriptions, Table, Button, Alert, Space, Typography, Select, Input } from 'antd';
import { FileExcelOutlined, CloseCircleOutlined, CarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { comprasApi } from '@/api/compras';
import { metodosPagoApi } from '@/api/metodos-pago';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { Compra, DetalleCompra } from '@/types/compra';

interface Props {
  id: string | null;
  onClose: () => void;
  onCambiado: () => void;
}

export function CompraDetalleModal({ id, onClose, onCambiado }: Props) {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalFlete, setModalFlete] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['compra', id],
    queryFn: () => comprasApi.obtener(id!),
    enabled: !!id,
  });
  const compra = data?.data;

  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: ['compra', id] });
    onCambiado();
  };

  const anular = async () => {
    if (!compra) return;
    const numero = compra.serie ? `${compra.serie}-${compra.numero}` : compra.numero;
    const ok = await confirmar(`¿Anular la compra ${numero}?`, 'Anular Compra');
    if (!ok) return;
    const motivo = window.prompt('Motivo de anulación (requerido):');
    if (!motivo?.trim()) { message.warning('Ingrese un motivo de anulación'); return; }
    try {
      await comprasApi.anular(compra.id, motivo.trim());
      message.success('Compra anulada correctamente');
      recargar();
      onClose();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al anular la compra');
    }
  };

  const columns = [
    { title: 'Producto', render: (_: unknown, d: DetalleCompra) => d.producto?.nombre || d.id_producto },
    { title: 'Cantidad', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => Number(d.cantidad).toFixed(4) },
    { title: 'P. Unitario', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => formatMoneda(d.precio_unitario, compra?.moneda) },
    { title: 'Subtotal', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => formatMoneda(d.subtotal, compra?.moneda) },
    { title: 'IGV', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => formatMoneda(d.igv, compra?.moneda) },
    { title: 'Total', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => <strong>{formatMoneda(d.total, compra?.moneda)}</strong> },
  ];

  const columnsCosteo = [
    { title: 'Producto', render: (_: unknown, d: DetalleCompra) => d.producto?.nombre || d.id_producto },
    { title: 'Costo Base s/IGV', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => formatMoneda(Number(d.cantidad) > 0 ? Number(d.subtotal) / Number(d.cantidad) : 0) },
    { title: 'Flete Prorrateado', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => <Typography.Text type="secondary">{formatMoneda(d.costo_flete_prorrateado || 0)}</Typography.Text> },
    { title: 'Costo Final s/IGV', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => <strong>{formatMoneda(d.costo_unitario_total)}</strong> },
    { title: 'Costo Final c/IGV', align: 'right' as const, render: (_: unknown, d: DetalleCompra) => <strong>{formatMoneda(d.afecta_igv ? Number(d.costo_unitario_total) * 1.18 : Number(d.costo_unitario_total))}</strong> },
  ];

  if (!compra) {
    return <Modal title="Detalle de Compra" open={!!id} onCancel={onClose} footer={null} width={950}>{isFetching ? 'Cargando...' : null}</Modal>;
  }

  const puedeAnular = compra.estado === 'registrada';
  const puedePagarFlete = compra.estado === 'registrada' && Number(compra.flete_monto) > 0 && !compra.flete_pagado;
  const puedeNotaCredito = compra.estado === 'registrada' && compra.tipo_documento !== 'nota_credito';
  const numero = compra.serie ? `${compra.serie}-${compra.numero}` : compra.numero;

  return (
    <>
      <Modal
        title="Detalle de Compra"
        open={!!id}
        onCancel={onClose}
        width={950}
        footer={
          <Space wrap>
            {puedePagarFlete && <Button icon={<CarOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }} onClick={() => setModalFlete(true)}>Registrar pago de flete</Button>}
            {puedeNotaCredito && <Button style={{ background: '#faad14', borderColor: '#faad14', color: '#fff' }} icon={<FileExcelOutlined />} onClick={() => navigate(`/compras/nueva-nota-credito?compra=${compra.id}`)}>Nota de Crédito</Button>}
            {puedeAnular && <Button danger icon={<CloseCircleOutlined />} onClick={anular}>Anular</Button>}
          </Space>
        }
      >
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Documento"><strong>{compra.tipo_documento} {numero}</strong></Descriptions.Item>
          <Descriptions.Item label="Proveedor">{compra.proveedor?.razon_social || '-'}</Descriptions.Item>
          <Descriptions.Item label="Fecha emisión">{new Date(compra.fecha_emision).toLocaleDateString('es-PE')}</Descriptions.Item>
          <Descriptions.Item label="RUC">{compra.proveedor?.ruc || '-'}</Descriptions.Item>
          <Descriptions.Item label="Moneda">{compra.moneda}</Descriptions.Item>
          <Descriptions.Item label="Almacén">{compra.almacen?.nombre || '-'}</Descriptions.Item>
          <Descriptions.Item label="Condición de pago">
            {compra.condicion_pago === 'credito' ? `Crédito${compra.fecha_vencimiento ? ` (vence ${new Date(compra.fecha_vencimiento).toLocaleDateString('es-PE')})` : ''}` : 'Contado'}
          </Descriptions.Item>
          <Descriptions.Item label="Estado"><EstadoTag estado={compra.estado} /></Descriptions.Item>
          {compra.observaciones && <Descriptions.Item label="Observaciones" span={2}>{compra.observaciones}</Descriptions.Item>}
        </Descriptions>

        <Typography.Title level={5}>Detalle de la factura (tal como la emitió el proveedor)</Typography.Title>
        <Table
          size="small" rowKey="id" pagination={false} dataSource={compra.detalle} columns={columns}
          summary={() => (
            <>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right">Subtotal:</Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={3} align="right">{formatMoneda(compra.subtotal, compra.moneda)}</Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right">IGV:</Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={3} align="right">{formatMoneda(compra.igv, compra.moneda)}</Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>TOTAL A PAGAR AL PROVEEDOR:</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={3} align="right"><strong>{formatMoneda(compra.total, compra.moneda)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            </>
          )}
        />

        {Number(compra.flete_monto) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderRadius: 8, padding: 12, marginTop: 12 }}>
            <div>
              <Typography.Text strong><CarOutlined /> Flete (gasto aparte, no incluido en el total de arriba)</Typography.Text>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                {formatMoneda(compra.flete_monto, compra.flete_moneda)}
                {compra.proveedor_flete ? ` · Transportista: ${compra.proveedor_flete.razon_social}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {compra.flete_pagado ? (
                <>
                  <Typography.Text type="success" strong>Pagado{compra.metodo_pago_flete ? ` (${compra.metodo_pago_flete.nombre})` : ''}</Typography.Text>
                  {compra.flete_fecha_pago && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{new Date(compra.flete_fecha_pago).toLocaleDateString('es-PE')}</div>}
                </>
              ) : <Typography.Text type="warning" strong>Pendiente de pago</Typography.Text>}
            </div>
          </div>
        )}

        <Typography.Title level={5} style={{ marginTop: 16 }}>Costeo de inventario</Typography.Title>
        <Alert
          type="info" showIcon style={{ marginBottom: 8 }}
          title="Este cálculo es independiente de la factura del proveedor: toma el costo unitario de la factura y le suma el flete prorrateado (si aplica) para obtener el costo real con el que se valoriza el inventario."
        />
        <Table size="small" rowKey="id" pagination={false} dataSource={compra.detalle} columns={columnsCosteo} bordered />
      </Modal>

      <PagarFleteModal open={modalFlete} compra={compra} onClose={() => setModalFlete(false)} onPagado={() => { setModalFlete(false); recargar(); }} />
    </>
  );
}

function PagarFleteModal({ open, compra, onClose, onPagado }: { open: boolean; compra: Compra | undefined; onClose: () => void; onPagado: () => void }) {
  const { message } = App.useApp();
  const [idMetodoPago, setIdMetodoPago] = useState<string | undefined>(undefined);
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { data: metodosData } = useQuery({ queryKey: ['metodos-pago'], queryFn: metodosPagoApi.listar, enabled: open });

  const confirmarPago = async () => {
    if (!compra) return;
    if (!idMetodoPago) { message.warning('Seleccione un método de pago'); return; }
    setEnviando(true);
    try {
      await comprasApi.pagarFlete(compra.id, { id_metodo_pago: idMetodoPago, referencia: referencia.trim() || undefined });
      message.success('Pago de flete registrado');
      setIdMetodoPago(undefined);
      setReferencia('');
      onPagado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar el pago de flete');
    } finally {
      setEnviando(false);
    }
  };

  if (!compra) return null;

  return (
    <Modal
      title={<><CarOutlined /> Registrar pago de flete</>}
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
        title={<>Flete de <strong>{formatMoneda(compra.flete_monto, compra.flete_moneda)}</strong>{compra.proveedor_flete ? <> a <strong>{compra.proveedor_flete.razon_social}</strong></> : null} — Compra {compra.serie ? `${compra.serie}-${compra.numero}` : compra.numero}</>}
      />
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
