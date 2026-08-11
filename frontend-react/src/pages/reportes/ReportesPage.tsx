import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Tabs, Card, DatePicker, Button, Table, Row, Col, Statistic, Input, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlayCircleOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { reportesApi } from '@/api/reportes';
import { ApiError } from '@/api/types';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { VentaReporte, CompraReporte, ItemReporteInventario, ItemReporteTomaInventario, RegistroAuditoria } from '@/types/reportes';

export function ReportesPage() {
  const { message } = App.useApp();
  const [tab, setTab] = useState('ventas');
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [tablaAuditoria, setTablaAuditoria] = useState('');
  const [searchProducto, setSearchProducto] = useState('');
  const [tipoDiferencia, setTipoDiferencia] = useState<string | undefined>(undefined);
  const [filtros, setFiltros] = useState<{ fecha_desde: string; fecha_hasta: string; tabla?: string; search?: string; tipo_diferencia?: string } | null>(null);

  const filtrosBase = () => ({ fecha_desde: desde.format('YYYY-MM-DD'), fecha_hasta: hasta.format('YYYY-MM-DD') });

  const qVentas = useQuery({
    queryKey: ['reporte-ventas', filtros],
    queryFn: () => reportesApi.ventas(filtros!),
    enabled: !!filtros && tab === 'ventas',
  });
  const qCompras = useQuery({
    queryKey: ['reporte-compras', filtros],
    queryFn: () => reportesApi.compras(filtros!),
    enabled: !!filtros && tab === 'compras',
  });
  const qInventario = useQuery({
    queryKey: ['reporte-inventario', filtros],
    queryFn: () => reportesApi.inventario(filtros!),
    enabled: !!filtros && tab === 'inventario',
  });
  const qAuditoria = useQuery({
    queryKey: ['reporte-auditoria', filtros],
    queryFn: () => reportesApi.auditoria(filtros!),
    enabled: !!filtros && tab === 'auditoria',
  });
  const qTomasInventario = useQuery({
    queryKey: ['reporte-tomas-inventario', filtros],
    queryFn: () => reportesApi.tomasInventario(filtros!),
    enabled: !!filtros && tab === 'tomas-inventario',
  });

  const generar = () => setFiltros({
    ...filtrosBase(),
    tabla: tablaAuditoria || undefined,
    search: searchProducto || undefined,
    tipo_diferencia: tipoDiferencia,
  });

  const exportarExcel = async () => {
    try {
      if (tab === 'ventas') await reportesApi.exportarVentasExcel(filtrosBase());
      else if (tab === 'inventario') await reportesApi.exportarInventarioExcel(filtrosBase());
      message.info('Descargando Excel...');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al exportar');
    }
  };

  const columnsVentas: ColumnsType<VentaReporte> = [
    { title: 'Comprobante', render: (_, v) => v.numero_comprobante || `${v.serie}-${v.correlativo}` },
    { title: 'Fecha', dataIndex: 'fecha_emision', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Cliente', render: (_, v) => v.cliente?.razon_social || '-' },
    { title: 'Subtotal', align: 'right', render: (_, v) => formatMoneda(v.subtotal, v.moneda) },
    { title: 'IGV', align: 'right', render: (_, v) => formatMoneda(v.igv, v.moneda) },
    { title: 'Total', align: 'right', render: (_, v) => <strong>{formatMoneda(v.total, v.moneda)}</strong> },
    { title: 'SUNAT', align: 'center', render: (_, v) => <EstadoTag estado={v.estado_sunat} /> },
  ];

  const columnsCompras: ColumnsType<CompraReporte> = [
    { title: 'Documento', render: (_, c) => c.serie ? `${c.serie}-${c.numero}` : c.numero },
    { title: 'Fecha', dataIndex: 'fecha_emision', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Proveedor', render: (_, c) => c.proveedor?.razon_social || '-' },
    { title: 'Subtotal', align: 'right', render: (_, c) => formatMoneda(c.subtotal, c.moneda) },
    { title: 'IGV', align: 'right', render: (_, c) => formatMoneda(c.igv, c.moneda) },
    { title: 'Total', align: 'right', render: (_, c) => <strong>{formatMoneda(c.total, c.moneda)}</strong> },
  ];

  const inventarioItems = qInventario.data?.data || [];
  const valorTotalInventario = inventarioItems.reduce((s, i) => s + Number(i.stock_actual) * Number(i.producto?.costo_promedio || 0), 0);
  const columnsInventario: ColumnsType<ItemReporteInventario> = [
    { title: 'Código', render: (_, i) => i.producto?.codigo || '-' },
    { title: 'Producto', render: (_, i) => i.producto?.nombre || '-' },
    { title: 'Categoría', render: (_, i) => i.producto?.categoria?.nombre || '-' },
    { title: 'Almacén', render: (_, i) => i.almacen?.nombre || '-' },
    { title: 'Stock', align: 'right', render: (_, i) => Number(i.stock_actual).toFixed(4) },
    { title: 'Costo', align: 'right', render: (_, i) => formatMoneda(i.producto?.costo_promedio) },
    { title: 'Valor Stock', align: 'right', render: (_, i) => <strong>{formatMoneda(Number(i.stock_actual) * Number(i.producto?.costo_promedio || 0))}</strong> },
  ];

  const tomasInventario = qTomasInventario.data?.data;
  const columnsTomasInventario: ColumnsType<ItemReporteTomaInventario> = [
    { title: 'Toma', render: (_, d) => <>{d.toma.numero_interno} <EstadoTag estado={d.toma.estado} /></> },
    { title: 'Fecha conteo', render: (_, d) => dayjs(d.fecha_conteo).format('DD/MM/YYYY HH:mm') },
    { title: 'Código', render: (_, d) => d.producto.codigo },
    { title: 'Producto', render: (_, d) => d.producto.nombre },
    { title: 'Ubicación', render: (_, d) => d.producto.ubicacion || '-' },
    { title: 'Stock sistema', align: 'right', render: (_, d) => Number(d.stock_sistema).toFixed(2) },
    { title: 'Cant. contada', align: 'right', render: (_, d) => Number(d.cantidad_contada).toFixed(2) },
    {
      title: 'Diferencia', align: 'right',
      render: (_, d) => {
        const dif = Number(d.diferencia);
        return <Typography.Text strong type={dif === 0 ? undefined : dif > 0 ? 'success' : 'danger'}>{dif > 0 ? '+' : ''}{dif.toFixed(2)}</Typography.Text>;
      },
    },
    { title: 'Responsable', render: (_, d) => d.toma.usuario ? `${d.toma.usuario.nombre} ${d.toma.usuario.apellido}` : '-' },
    { title: 'Observaciones', render: (_, d) => d.observaciones || '-' },
  ];

  const columnsAuditoria: ColumnsType<RegistroAuditoria> = [
    { title: 'Fecha/Hora', dataIndex: 'fecha', render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    { title: 'Usuario', render: (_, a) => a.usuario ? `${a.usuario.nombre} ${a.usuario.apellido}` : '-' },
    { title: 'Tabla', render: (_, a) => <code>{a.tabla}</code> },
    { title: 'Operación', render: (_, a) => <EstadoTag estado={a.operacion} colores={{ INSERT: 'success', DELETE: 'error', UPDATE: 'warning' }} /> },
    { title: 'Detalles', render: (_, a) => <Typography.Text type="secondary">{a.id_registro || '-'}</Typography.Text> },
  ];

  return (
    <div>
      <Typography.Title level={4}>Centro de Reportes</Typography.Title>

      <Tabs activeKey={tab} onChange={(k) => { setTab(k); setFiltros(null); }} items={[
        { key: 'ventas', label: 'Ventas' },
        { key: 'compras', label: 'Compras' },
        { key: 'inventario', label: 'Inventario' },
        { key: 'tomas-inventario', label: 'Tomas de Inventario' },
        { key: 'auditoria', label: 'Auditoría' },
      ]} />

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
          {tab === 'auditoria' && (
            <Col span={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Tabla</Typography.Text>
              <Input value={tablaAuditoria} onChange={(e) => setTablaAuditoria(e.target.value)} placeholder="Filtrar por tabla..." />
            </Col>
          )}
          {tab === 'tomas-inventario' && (
            <>
              <Col span={6}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Producto</Typography.Text>
                <Input value={searchProducto} onChange={(e) => setSearchProducto(e.target.value)} placeholder="Código o nombre..." />
              </Col>
              <Col span={6}>
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
            </>
          )}
          <Col>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={generar}>Generar</Button>
          </Col>
          {(tab === 'ventas' || tab === 'inventario') && (
            <Col>
              <Button icon={<FileExcelOutlined />} onClick={exportarExcel} style={{ color: '#237804', borderColor: '#237804' }}>Excel</Button>
            </Col>
          )}
        </Row>
      </Card>

      {tab === 'ventas' && (
        <>
          {qVentas.data?.data.totales && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card><Statistic title="Comprobantes" value={qVentas.data.data.totales.cantidad} /></Card></Col>
              <Col span={6}><Card><Statistic title="Subtotal" value={qVentas.data.data.totales.subtotal} prefix="S/" precision={2} /></Card></Col>
              <Col span={6}><Card><Statistic title="IGV" value={qVentas.data.data.totales.igv} prefix="S/" precision={2} /></Card></Col>
              <Col span={6}><Card><Statistic title="Total" value={qVentas.data.data.totales.total} prefix="S/" precision={2} valueStyle={{ color: '#1677ff' }} /></Card></Col>
            </Row>
          )}
          <Table<VentaReporte>
            rowKey="id" columns={columnsVentas} dataSource={qVentas.data?.data.ventas} loading={qVentas.isFetching}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: filtros ? 'Sin ventas en el período' : 'Seleccione un período y haga clic en Generar' }}
          />
        </>
      )}

      {tab === 'compras' && (
        <Table<CompraReporte>
          rowKey="id" columns={columnsCompras} dataSource={qCompras.data?.data.compras} loading={qCompras.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: filtros ? 'Sin compras en el período' : 'Seleccione un período y haga clic en Generar' }}
        />
      )}

      {tab === 'inventario' && (
        <Table<ItemReporteInventario>
          rowKey="id" columns={columnsInventario} dataSource={inventarioItems} loading={qInventario.isFetching}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: filtros ? 'Sin registros' : 'Haga clic en Generar' }}
          summary={() => inventarioItems.length > 0 ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={6} align="right"><strong>VALOR TOTAL INVENTARIO:</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><strong>{formatMoneda(valorTotalInventario)}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
      )}

      {tab === 'tomas-inventario' && (
        <>
          {tomasInventario && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card><Statistic title="Registros" value={tomasInventario.totales.cantidad} /></Card></Col>
              <Col span={6}><Card><Statistic title="Sobran" value={tomasInventario.totales.sobran} valueStyle={{ color: '#389e0d' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Faltan" value={tomasInventario.totales.faltan} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Sin diferencia" value={tomasInventario.totales.ok} /></Card></Col>
            </Row>
          )}
          <Table<ItemReporteTomaInventario>
            rowKey="id" columns={columnsTomasInventario} dataSource={tomasInventario?.detalle} loading={qTomasInventario.isFetching}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: filtros ? 'Sin registros para estos filtros' : 'Seleccione un período y haga clic en Generar' }}
          />
        </>
      )}

      {tab === 'auditoria' && (
        <Table<RegistroAuditoria>
          rowKey="id" columns={columnsAuditoria} dataSource={qAuditoria.data?.data} loading={qAuditoria.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: filtros ? 'Sin registros' : 'Seleccione un período y haga clic en Generar' }}
        />
      )}
    </div>
  );
}
