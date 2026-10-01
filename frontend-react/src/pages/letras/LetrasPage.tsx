import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, DatePicker, Input, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCuotasApi } from '@/api/letras';
import { proveedoresApi } from '@/api/proveedores';
import { Autocomplete } from '@/components/Autocomplete';
import { EstadoTag } from '@/components/EstadoTag';
import { usePagination } from '@/hooks/usePagination';
import { formatMoneda, nombreUsuario } from '@/utils/format';
import type { FiltroEstadoLetra, LetraConPaquete, MonedaLetras } from '@/types/letras';
import type { Proveedor } from '@/types/proveedor';
import { AccionesLetra } from './AccionesLetra';
import { estadoLetraVisible } from './PaqueteLetrasDetallePage';

const FILTROS_ESTADO: { value: FiltroEstadoLetra | 'todas'; label: string }[] = [
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'pagada', label: 'Pagadas' },
  { value: 'cancelada', label: 'Canceladas' },
  { value: 'todas', label: 'Todas' },
];

/** Todas las letras de todos los paquetes: lo que hay que pagar, lo vencido y lo pagado. */
export function LetrasPage() {
  const { page, limit, setPage } = usePagination(50);
  const [estado, setEstado] = useState<FiltroEstadoLetra | 'todas'>('por_vencer');
  const [moneda, setMoneda] = useState<MonedaLetras | undefined>();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [rango, setRango] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [search, setSearch] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const filtros = {
    estado: estado === 'todas' ? undefined : estado,
    moneda,
    id_proveedor: proveedor?.id,
    fecha_desde: rango?.[0]?.format('YYYY-MM-DD'),
    fecha_hasta: rango?.[1]?.format('YYYY-MM-DD'),
    search: busqueda || undefined,
  };
  const { data, isFetching } = useQuery({
    queryKey: ['letras-cuotas', page, limit, filtros],
    queryFn: () => letrasCuotasApi.listar({ ...filtros, page, limit }),
  });
  // El resumen ignora el filtro de estado: muestra las cuatro tarjetas con el resto de filtros.
  const { data: resumen } = useQuery({
    queryKey: ['letras-cuotas-resumen', { ...filtros, estado: undefined }],
    queryFn: () => letrasCuotasApi.resumen({ ...filtros, estado: undefined }),
  });

  const tarjeta = (titulo: string, clave: 'pendiente' | 'vencida' | 'pagada', color: string, filtro: FiltroEstadoLetra) => {
    const r = resumen?.data;
    const valor = (m: MonedaLetras) => r?.[m]?.[clave] ?? { cantidad: 0, monto: 0 };
    // "Por vencer" = pendientes que no están vencidas.
    const neto = (m: MonedaLetras) => clave === 'pendiente'
      ? { cantidad: valor(m).cantidad - (r?.[m]?.vencida?.cantidad ?? 0), monto: valor(m).monto - (r?.[m]?.vencida?.monto ?? 0) }
      : valor(m);
    return (
      <Col xs={24} sm={8}>
        <Card size="small" hoverable onClick={() => { setEstado(filtro); setPage(1); }} style={{ borderColor: estado === filtro ? '#1677ff' : undefined }}>
          <Statistic title={`${titulo} (${neto('PEN').cantidad + neto('USD').cantidad})`} value={formatMoneda(neto('PEN').monto, 'PEN')} styles={{ content: { color, fontSize: 20 } }} />
          {neto('USD').cantidad > 0 && <Typography.Text strong style={{ color }}>{formatMoneda(neto('USD').monto, 'USD')}</Typography.Text>}
        </Card>
      </Col>
    );
  };

  const columnas: ColumnsType<LetraConPaquete> = [
    { title: 'Fecha de pago', render: (_, l) => <strong>{dayjs(l.fecha_pago).format('ddd DD/MM/YYYY')}</strong> },
    { title: 'Fecha banco', render: (_, l) => dayjs(l.fecha_banco).format('DD/MM/YYYY') },
    {
      title: 'Proveedor', render: (_, l) => (
        <><div>{l.paquete.proveedor.razon_social}</div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{l.paquete.proveedor.ruc}</Typography.Text></>
      ),
    },
    { title: 'Paquete', render: (_, l) => <Link to={`/letras/paquetes/${l.paquete.id}`}>{l.paquete.codigo}</Link> },
    { title: 'Cuota', align: 'center', dataIndex: 'numero_cuota' },
    { title: 'Monto', align: 'right', render: (_, l) => <strong>{formatMoneda(l.monto, l.moneda)}</strong> },
    { title: 'Banco', render: (_, l) => <>{l.paquete.banco?.siglas || l.paquete.banco?.nombre || '-'}{l.codigo_banco && <div style={{ fontSize: 12 }}>{l.codigo_banco}</div>}</> },
    { title: 'Estado', align: 'center', render: (_, l) => <EstadoTag estado={estadoLetraVisible(l)} /> },
    {
      title: 'Pago', render: (_, l) => l.estado === 'pagada'
        ? <>{l.fecha_pago_efectivo && dayjs(l.fecha_pago_efectivo).format('DD/MM/YYYY')} · {l.metodo_pago}<br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{nombreUsuario(l.usuario_pago)}</Typography.Text></>
        : '-',
    },
    { title: '', width: 50, render: (_, l) => <AccionesLetra letra={l} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Letras</Typography.Title>
        <Link to="/letras/calendario"><Button icon={<CalendarOutlined />}>Ver calendario</Button></Link>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {tarjeta('Por vencer', 'pendiente', '#1677ff', 'por_vencer')}
        {tarjeta('Vencidas', 'vencida', '#cf1322', 'vencida')}
        {tarjeta('Pagadas', 'pagada', '#389e0d', 'pagada')}
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Segmented value={estado} onChange={(v) => { setEstado(v as FiltroEstadoLetra | 'todas'); setPage(1); }} options={FILTROS_ESTADO} />
          {proveedor
            ? <Tag closable onClose={() => { setProveedor(null); setPage(1); }} style={{ padding: '4px 8px' }}>{proveedor.razon_social}</Tag>
            : (
              <div style={{ width: 280 }}>
                <Autocomplete<Proveedor>
                  placeholder="Proveedor (RUC o nombre)"
                  buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 10 })).data}
                  getLabel={(p) => p.razon_social}
                  renderOpcion={(p) => <><strong>{p.ruc}</strong> — {p.razon_social}</>}
                  onSelect={(p) => { setProveedor(p); setPage(1); }}
                />
              </div>
            )}
          <DatePicker.RangePicker value={rango} onChange={(v) => { setRango(v); setPage(1); }} format="DD/MM/YYYY" placeholder={['Pago desde', 'hasta']} />
          <Select allowClear placeholder="Moneda" style={{ width: 130 }} value={moneda} onChange={(v) => { setMoneda(v); setPage(1); }}
            options={[{ value: 'PEN', label: 'Soles' }, { value: 'USD', label: 'Dólares' }]} />
          <Input.Search placeholder="Paquete o código banco" allowClear style={{ width: 240 }} enterButton={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)} onSearch={(v) => { setBusqueda(v.trim()); setPage(1); }} />
        </Space>
        <Table
          size="small" rowKey="id" columns={columnas} dataSource={data?.data ?? []} loading={isFetching}
          rowClassName={(l) => (estadoLetraVisible(l) === 'vencida' ? 'fila-vencida' : '')}
          pagination={{ current: page, pageSize: limit, total: data?.meta?.total ?? 0, onChange: setPage, showSizeChanger: false, showTotal: (t) => `${t} letras` }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
