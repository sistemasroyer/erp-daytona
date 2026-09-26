import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Select, DatePicker, Button, Typography, Tag, Row, Col, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FilterOutlined, ClockCircleOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { reportesApi } from '@/api/reportes';
import { almacenesApi } from '@/api/almacenes';
import { productosApi } from '@/api/productos';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import { TIPO_MOVIMIENTO_LABEL, etiquetaReferencia, type MovimientoKardex } from '@/types/kardex';
import type { Producto } from '@/types/producto';
import { VentaDetalleModal } from '@/pages/ventas/VentaDetalleModal';
import { CompraDetalleModal } from '@/pages/compras/CompraDetalleModal';
import { AjusteDetalleModal } from './AjusteDetalleModal';

export function KardexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idProducto = searchParams.get('id');

  const [almacenFiltro, setAlmacenFiltro] = useState<string | undefined>(undefined);
  const [desde, setDesde] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs | null>(dayjs());
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 100;
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    id_almacen: undefined as string | undefined,
    fecha_desde: desde?.format('YYYY-MM-DD'),
    fecha_hasta: hasta?.format('YYYY-MM-DD'),
  });

  const { data: almacenesData } = useQuery({ queryKey: ['almacenes'], queryFn: () => almacenesApi.listar() });

  // El Kardex es un saldo corriente por (producto, almacén): si se mezclan almacenes sin filtrar,
  // la columna "Stock" deja de tener sentido como saldo continuo. Por eso arranca siempre filtrado
  // al almacén principal en vez de en "Todos" — el usuario puede cambiarlo a mano si lo necesita.
  const almacenPorDefectoAplicado = useRef(false);
  useEffect(() => {
    if (almacenPorDefectoAplicado.current || !almacenesData?.data.length) return;
    almacenPorDefectoAplicado.current = true;
    const principal = almacenesData.data.find((a) => a.es_principal) || almacenesData.data[0];
    setAlmacenFiltro(principal.id);
    setFiltrosAplicados((prev) => ({ ...prev, id_almacen: principal.id }));
  }, [almacenesData]);
  const { data: productoData } = useQuery({
    queryKey: ['producto', idProducto],
    queryFn: () => productosApi.obtener(idProducto!),
    enabled: !!idProducto,
  });
  const { data: kardexData, isFetching, refetch: refetchKardex } = useQuery({
    queryKey: ['kardex', idProducto, filtrosAplicados, pagina],
    queryFn: () => reportesApi.kardex(idProducto!, { ...filtrosAplicados, limit: PAGE_SIZE, skip: (pagina - 1) * PAGE_SIZE }),
    enabled: !!idProducto,
  });

  const [ventaDetalleId, setVentaDetalleId] = useState<string | null>(null);
  const [compraDetalleId, setCompraDetalleId] = useState<string | null>(null);
  const [ajusteDetalleId, setAjusteDetalleId] = useState<string | null>(null);

  const abrirDocumento = (k: MovimientoKardex) => {
    if (!k.id_referencia) return;
    if (k.tipo_referencia === 'venta') setVentaDetalleId(k.id_referencia);
    else if (k.tipo_referencia === 'compra') setCompraDetalleId(k.id_referencia);
    else if (k.tipo_referencia === 'ajuste') setAjusteDetalleId(k.id_referencia);
  };

  useEffect(() => {
    setFiltrosAplicados({ id_almacen: almacenFiltro, fecha_desde: desde?.format('YYYY-MM-DD'), fecha_hasta: hasta?.format('YYYY-MM-DD') });
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProducto]);

  const seleccionarProducto = (p: Producto) => {
    setSearchParams({ id: p.id });
  };

  const aplicarFiltros = (nuevoDesde: Dayjs | null, nuevoHasta: Dayjs | null) => {
    setFiltrosAplicados({ id_almacen: almacenFiltro, fecha_desde: nuevoDesde?.format('YYYY-MM-DD'), fecha_hasta: nuevoHasta?.format('YYYY-MM-DD') });
    setPagina(1);
  };

  const verTodoElHistorial = () => {
    setDesde(null);
    setHasta(null);
    aplicarFiltros(null, null);
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
    { title: 'Referencia', render: (_, k) => <Typography.Text type="secondary">{etiquetaReferencia(k)}</Typography.Text> },
    { title: 'N° Documento', render: (_, k) => k.numero_documento || '-' },
    { title: 'Entrada', align: 'right', render: (_, k) => Number(k.cantidad_entrada) > 0 ? <Typography.Text type="success" strong>{Number(k.cantidad_entrada).toFixed(0)}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text> },
    { title: 'Salida', align: 'right', render: (_, k) => Number(k.cantidad_salida) > 0 ? <Typography.Text type="danger" strong>{Number(k.cantidad_salida).toFixed(0)}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text> },
    { title: 'C. Unitario', align: 'right', render: (_, k) => formatMoneda(k.costo_unitario) },
    { title: 'C. Total', align: 'right', render: (_, k) => formatMoneda(k.costo_total) },
    { title: 'Stock', align: 'right', render: (_, k) => <strong>{Number(k.stock_resultante).toFixed(0)}</strong> },
    {
      title: '', width: 50, render: (_, k) => (
        ['venta', 'compra', 'ajuste'].includes(k.tipo_referencia || '') && k.numero_documento
          ? <Button size="small" icon={<EyeOutlined />} onClick={() => abrirDocumento(k)} />
          : null
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="bottom">
          <Col span={7}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Producto</Typography.Text>
            <Autocomplete<Producto>
              placeholder="Buscar por código o nombre..."
              buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
              getLabel={() => ''}
              renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre}</>}
              onSelect={seleccionarProducto}
            />
          </Col>
          <Col span={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={setDesde} allowClear style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Sin límite" />
          </Col>
          <Col span={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={setHasta} allowClear style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Sin límite" />
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
            <Button type="primary" icon={<FilterOutlined />} onClick={() => aplicarFiltros(desde, hasta)} />
          </Col>
          <Col span={3}>
            <Button icon={<HistoryOutlined />} onClick={verTodoElHistorial} style={{ width: '100%' }}>
              Ver todo
            </Button>
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
              <Typography.Text strong style={{ color: '#1677ff' }}>{Number(producto.stock_actual || 0).toFixed(0)}</Typography.Text>
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
      >
        {idProducto
          ? <Table<MovimientoKardex>
              rowKey="id" columns={columns} dataSource={items} loading={isFetching} scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'Sin movimientos en el período' }}
              pagination={{ current: pagina, pageSize: PAGE_SIZE, total, showTotal: (t) => `${t} movimientos`, onChange: setPagina }}
            />
          : <Empty description="Seleccione un producto" />}
      </Card>

      <VentaDetalleModal id={ventaDetalleId} onClose={() => setVentaDetalleId(null)} onCambiado={() => refetchKardex()} />
      <CompraDetalleModal id={compraDetalleId} onClose={() => setCompraDetalleId(null)} onCambiado={() => refetchKardex()} />
      <AjusteDetalleModal id={ajusteDetalleId} onClose={() => setAjusteDetalleId(null)} />
    </div>
  );
}
