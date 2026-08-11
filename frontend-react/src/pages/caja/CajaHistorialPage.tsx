import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Select, Typography, Space, DatePicker, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FilterOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { cajaApi } from '@/api/caja';
import { usePagination } from '@/hooks/usePagination';
import { formatMoneda } from '@/utils/format';
import type { CajaApertura, ListarAperturasParams } from '@/types/caja';
import { CajaHistorialDetalleModal } from './CajaHistorialDetalleModal';

export function CajaHistorialPage() {
  const { page, setPage, limit } = usePagination(20);
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [idCaja, setIdCaja] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<string | undefined>(undefined);
  const [filtros, setFiltros] = useState<ListarAperturasParams>({});
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data: cajasData } = useQuery({ queryKey: ['cajas'], queryFn: () => cajaApi.cajas() });
  const { data, isFetching } = useQuery({
    queryKey: ['caja-aperturas', page, filtros],
    queryFn: () => cajaApi.aperturas({ page, limit, ...filtros }),
  });

  const filtrar = () => {
    setPage(1);
    setFiltros({
      fecha_desde: desde.format('YYYY-MM-DD'),
      fecha_hasta: hasta.format('YYYY-MM-DD'),
      id_caja: idCaja,
      estado,
    });
  };

  const columns: ColumnsType<CajaApertura> = [
    { title: 'Caja', render: (_, a) => a.caja?.nombre || '-' },
    { title: 'Apertura', render: (_, a) => dayjs(a.fecha_apertura).format('DD/MM/YYYY HH:mm') },
    { title: 'Cierre', render: (_, a) => a.fecha_cierre ? dayjs(a.fecha_cierre).format('DD/MM/YYYY HH:mm') : '-' },
    { title: 'Cajero', render: (_, a) => a.usuario ? `${a.usuario.nombre} ${a.usuario.apellido}` : '-' },
    { title: 'Monto apertura', align: 'right', render: (_, a) => formatMoneda(a.monto_apertura) },
    { title: 'Monto cierre', align: 'right', render: (_, a) => a.monto_cierre !== null ? formatMoneda(a.monto_cierre) : '-' },
    {
      title: 'Diferencia', align: 'right',
      render: (_, a) => {
        if (a.diferencia === null) return '-';
        const dif = Number(a.diferencia);
        return <Typography.Text strong type={dif === 0 ? undefined : dif > 0 ? 'success' : 'danger'}>{dif >= 0 ? '+' : ''}{formatMoneda(a.diferencia)}</Typography.Text>;
      },
    },
    { title: 'Estado', align: 'center', render: (_, a) => <Tag color={a.estado === 'abierta' ? 'success' : 'default'}>{a.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</Tag> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Historial de Caja</Typography.Title>

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
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Caja</Typography.Text>
            <Select allowClear placeholder="Todas" value={idCaja} onChange={setIdCaja} style={{ width: 180 }} options={(cajasData?.data || []).map((c) => ({ value: c.id, label: c.nombre }))} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Estado</Typography.Text>
            <Select allowClear placeholder="Todos" value={estado} onChange={setEstado} style={{ width: 160 }} options={[
              { value: 'abierta', label: 'Abierta' }, { value: 'cerrada', label: 'Cerrada' },
            ]} />
          </div>
          <Button type="primary" icon={<FilterOutlined />} onClick={filtrar} style={{ marginTop: 20 }}>Filtrar</Button>
        </Space>
      </div>

      <Table<CajaApertura>
        rowKey="id"
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
        onRow={(a) => ({ onClick: () => setDetalleId(a.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} registros`, onChange: setPage }}
      />

      <CajaHistorialDetalleModal id={detalleId} onClose={() => setDetalleId(null)} />
    </div>
  );
}

