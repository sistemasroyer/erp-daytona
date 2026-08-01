import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Typography, Alert, Modal, Form, DatePicker, InputNumber, Select, Tag, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { tiposCambioApi } from '@/api/tipos-cambio';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import type { TipoCambio } from '@/types/tipo-cambio';

export function TiposCambioPage() {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ['tipos-cambio'], queryFn: () => tiposCambioApi.listar() });
  const { data: hoyData } = useQuery({ queryKey: ['tipos-cambio-hoy'], queryFn: () => tiposCambioApi.hoy() });
  const hoy = hoyData?.data;

  const [modal, setModal] = useState<{ open: boolean; tc: TipoCambio | null }>({ open: false, tc: null });
  const [fecha, setFecha] = useState<Dayjs>(dayjs());
  const [compra, setCompra] = useState(0);
  const [venta, setVenta] = useState(0);
  const [fuente, setFuente] = useState<'manual' | 'sunat'>('manual');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!modal.open) return;
    if (modal.tc) {
      setFecha(dayjs(modal.tc.fecha));
      setCompra(Number(modal.tc.compra));
      setVenta(Number(modal.tc.venta));
      setFuente(modal.tc.fuente);
    } else {
      setFecha(dayjs());
      setCompra(0);
      setVenta(0);
      setFuente('manual');
    }
  }, [modal]);

  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: ['tipos-cambio'] });
    queryClient.invalidateQueries({ queryKey: ['tipos-cambio-hoy'] });
  };

  const guardar = async () => {
    if (!compra || !venta) { message.warning('Todos los campos son requeridos'); return; }
    setSaving(true);
    try {
      const dto = { fecha: fecha.format('YYYY-MM-DD'), compra, venta, fuente };
      if (modal.tc) await tiposCambioApi.actualizar(modal.tc.id, dto);
      else await tiposCambioApi.crear(dto);
      setModal({ open: false, tc: null });
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (tc: TipoCambio) => {
    const ok = await confirmar('¿Eliminar este tipo de cambio?', 'Eliminar Tipo de Cambio');
    if (!ok) return;
    try {
      await tiposCambioApi.eliminar(tc.id);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  const columns: ColumnsType<TipoCambio> = [
    {
      title: 'Fecha', dataIndex: 'fecha',
      render: (v, tc) => (
        <>
          {dayjs(v).format('DD MMM YYYY')} {hoy?.id === tc.id && <Tag color="success">HOY</Tag>}
        </>
      ),
    },
    { title: 'Compra', dataIndex: 'compra', align: 'right', render: (v) => `S/ ${Number(v).toFixed(4)}` },
    { title: 'Venta', dataIndex: 'venta', align: 'right', render: (v) => `S/ ${Number(v).toFixed(4)}` },
    { title: 'Fuente', dataIndex: 'fuente', render: (v) => <Tag color={v === 'sunat' ? 'blue' : 'default'}>{v}</Tag> },
    {
      title: '', align: 'right', width: 100,
      render: (_, tc) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, tc })} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(tc)} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Tipos de Cambio USD/PEN</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, tc: null })}>Registrar Tipo de Cambio</Button>
      </div>

      {hoy ? (
        <Alert
          type="success" showIcon style={{ marginBottom: 16 }}
          title={<>Tipo de cambio de hoy: <strong>Compra S/ {Number(hoy.compra).toFixed(4)}</strong> / <strong>Venta S/ {Number(hoy.venta).toFixed(4)}</strong></>}
        />
      ) : (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="No hay tipo de cambio registrado para hoy. Las compras en USD usarán el tipo de cambio manual." />
      )}

      <Typography.Text type="secondary">Historial (últimos 60 días)</Typography.Text>
      <Table<TipoCambio> rowKey="id" columns={columns} dataSource={data?.data} pagination={false} style={{ marginTop: 8 }} />

      <Modal
        title={modal.tc ? 'Editar Tipo de Cambio' : 'Nuevo Tipo de Cambio'}
        open={modal.open}
        onCancel={() => setModal({ open: false, tc: null })}
        onOk={guardar}
        confirmLoading={saving}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form layout="vertical">
          <Form.Item label="Fecha" required>
            <DatePicker value={fecha} onChange={(v) => v && setFecha(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item label="Compra (USD → PEN)" required>
              <Space.Compact>
                <Button disabled>S/</Button>
                <InputNumber value={compra} onChange={(v) => setCompra(v ?? 0)} min={0.0001} step={0.0001} />
              </Space.Compact>
            </Form.Item>
            <Form.Item label="Venta (USD → PEN)" required>
              <Space.Compact>
                <Button disabled>S/</Button>
                <InputNumber value={venta} onChange={(v) => setVenta(v ?? 0)} min={0.0001} step={0.0001} />
              </Space.Compact>
            </Form.Item>
          </Space>
          <Form.Item label="Fuente">
            <Select value={fuente} onChange={setFuente} options={[{ value: 'manual', label: 'Manual' }, { value: 'sunat', label: 'SUNAT' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
