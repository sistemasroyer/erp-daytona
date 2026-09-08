import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Select, Input, Tag, Typography, Space, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, FilterOutlined, EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { ventasApi } from '@/api/ventas';
import { usuariosApi } from '@/api/usuarios';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/auth/AuthContext';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { Venta } from '@/types/venta';
import { VentaDetalleModal } from '../ventas/VentaDetalleModal';

type Periodo = 'mes-actual' | 'mes-anterior' | 'anio-actual' | 'anio-anterior' | 'personalizado';

function rangoPeriodo(periodo: Periodo): [Dayjs, Dayjs] | null {
  const hoy = dayjs();
  switch (periodo) {
    case 'mes-actual': return [hoy.startOf('month'), hoy];
    case 'mes-anterior': return [hoy.subtract(1, 'month').startOf('month'), hoy.subtract(1, 'month').endOf('month')];
    case 'anio-actual': return [hoy.startOf('year'), hoy];
    case 'anio-anterior': return [hoy.subtract(1, 'year').startOf('year'), hoy.subtract(1, 'year').endOf('year')];
    default: return null;
  }
}

export function CotizacionesPage() {
  const { user } = useAuth();
  const { page, setPage, limit } = usePagination(20);
  const [periodo, setPeriodo] = useState<Periodo>('mes-actual');
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [estadoVenta, setEstadoVenta] = useState<string | undefined>(undefined);
  const [vendedor, setVendedor] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [filtros, setFiltros] = useState({});
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data: usuariosData } = useQuery({ queryKey: ['usuarios-all'], queryFn: () => usuariosApi.listar({ limit: 100 }), enabled: !!user?.esSuperadmin });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['cotizaciones', page, filtros],
    queryFn: () => ventasApi.listar({ page, limit, tipo_documento: 'COTIZACION', ...filtros }),
  });

  const aplicarPeriodo = (p: Periodo) => {
    setPeriodo(p);
    const rango = rangoPeriodo(p);
    if (rango) { setDesde(rango[0]); setHasta(rango[1]); }
  };

  const filtrar = () => {
    setPage(1);
    setFiltros({
      fecha_desde: desde.format('YYYY-MM-DD'),
      fecha_hasta: hasta.format('YYYY-MM-DD'),
      id_usuario: vendedor,
      search: searchInput || undefined,
    });
  };

  const datosFiltrados = estadoVenta ? (data?.data || []).filter((v) => v.estado_venta === estadoVenta) : data?.data;

  const columns: ColumnsType<Venta> = [
    { title: 'Comprobante', render: (_, v) => v.numero_comprobante || `${v.serie}-${String(v.correlativo).padStart(8, '0')}` },
    { title: 'Fecha', dataIndex: 'fecha_emision', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Cliente', render: (_, v) => v.cliente?.razon_social || '-' },
    { title: 'RUC/DNI', render: (_, v) => <Typography.Text type="secondary">{v.cliente?.numero_documento || '-'}</Typography.Text> },
    { title: 'Total', align: 'right', render: (_, v) => <strong>{formatMoneda(v.total, v.moneda)}</strong> },
    { title: 'Moneda', align: 'center', render: (_, v) => <Tag>{v.moneda}</Tag> },
    { title: 'Estado', align: 'center', render: (_, v) => <EstadoTag estado={v.estado_venta} /> },
    { title: '', align: 'center', width: 60, render: (_, v) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalleId(v.id)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Cotizaciones</Typography.Title>
        <Link to="/cotizaciones/nueva"><Button type="primary" icon={<PlusOutlined />}>Nueva Cotización</Button></Link>
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Período</Typography.Text>
            <Select value={periodo} onChange={aplicarPeriodo} style={{ width: 160 }} options={[
              { value: 'mes-actual', label: 'Este mes' },
              { value: 'mes-anterior', label: 'Mes anterior' },
              { value: 'anio-actual', label: 'Este año' },
              { value: 'anio-anterior', label: 'Año anterior' },
              { value: 'personalizado', label: 'Personalizado' },
            ]} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => { if (v) { setDesde(v); setPeriodo('personalizado'); } }} format="DD/MM/YYYY" />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={(v) => { if (v) { setHasta(v); setPeriodo('personalizado'); } }} format="DD/MM/YYYY" />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Estado</Typography.Text>
            <Select allowClear placeholder="Todos" value={estadoVenta} onChange={setEstadoVenta} style={{ width: 160 }} options={[
              { value: 'vigente', label: 'Vigente' }, { value: 'canjeada', label: 'Canjeada' }, { value: 'anulada', label: 'Anulada' },
            ]} />
          </div>
        </Space>
        <Space wrap>
          {user?.esSuperadmin && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Vendedor</Typography.Text>
              <Select allowClear placeholder="Todos" value={vendedor} onChange={setVendedor} style={{ width: 200 }} options={(usuariosData?.data || []).map((u) => ({ value: u.id, label: `${u.nombre} ${u.apellido}` }))} />
            </div>
          )}
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Buscar</Typography.Text>
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="N° comprobante o cliente..." style={{ width: 220 }} />
          </div>
          <Button type="primary" icon={<FilterOutlined />} onClick={filtrar} style={{ marginTop: 20 }}>Filtrar</Button>
        </Space>
      </div>

      <Table<Venta>
        rowKey="id"
        columns={columns}
        dataSource={datosFiltrados}
        loading={isFetching}
        onRow={(v) => ({ onClick: () => setDetalleId(v.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} registros`, onChange: setPage }}
        scroll={{ x: 1100 }}
      />

      <VentaDetalleModal id={detalleId} onClose={() => setDetalleId(null)} onCambiado={refetch} />
    </div>
  );
}
