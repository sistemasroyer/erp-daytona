import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Card, Row, Col, DatePicker, Select, Input, Button, Statistic, Table, Typography, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Bar } from '@ant-design/plots';
import { PlayCircleOutlined, FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { reportesApi } from '@/api/reportes';
import { ApiError } from '@/api/types';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { ItemReporteTomaInventario } from '@/types/reportes';

const TOP_N_GRAFICO = 10;

export function TomaInventarioReportePage() {
  const { message } = App.useApp();

  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [search, setSearch] = useState('');
  const [tipoDiferencia, setTipoDiferencia] = useState<string | undefined>(undefined);
  const [filtros, setFiltros] = useState<{ fecha_desde: string; fecha_hasta: string; search?: string; tipo_diferencia?: string } | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['reporte-tomas-inventario', filtros],
    queryFn: () => reportesApi.tomasInventario(filtros!),
    enabled: !!filtros,
  });

  const generar = () => setFiltros({
    fecha_desde: desde.format('YYYY-MM-DD'),
    fecha_hasta: hasta.format('YYYY-MM-DD'),
    search: search.trim() || undefined,
    tipo_diferencia: tipoDiferencia,
  });

  const exportarExcel = async () => {
    if (!filtros) return;
    try {
      await reportesApi.exportarTomasInventarioExcel(filtros);
      message.info('Descargando Excel...');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al exportar');
    }
  };

  const detalle = data?.data.detalle || [];
  const totales = data?.data.totales;
  const porProducto = data?.data.porProducto || [];

  const datosGrafico = [...porProducto]
    .sort((a, b) => Math.abs(b.valor_diferencia) - Math.abs(a.valor_diferencia))
    .slice(0, TOP_N_GRAFICO)
    .sort((a, b) => a.valor_diferencia - b.valor_diferencia) // de más negativo (falta) a más positivo (sobra)
    .map((g) => ({ nombre: g.nombre, valor: g.valor_diferencia, tipo: g.valor_diferencia < 0 ? 'Falta' : 'Sobra' }));

  const columns: ColumnsType<ItemReporteTomaInventario> = [
    { title: 'Toma', render: (_, d) => <>{d.toma.numero_interno} <EstadoTag estado={d.toma.estado} /></> },
    { title: 'Fecha conteo', render: (_, d) => dayjs(d.fecha_conteo).format('DD/MM/YYYY HH:mm') },
    { title: 'Código', render: (_, d) => d.producto.codigo },
    { title: 'Producto', render: (_, d) => d.producto.nombre },
    { title: 'Ubicación', render: (_, d) => d.producto.ubicacion || '-' },
    { title: 'Stock sistema', align: 'right', render: (_, d) => Number(d.stock_sistema).toFixed(0) },
    { title: 'Cant. contada', align: 'right', render: (_, d) => Number(d.cantidad_contada).toFixed(0) },
    {
      title: 'Diferencia', align: 'right',
      render: (_, d) => {
        const dif = Number(d.diferencia);
        return <Typography.Text strong type={dif === 0 ? undefined : dif > 0 ? 'success' : 'danger'}>{dif > 0 ? '+' : ''}{dif.toFixed(0)}</Typography.Text>;
      },
    },
    {
      title: 'Valor diferencia', align: 'right', sorter: (a, b) => a.valor_diferencia - b.valor_diferencia,
      render: (_, d) => (
        <Typography.Text strong type={d.valor_diferencia === 0 ? undefined : d.valor_diferencia > 0 ? 'success' : 'danger'}>
          {d.valor_diferencia > 0 ? '+' : ''}{formatMoneda(d.valor_diferencia)}
        </Typography.Text>
      ),
    },
    { title: 'Responsable', render: (_, d) => d.toma.usuario ? `${d.toma.usuario.nombre} ${d.toma.usuario.apellido}` : '-' },
    { title: 'Observaciones', render: (_, d) => d.observaciones || '-' },
  ];

  return (
    <div>
      <Typography.Title level={4}>Reporte de Toma de Inventario</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="bottom">
          <Col span={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Col>
          <Col span={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={(v) => v && setHasta(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Col>
          <Col span={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Producto</Typography.Text>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código o nombre..." />
          </Col>
          <Col span={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Diferencia</Typography.Text>
            <Select
              allowClear placeholder="Todas" style={{ width: '100%' }}
              value={tipoDiferencia} onChange={setTipoDiferencia}
              options={[
                { value: 'sobra', label: 'Sobran' },
                { value: 'falta', label: 'Faltan' },
                { value: 'ok', label: 'Sin diferencia' },
              ]}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={generar}>Generar</Button>
          </Col>
          <Col>
            <Button icon={<FileExcelOutlined />} onClick={exportarExcel} disabled={!filtros} style={{ color: '#237804', borderColor: '#237804' }}>
              Excel
            </Button>
          </Col>
        </Row>
      </Card>

      {!filtros ? (
        <Card><Empty description="Seleccione un período para generar el reporte" /></Card>
      ) : (
        <>
          {totales && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card><Statistic title="Conteos realizados" value={totales.cantidad} /></Card></Col>
              <Col span={6}><Card><Statistic title="Faltan" value={totales.faltan} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Sobran" value={totales.sobran} valueStyle={{ color: '#389e0d' }} /></Card></Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Valor neto de la diferencia"
                    value={totales.valor_neto}
                    prefix="S/"
                    precision={2}
                    valueStyle={{ color: totales.valor_neto < 0 ? '#cf1322' : '#389e0d' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card
            style={{ marginBottom: 16 }}
            title={<><BarChartOutlined style={{ marginRight: 8 }} />Top {TOP_N_GRAFICO} productos con mayor diferencia (S/)</>}
          >
            {datosGrafico.length ? (
              <Bar
                data={datosGrafico}
                xField="valor"
                yField="nombre"
                colorField="tipo"
                scale={{ color: { domain: ['Falta', 'Sobra'], range: ['#ff4d4f', '#52c41a'] } }}
                height={Math.max(280, datosGrafico.length * 32)}
                axis={{ x: { title: false }, y: { title: 'Soles (S/)' } }}
                label={{ text: (d: { valor: number }) => formatMoneda(d.valor), position: 'right' }}
                tooltip={{ items: [{ field: 'valor', valueFormatter: (v: number) => formatMoneda(v) }] }}
              />
            ) : (
              <Empty description="Sin diferencias en el período" />
            )}
          </Card>

          <Table<ItemReporteTomaInventario>
            rowKey="id" columns={columns} dataSource={detalle} loading={isFetching}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'Sin registros para estos filtros' }}
          />
        </>
      )}
    </div>
  );
}
