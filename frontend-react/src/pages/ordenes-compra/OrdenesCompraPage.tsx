import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Select, Typography, Space, Modal, Descriptions, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined, CheckOutlined, CloseOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ordenesCompraApi } from '@/api/ordenes-compra';
import { ApiError } from '@/api/types';
import { usePagination } from '@/hooks/usePagination';
import { useConfirmar } from '@/components/ConfirmModal';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import { OrdenNuevaModal } from './OrdenNuevaModal';
import type { OrdenCompra } from '@/types/orden-compra';

const ESTADOS = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'anulado', label: 'Anulado' },
];

export function OrdenesCompraPage() {
  const { page, setPage, limit } = usePagination(20);
  const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>(undefined);
  const [estadoAplicado, setEstadoAplicado] = useState<string | undefined>(undefined);
  const [modalNueva, setModalNueva] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['ordenes-compra', page, estadoAplicado],
    queryFn: () => ordenesCompraApi.listar({ page, limit, estado: estadoAplicado }),
  });
  const { data: detalleData, isFetching: cargandoDetalle } = useQuery({
    queryKey: ['orden-compra', detalleId],
    queryFn: () => ordenesCompraApi.obtener(detalleId!),
    enabled: !!detalleId,
  });

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });

  const aprobar = async (id: string) => {
    const ok = await confirmar('¿Aprobar esta orden de compra?', 'Aprobar Orden');
    if (!ok) return;
    try {
      await ordenesCompraApi.aprobar(id);
      message.success('Orden aprobada');
      setDetalleId(null);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al aprobar la orden');
    }
  };

  const anular = async (id: string) => {
    const ok = await confirmar('¿Anular esta orden de compra?', 'Anular Orden');
    if (!ok) return;
    try {
      await ordenesCompraApi.anular(id);
      message.success('Orden anulada');
      setDetalleId(null);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al anular la orden');
    }
  };

  const columns: ColumnsType<OrdenCompra> = [
    { title: 'N° Orden', dataIndex: 'numero' },
    { title: 'Proveedor', render: (_, o) => o.proveedor?.razon_social || '-' },
    { title: 'Solicitante', render: (_, o) => o.solicitante ? `${o.solicitante.nombre} ${o.solicitante.apellido}` : '-' },
    { title: 'Fecha solicitud', dataIndex: 'fecha_solicitud', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Fecha requerida', dataIndex: 'fecha_requerida', render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Estado', align: 'center', render: (_, o) => <EstadoTag estado={o.estado} /> },
    {
      title: 'Acciones', align: 'center', width: 100,
      render: (_, o) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalleId(o.id)} />
          {o.estado === 'borrador' && <Button size="small" icon={<CheckOutlined />} title="Aprobar" onClick={() => aprobar(o.id)} />}
        </Space>
      ),
    },
  ];

  const orden = detalleData?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Órdenes de Compra</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalNueva(true)}>Nueva Orden</Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear placeholder="Todos los estados" style={{ width: 200 }}
          value={estadoFiltro} onChange={setEstadoFiltro} options={ESTADOS}
        />
        <Button icon={<FilterOutlined />} onClick={() => { setPage(1); setEstadoAplicado(estadoFiltro); }}>Filtrar</Button>
      </Space>

      <Table<OrdenCompra>
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={data?.data}
        loading={isFetching}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} órdenes`, onChange: setPage }}
      />

      <OrdenNuevaModal open={modalNueva} onClose={() => setModalNueva(false)} onSaved={() => { setModalNueva(false); recargar(); }} />

      <Modal
        title="Detalle de Orden"
        open={!!detalleId}
        onCancel={() => setDetalleId(null)}
        footer={orden?.estado === 'borrador' ? [
          <Button key="anular" danger icon={<CloseOutlined />} onClick={() => anular(orden.id)}>Anular</Button>,
          <Button key="aprobar" type="primary" icon={<CheckOutlined />} onClick={() => aprobar(orden.id)}>Aprobar</Button>,
        ] : undefined}
        width={700}
      >
        {cargandoDetalle || !orden ? 'Cargando...' : (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="N° Orden"><strong>{orden.numero}</strong></Descriptions.Item>
              <Descriptions.Item label="Estado"><EstadoTag estado={orden.estado} /></Descriptions.Item>
              <Descriptions.Item label="Proveedor">{orden.proveedor?.razon_social || '-'}</Descriptions.Item>
              <Descriptions.Item label="Moneda">{orden.moneda}</Descriptions.Item>
              <Descriptions.Item label="Solicitante">{orden.solicitante ? `${orden.solicitante.nombre} ${orden.solicitante.apellido}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="Aprobador">{orden.aprobador ? `${orden.aprobador.nombre} ${orden.aprobador.apellido}` : 'Pendiente'}</Descriptions.Item>
              <Descriptions.Item label="Fecha solicitud">{dayjs(orden.fecha_solicitud).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Fecha requerida">{orden.fecha_requerida ? dayjs(orden.fecha_requerida).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={orden.detalle || []}
              columns={[
                { title: 'Producto', render: (_, d: NonNullable<typeof orden.detalle>[number]) => d.producto?.nombre || d.id_producto },
                { title: 'Cantidad', align: 'right', render: (_, d: NonNullable<typeof orden.detalle>[number]) => Number(d.cantidad).toFixed(4) },
                { title: 'P. Referencial', align: 'right', render: (_, d: NonNullable<typeof orden.detalle>[number]) => formatMoneda(d.precio_referencial, orden.moneda) },
                { title: 'Total Ref.', align: 'right', render: (_, d: NonNullable<typeof orden.detalle>[number]) => <strong>{formatMoneda(Number(d.cantidad) * Number(d.precio_referencial), orden.moneda)}</strong> },
              ]}
            />
            {orden.observaciones && <Alert style={{ marginTop: 12 }} title={<><strong>Observaciones:</strong> {orden.observaciones}</>} type="info" />}
          </>
        )}
      </Modal>
    </div>
  );
}
