import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Modal, Descriptions, Table, Row, Col, Button, Alert, Space, Typography } from 'antd';
import { PrinterOutlined, SendOutlined, RetweetOutlined, FileExcelOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ventasApi } from '@/api/ventas';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { DetalleVenta } from '@/types/venta';
import { CanjeModal } from './CanjeModal';

interface Props {
  id: string | null;
  onClose: () => void;
  onCambiado: () => void;
}

export function VentaDetalleModal({ id, onClose, onCambiado }: Props) {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [modalCanje, setModalCanje] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.obtener(id!),
    enabled: !!id,
  });
  const venta = data?.data;

  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: ['venta', id] });
    onCambiado();
  };

  const anular = async () => {
    if (!venta) return;
    const ok = await confirmar(`¿Anular la venta ${venta.numero_comprobante || `${venta.serie}-${venta.correlativo}`}?`, 'Anular Venta');
    if (!ok) return;
    const motivo = window.prompt('Motivo de anulación (requerido):');
    if (!motivo?.trim()) { message.warning('Ingrese un motivo de anulación'); return; }
    try {
      await ventasApi.anular(venta.id, motivo.trim());
      message.success('Venta anulada correctamente');
      recargar();
      onClose();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al anular la venta');
    }
  };

  const reenviarSunat = async () => {
    if (!venta) return;
    setEnviando(true);
    try {
      const res = await ventasApi.reenviarSunat(venta.id);
      if (res.data.estado_sunat === 'aceptado') {
        message.success('¡Documento aceptado por SUNAT!');
      } else {
        const envio = res.data.sunat_envios?.[0];
        message.error(`SUNAT no aceptó el documento: ${envio?.error_mensaje || 'ver detalle'}`);
      }
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al enviar a SUNAT');
    } finally {
      setEnviando(false);
    }
  };

  const columns = [
    { title: 'Producto', render: (_: unknown, d: DetalleVenta) => d.producto?.nombre || d.id_producto },
    { title: 'Cantidad', align: 'right' as const, render: (_: unknown, d: DetalleVenta) => Number(d.cantidad).toFixed(2) },
    { title: 'P. Unitario', align: 'right' as const, render: (_: unknown, d: DetalleVenta) => formatMoneda(d.precio_unitario, venta?.moneda) },
    { title: 'Descuento', align: 'right' as const, render: (_: unknown, d: DetalleVenta) => formatMoneda(d.descuento || 0, venta?.moneda) },
    { title: 'Subtotal', align: 'right' as const, render: (_: unknown, d: DetalleVenta) => formatMoneda(d.subtotal, venta?.moneda) },
    { title: 'IGV', align: 'right' as const, render: (_: unknown, d: DetalleVenta) => formatMoneda(d.igv, venta?.moneda) },
    { title: 'Total', align: 'right' as const, render: (_: unknown, d: DetalleVenta) => <strong>{formatMoneda(d.total, venta?.moneda)}</strong> },
  ];

  if (!venta) {
    return <Modal title="Detalle de Venta" open={!!id} onCancel={onClose} footer={null}>{isFetching ? 'Cargando...' : null}</Modal>;
  }

  const esOficial = venta.tipo_documento === 'FACTURA' || venta.tipo_documento === 'BOLETA';
  const bloqueadoPorSunat = esOficial && venta.estado_sunat === 'aceptado';
  const puedeAnular = venta.estado_venta === 'vigente' && !bloqueadoPorSunat;
  const puedeNotaCredito = esOficial && venta.estado_venta === 'vigente';
  const puedeCanjear = venta.estado_venta === 'vigente' && (venta.tipo_documento === 'NOTA_VENTA' || venta.tipo_documento === 'COTIZACION');
  const puedeReenviar = esOficial && venta.estado_sunat !== 'aceptado' && venta.estado_venta === 'vigente';

  const envio = venta.sunat_envios?.[0];

  return (
    <>
      <Modal
        title="Detalle de Venta"
        open={!!id}
        onCancel={onClose}
        width={900}
        footer={
          <Space wrap>
            <Button icon={<PrinterOutlined />} onClick={() => window.open(`/ventas/imprimir?id=${venta.id}`, '_blank')}>Imprimir</Button>
            {puedeReenviar && <Button icon={<SendOutlined />} loading={enviando} onClick={reenviarSunat}>Enviar a SUNAT</Button>}
            {puedeCanjear && <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<RetweetOutlined />} onClick={() => setModalCanje(true)}>Canjear a Boleta/Factura</Button>}
            {puedeNotaCredito && <Button style={{ background: '#faad14', borderColor: '#faad14', color: '#fff' }} icon={<FileExcelOutlined />} onClick={() => navigate(`/ventas/nueva-nota-credito?venta=${venta.id}`)}>Nota de Crédito</Button>}
            {puedeAnular && <Button danger icon={<CloseCircleOutlined />} onClick={anular}>Anular</Button>}
          </Space>
        }
      >
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Comprobante"><strong>{venta.numero_comprobante || `${venta.serie}-${String(venta.correlativo).padStart(8, '0')}`}</strong></Descriptions.Item>
          <Descriptions.Item label="Cliente">{venta.cliente?.razon_social || '-'}</Descriptions.Item>
          <Descriptions.Item label="Fecha emisión">{new Date(venta.fecha_emision).toLocaleDateString('es-PE')}</Descriptions.Item>
          <Descriptions.Item label="RUC/DNI">{venta.cliente?.numero_documento || '-'}</Descriptions.Item>
          <Descriptions.Item label="Moneda">{venta.moneda}</Descriptions.Item>
          <Descriptions.Item label="Vendedor">{venta.vendedor ? `${venta.vendedor.nombre} ${venta.vendedor.apellido}` : '-'}</Descriptions.Item>
          <Descriptions.Item label="Estado SUNAT"><EstadoTag estado={venta.estado_sunat} /></Descriptions.Item>
          <Descriptions.Item label="Estado"><EstadoTag estado={venta.estado_venta} /></Descriptions.Item>
          {venta.observaciones && <Descriptions.Item label="Observaciones" span={2}>{venta.observaciones}</Descriptions.Item>}
        </Descriptions>

        <Typography.Title level={5}>Detalle de productos</Typography.Title>
        <Table
          size="small" rowKey="id" pagination={false} dataSource={venta.detalle} columns={columns}
          summary={() => (
            <>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right">Subtotal:</Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={3} align="right">{formatMoneda(venta.subtotal, venta.moneda)}</Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right">IGV (18%):</Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={3} align="right">{formatMoneda(venta.igv, venta.moneda)}</Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>TOTAL:</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={3} align="right"><strong>{formatMoneda(venta.total, venta.moneda)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            </>
          )}
        />

        <Typography.Title level={5} style={{ marginTop: 16 }}>Pagos</Typography.Title>
        <Row gutter={8}>
          {(venta.pagos || []).map((p) => (
            <Col span={8} key={p.id}>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.metodo_pago?.nombre || p.id_metodo_pago}</span>
                <strong>{formatMoneda(p.monto, venta.moneda)}</strong>
              </div>
            </Col>
          ))}
        </Row>

        {venta.id_venta_origen && <Alert style={{ marginTop: 16 }} type="info" showIcon title="Este documento fue canjeado desde otro documento." />}

        {esOficial && (
          <Alert
            style={{ marginTop: 16 }}
            type={envio?.estado === 'aceptado' ? 'success' : envio?.estado === 'error' || envio?.estado === 'rechazado' ? 'error' : 'info'}
            showIcon
            title={envio
              ? <>SUNAT (NubeFact): <EstadoTag estado={envio.estado} />{envio.error_mensaje && <div style={{ color: '#ff4d4f' }}>{envio.error_mensaje}</div>}
                  <Space style={{ marginTop: 4 }}>
                    {envio.enlace_pdf && <a href={envio.enlace_pdf} target="_blank" rel="noreferrer">PDF</a>}
                    {envio.enlace_xml && <a href={envio.enlace_xml} target="_blank" rel="noreferrer">XML</a>}
                    {envio.enlace_cdr && <a href={envio.enlace_cdr} target="_blank" rel="noreferrer">CDR</a>}
                  </Space>
                </>
              : 'Aún no se ha generado el envío a SUNAT.'}
          />
        )}
      </Modal>

      <CanjeModal
        open={modalCanje}
        venta={venta}
        onClose={() => setModalCanje(false)}
        onCanjeado={() => { setModalCanje(false); recargar(); onClose(); }}
      />
    </>
  );
}
