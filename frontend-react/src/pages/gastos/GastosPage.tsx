import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Select, Typography, Space, DatePicker, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, FilterOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { gastosApi } from '@/api/gastos';
import { usePagination } from '@/hooks/usePagination';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import { CATEGORIAS_GASTO_LABEL, type Gasto } from '@/types/gasto';
import { GastoFormModal } from './GastoFormModal';
import { GastoDetalleModal } from './GastoDetalleModal';

export function GastosPage() {
  const { page, setPage, limit } = usePagination(20);
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [categoria, setCategoria] = useState<string | undefined>(undefined);
  const [pagado, setPagado] = useState<string | undefined>(undefined);
  const [filtros, setFiltros] = useState({});
  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['gastos', page, filtros],
    queryFn: () => gastosApi.listar({ page, limit, ...filtros }),
  });

  const filtrar = () => {
    setPage(1);
    setFiltros({
      fecha_desde: desde.format('YYYY-MM-DD'),
      fecha_hasta: hasta.format('YYYY-MM-DD'),
      categoria,
      pagado,
    });
  };

  const columns: ColumnsType<Gasto> = [
    { title: 'N° interno', dataIndex: 'numero_interno' },
    { title: 'Categoría', align: 'center', render: (_, g) => <Tag>{CATEGORIAS_GASTO_LABEL[g.categoria]}</Tag> },
    { title: 'Fecha', dataIndex: 'fecha_emision', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Emisor', dataIndex: 'razon_social_emisor' },
    { title: 'Comprobante', render: (_, g) => g.serie ? `${g.serie}-${g.numero}` : g.numero || '-' },
    { title: 'Total', align: 'right', render: (_, g) => <strong>{formatMoneda(g.total, g.moneda)}</strong> },
    { title: 'Pago', align: 'center', render: (_, g) => g.pagado ? <Tag color="success">Pagado</Tag> : <Tag color="warning">Pendiente</Tag> },
    { title: 'Estado', align: 'center', render: (_, g) => <EstadoTag estado={g.estado} /> },
    { title: '', align: 'center', width: 60, render: (_, g) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalleId(g.id)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Gastos</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalNuevo(true)}>Nuevo Gasto</Button>
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
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Categoría</Typography.Text>
            <Select allowClear placeholder="Todas" value={categoria} onChange={setCategoria} style={{ width: 180 }} options={Object.entries(CATEGORIAS_GASTO_LABEL).map(([value, label]) => ({ value, label }))} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Pago</Typography.Text>
            <Select allowClear placeholder="Todos" value={pagado} onChange={setPagado} style={{ width: 160 }} options={[
              { value: 'true', label: 'Pagado' }, { value: 'false', label: 'Pendiente' },
            ]} />
          </div>
          <Button type="primary" icon={<FilterOutlined />} onClick={filtrar} style={{ marginTop: 20 }}>Filtrar</Button>
        </Space>
      </div>

      <Table<Gasto>
        rowKey="id"
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
        onRow={(g) => ({ onClick: () => setDetalleId(g.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} registros`, onChange: setPage }}
      />

      <GastoFormModal open={modalNuevo} onClose={() => setModalNuevo(false)} onSaved={() => { setModalNuevo(false); refetch(); }} />
      <GastoDetalleModal id={detalleId} onClose={() => setDetalleId(null)} onCambiado={refetch} />
    </div>
  );
}
