import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Select, DatePicker, Button, Typography, Tag, Row, Col, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FilterOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { reportesApi } from '@/api/reportes';
import { almacenesApi } from '@/api/almacenes';
import { productosApi } from '@/api/productos';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import { TIPO_MOVIMIENTO_LABEL, TIPO_REFERENCIA_LABEL, type MovimientoKardex } from '@/types/kardex';
import type { Producto } from '@/types/producto';

export function KardexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idProducto = searchParams.get('id');

  const [almacenFiltro, setAlmacenFiltro] = useState<string | undefined>(undefined);
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [filtrosAplicados, setFiltrosAplicados] = useState({ id_almacen: undefined as string | undefined, fecha_desde: desde.format('YYYY-MM-DD'), fecha_hasta: hasta.format('YYYY-MM-DD') });

  const { data: almacenesData } = useQuery({ queryKey: ['almacenes'], queryFn: () => almacenesApi.listar() });
  const { data: productoData } = useQuery({
    queryKey: ['producto', idProducto],
    queryFn: () => productosApi.obtener(idProducto!),
    enabled: !!idProducto,
  });
  const { data: kardexData, isFetching } = useQuery({
    queryKey: ['kardex', idProducto, filtrosAplicados],
    queryFn: () => reportesApi.kardex(idProducto!, filtrosAplicados),
    enabled: !!idProducto,
  });

  useEffect(() => {
    setFiltrosAplicados({ id_almacen: almacenFiltro, fecha_desde: desde.format('YYYY-MM-DD'), fecha_hasta: hasta.format('YYYY-MM-DD') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProducto]);

  const seleccionarProducto = (p: Producto) => {
    setSearchParams({ id: p.id });
  };

  const producto = productoData?.data;
  const items = kardexData?.data || [];
  const total = kardexData?.meta?.total ?? items.length;

  const columns: ColumnsType<MovimientoKardex> = [
    { title: 'Fecha', dataIndex: 'fecha', render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    {
      title: 'Tipo', dataIndex: 'tipo_movimiento',
      render: (v, k) => <Tag color={Number(k.cantidad_entrada) > 0 ? 'success' : 'error'}>{TIPO_MOVIMIENTO_LABEL[v] || v}</Tag>,
    },
    { title: 'Referencia', dataIndex: 'tipo_referencia', render: (v) => <Typography.Text type="secondary">{v ? (TIPO_REFERENCIA_LABEL[v] || v) : '-'}</Typography.Text> },
    { title: 'Entrada', align: 'right', render: (_, k) => Number(k.cantidad_entrada) > 0 ? <Typography.Text type="success" strong>{Number(k.cantidad_entrada).toFixed(4)}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text> },
    { title: 'Salida', align: 'right', render: (_, k) => Number(k.cantidad_salida) > 0 ? <Typography.Text type="danger" strong>{Number(k.cantidad_salida).toFixed(4)}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text> },
    { title: 'C. Unitario', align: 'right', render: (_, k) => formatMoneda(k.costo_unitario) },
    { title: 'C. Total', align: 'right', render: (_, k) => formatMoneda(k.costo_total) },
    { title: 'Stock', align: 'right', render: (_, k) => <strong>{Number(k.stock_resultante).toFixed(4)}</strong> },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="bottom">
          <Col span={8}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Producto</Typography.Text>
            <Autocomplete<Producto>
              placeholder="Buscar por código o nombre..."
              buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
              getLabel={() => ''}
              renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre}</>}
              onSelect={seleccionarProducto}
            />
          </Col>
          <Col span={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Col>
          <Col span={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={(v) => v && setHasta(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Col>
          <Col span={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Almacén</Typography.Text>
            <Select
              allowClear placeholder="Todos" style={{ width: '100%' }}
              value={almacenFiltro} onChange={setAlmacenFiltro}
              options={(almacenesData?.data || []).map((a) => ({ value: a.id, label: a.nombre }))}
            />
          </Col>
          <Col span={2}>
            <Button
              type="primary" icon={<FilterOutlined />}
              onClick={() => setFiltrosAplicados({ id_almacen: almacenFiltro, fecha_desde: desde.format('YYYY-MM-DD'), fecha_hasta: hasta.format('YYYY-MM-DD') })}
            />
          </Col>
        </Row>
      </Card>

      {producto && (
        <Card style={{ marginBottom: 16 }}>
          <Row>
            <Col span={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Producto</Typography.Text>
              <Typography.Text strong>{producto.nombre}</Typography.Text>
            </Col>
            <Col span={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Código</Typography.Text>
              <Typography.Text strong>{producto.codigo}</Typography.Text>
            </Col>
            <Col span={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Stock actual</Typography.Text>
              <Typography.Text strong style={{ color: '#1677ff' }}>{Number(producto.stock_actual || 0).toFixed(4)}</Typography.Text>
            </Col>
            <Col span={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Costo promedio</Typography.Text>
              <Typography.Text>{formatMoneda(producto.costo_promedio)}</Typography.Text>
            </Col>
            <Col span={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Método valuación</Typography.Text>
              <Tag color="blue">Costo Promedio Ponderado</Tag>
            </Col>
          </Row>
        </Card>
      )}

      <Card
        title={<><ClockCircleOutlined style={{ marginRight: 8 }} />Movimientos Kardex</>}
        extra={idProducto && <Typography.Text type="secondary">{total} movimientos</Typography.Text>}
      >
        {idProducto
          ? <Table<MovimientoKardex> rowKey="id" columns={columns} dataSource={items} loading={isFetching} pagination={false} locale={{ emptyText: 'Sin movimientos en el período' }} />
          : <Empty description="Busque un producto arriba para ver su kardex" />}
      </Card>
    </div>
  );
}
