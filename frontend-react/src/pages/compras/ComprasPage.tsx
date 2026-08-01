import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Select, Typography, Space, DatePicker, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, FilterOutlined, EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { comprasApi } from '@/api/compras';
import { usePagination } from '@/hooks/usePagination';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import { TIPOS_DOC_COMPRA_LABEL, type Compra } from '@/types/compra';
import { CompraDetalleModal } from './CompraDetalleModal';

export function ComprasPage() {
  const { page, setPage, limit } = usePagination(20);
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [estado, setEstado] = useState<string | undefined>(undefined);
  const [filtros, setFiltros] = useState({});
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['compras', page, filtros],
    queryFn: () => comprasApi.listar({ page, limit, ...filtros }),
  });

  const filtrar = () => {
    setPage(1);
    setFiltros({
      fecha_desde: desde.format('YYYY-MM-DD'),
      fecha_hasta: hasta.format('YYYY-MM-DD'),
      estado,
    });
  };

  const columns: ColumnsType<Compra> = [
    { title: 'N° Documento', render: (_, c) => c.serie ? `${c.serie}-${c.numero}` : c.numero || '-' },
    { title: 'Tipo', align: 'center', render: (_, c) => <Tag>{TIPOS_DOC_COMPRA_LABEL[c.tipo_documento] || c.tipo_documento}</Tag> },
    { title: 'Fecha', dataIndex: 'fecha_emision', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Proveedor', render: (_, c) => c.proveedor?.razon_social || '-' },
    { title: 'Almacén', render: (_, c) => c.almacen?.nombre || '-' },
    { title: 'Condición', align: 'center', render: (_, c) => c.condicion_pago === 'credito' ? <Tag color="warning">Crédito</Tag> : <Tag color="success">Contado</Tag> },
    { title: 'Total', align: 'right', render: (_, c) => <strong>{formatMoneda(c.total, c.moneda)}</strong> },
    { title: 'Moneda', align: 'center', render: (_, c) => <Tag>{c.moneda}</Tag> },
    { title: 'Estado', align: 'center', render: (_, c) => <EstadoTag estado={c.estado} /> },
    { title: '', align: 'center', width: 60, render: (_, c) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalleId(c.id)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Registro de Compras</Typography.Title>
        <Link to="/compras/nueva"><Button type="primary" icon={<PlusOutlined />}>Nueva Compra</Button></Link>
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <Space wrap>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} format="DD/MM/YYYY" />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={(v) => v && setHasta(v)} format="DD/MM/YYYY" />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Estado</Typography.Text>
            <Select allowClear placeholder="Todos" value={estado} onChange={setEstado} style={{ width: 160 }} options={[
              { value: 'borrador', label: 'Borrador' }, { value: 'registrada', label: 'Registrada' }, { value: 'anulada', label: 'Anulada' },
            ]} />
          </div>
          <Button type="primary" icon={<FilterOutlined />} onClick={filtrar} style={{ marginTop: 20 }}>Filtrar</Button>
        </Space>
      </div>

      <Table<Compra>
        rowKey="id"
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
        onRow={(c) => ({ onClick: () => setDetalleId(c.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} registros`, onChange: setPage }}
        scroll={{ x: 1300 }}
      />

      <CompraDetalleModal id={detalleId} onClose={() => setDetalleId(null)} onCambiado={refetch} />
    </div>
  );
}
