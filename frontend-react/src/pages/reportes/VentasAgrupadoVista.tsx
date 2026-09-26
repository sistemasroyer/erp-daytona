import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Card, Row, Col, DatePicker, Select, Button, Statistic, Table, Radio, Typography, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Bar } from '@ant-design/plots';
import { PlayCircleOutlined, FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { reportesApi } from '@/api/reportes';
import { seriesDocumentoApi } from '@/api/series-documento';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { useAuth } from '@/auth/AuthContext';
import type { AgrupacionVentas, GrupoVentaAgrupada } from '@/types/reportes';

const COLOR_BARRA = '#1677ff';
const TOP_N_GRAFICO = 15;

interface Props {
  agrupacion: AgrupacionVentas;
  titulo: string;
  columnaEtiqueta: string;
  etiquetaTop: string;
  /** true para "Ventas por Punto de Venta": filtrar por punto de venta ahí sería redundante con la propia agrupación. */
  ocultarFiltroPuntoVenta?: boolean;
}

export function VentasAgrupadoVista({ agrupacion, titulo, columnaEtiqueta, etiquetaTop, ocultarFiltroPuntoVenta }: Props) {
  const { message } = App.useApp();
  const { user } = useAuth();

  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [idPuntoVenta, setIdPuntoVenta] = useState<string | undefined>(undefined);
  const [metrica, setMetrica] = useState<'total' | 'unidades'>('total');
  const [filtros, setFiltros] = useState<{ fecha_desde: string; fecha_hasta: string; id_punto_venta?: string } | null>(null);

  const mostrarFiltroPuntoVenta = !!user?.esSuperadmin && !ocultarFiltroPuntoVenta;

  const { data: puntosVentaData } = useQuery({
    queryKey: ['puntos-venta'],
    queryFn: () => seriesDocumentoApi.puntosVenta(),
    enabled: mostrarFiltroPuntoVenta,
  });

  const { data, isFetching } = useQuery({
    queryKey: ['reporte-ventas-agrupado', agrupacion, filtros],
    queryFn: () => reportesApi.ventasAgrupado(agrupacion, filtros!),
    enabled: !!filtros,
  });

  const generar = () => setFiltros({
    fecha_desde: desde.format('YYYY-MM-DD'),
    fecha_hasta: hasta.format('YYYY-MM-DD'),
    id_punto_venta: idPuntoVenta,
  });

  const exportarExcel = async () => {
    if (!filtros) return;
    try {
      await reportesApi.exportarVentasAgrupadoExcel(agrupacion, filtros);
      message.info('Descargando Excel...');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al exportar');
    }
  };

  const grupos = data?.data.data || [];
  const totales = data?.data.totales;
  const grupoTop = grupos[0];

  const datosGrafico = [...grupos]
    .sort((a, b) => b[metrica] - a[metrica])
    .slice(0, TOP_N_GRAFICO)
    .map((g) => ({ nombre: g.nombre, valor: g[metrica] }));

  const columns: ColumnsType<GrupoVentaAgrupada> = [
    { title: columnaEtiqueta, dataIndex: 'nombre' },
    { title: 'Unidades', dataIndex: 'unidades', align: 'right', sorter: (a, b) => a.unidades - b.unidades, render: (v) => v.toFixed(2) },
    { title: 'Comprobantes', dataIndex: 'comprobantes', align: 'right', sorter: (a, b) => a.comprobantes - b.comprobantes },
    { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', sorter: (a, b) => a.subtotal - b.subtotal, render: (v) => formatMoneda(v) },
    { title: 'IGV', dataIndex: 'igv', align: 'right', sorter: (a, b) => a.igv - b.igv, render: (v) => formatMoneda(v) },
    {
      title: 'Total', dataIndex: 'total', align: 'right', defaultSortOrder: 'descend',
      sorter: (a, b) => a.total - b.total, render: (v) => <strong>{formatMoneda(v)}</strong>,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>{titulo}</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="bottom">
          <Col span={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Col>
          <Col span={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={(v) => v && setHasta(v)} style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Col>
          {mostrarFiltroPuntoVenta && (
            <Col span={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Punto de venta</Typography.Text>
              <Select
                allowClear placeholder="Todos" style={{ width: '100%' }}
                value={idPuntoVenta} onChange={setIdPuntoVenta}
                options={(puntosVentaData?.data || []).map((p) => ({ value: p.id, label: p.nombre }))}
              />
            </Col>
          )}
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
              <Col span={6}><Card><Statistic title="Unidades vendidas" value={totales.unidades} precision={0} /></Card></Col>
              <Col span={6}><Card><Statistic title="Comprobantes" value={totales.comprobantes} /></Card></Col>
              <Col span={6}><Card><Statistic title="Total vendido" value={totales.total} prefix="S/" precision={2} valueStyle={{ color: '#1677ff' }} /></Card></Col>
              <Col span={6}>
                <Card>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{etiquetaTop}</Typography.Text>
                  <Typography.Text strong ellipsis={{ tooltip: grupoTop?.nombre }} style={{ display: 'block' }}>
                    {grupoTop?.nombre || '-'}
                  </Typography.Text>
                </Card>
              </Col>
            </Row>
          )}

          <Card
            style={{ marginBottom: 16 }}
            title={<><BarChartOutlined style={{ marginRight: 8 }} />Top {TOP_N_GRAFICO} — {columnaEtiqueta}</>}
            extra={
              <Radio.Group value={metrica} onChange={(e) => setMetrica(e.target.value)} optionType="button" size="small">
                <Radio.Button value="total">Soles</Radio.Button>
                <Radio.Button value="unidades">Unidades</Radio.Button>
              </Radio.Group>
            }
          >
            {datosGrafico.length ? (
              <Bar
                data={datosGrafico}
                xField="valor"
                yField="nombre"
                height={Math.max(280, datosGrafico.length * 32)}
                color={COLOR_BARRA}
                axis={{ x: { title: false }, y: { title: metrica === 'total' ? 'Soles (S/)' : 'Unidades' } }}
                label={{ text: (d: { valor: number }) => (metrica === 'total' ? formatMoneda(d.valor) : d.valor.toFixed(0)), position: 'right' }}
                tooltip={{ items: [{ field: 'valor', valueFormatter: (v: number) => (metrica === 'total' ? formatMoneda(v) : `${v.toFixed(2)} unid.`) }] }}
              />
            ) : (
              <Empty description="Sin ventas en el período" />
            )}
          </Card>

          <Table<GrupoVentaAgrupada>
            rowKey="clave" columns={columns} dataSource={grupos} loading={isFetching}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'Sin ventas en el período' }}
          />
        </>
      )}
    </div>
  );
}
