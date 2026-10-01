import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileExcelOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { letrasReportesApi } from '@/api/letras';
import { formatMoneda } from '@/utils/format';
import type { FilaDeudaProveedor, MonedaLetras } from '@/types/letras';

const ROJO = '#cf1322';

/** Cuánto se le debe a cada proveedor: compras a crédito aún sin paquete, paquetes en trámite y letras. */
export function DeudaProveedoresPage() {
  const { message } = App.useApp();
  const [moneda, setMoneda] = useState<MonedaLetras | undefined>();
  const [search, setSearch] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);
  const filtros = { moneda, search: busqueda || undefined };

  const { data, isFetching } = useQuery({ queryKey: ['letras-deuda', filtros], queryFn: () => letrasReportesApi.deuda(filtros) });
  const deuda = data?.data;

  const exportar = async () => {
    setExportando(true);
    try {
      await letrasReportesApi.deudaExcel(filtros);
    } catch {
      message.error('No se pudo generar el Excel');
    } finally {
      setExportando(false);
    }
  };

  const monto = (v: number, m: MonedaLetras, color?: string) => (v ? <span style={{ color }}>{formatMoneda(v, m)}</span> : <Typography.Text type="secondary">-</Typography.Text>);
  const columnas: ColumnsType<FilaDeudaProveedor> = [
    {
      title: 'Proveedor', render: (_, r) => (
        <><div>{r.proveedor.razon_social}</div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.proveedor.ruc}</Typography.Text></>
      ),
    },
    { title: 'Moneda', dataIndex: 'moneda', align: 'center', width: 80 },
    {
      title: <Tooltip title="Facturas a crédito registradas en Compras que todavía no se pusieron en un paquete de letras">Compras sin paquete</Tooltip>,
      align: 'right', render: (_, r) => (
        <>{monto(r.sin_paquete.monto, r.moneda)}{r.sin_paquete.vencido > 0 && <div style={{ fontSize: 12, color: ROJO }}>vencido {formatMoneda(r.sin_paquete.vencido, r.moneda)}</div>}</>
      ),
    },
    { title: <Tooltip title="Paquetes en borrador, por aprobar o aprobados, sin letras todavía">En trámite</Tooltip>, align: 'right', render: (_, r) => monto(r.en_tramite.monto, r.moneda) },
    { title: 'Letras por vencer', align: 'right', render: (_, r) => monto(r.por_vencer.monto, r.moneda) },
    { title: 'Letras vencidas', align: 'right', render: (_, r) => monto(r.vencidas.monto, r.moneda, ROJO) },
    { title: 'Deuda total', align: 'right', render: (_, r) => <strong>{formatMoneda(r.total, r.moneda)}</strong> },
    { title: 'Próxima letra', render: (_, r) => (r.proxima_fecha ? dayjs(r.proxima_fecha).format('ddd DD/MM/YYYY') : '-') },
    {
      title: '', width: 60, render: (_, r) => (
        <Tooltip title="Estado de cuenta (imprimible)">
          <Button size="small" icon={<PrinterOutlined />} aria-label="Estado de cuenta" onClick={() => window.open(`/letras/imprimir/estado-cuenta/${r.proveedor.id}`, '_blank')} />
        </Tooltip>
      ),
    },
  ];

  const tarjetas = (m: MonedaLetras) => {
    const t = deuda?.totales[m];
    if (!t || (!t.total && m === 'USD')) return null;
    return (
      <Col xs={24} lg={12} key={m}>
        <Card size="small" title={m === 'PEN' ? 'Soles' : 'Dólares'}>
          <Row gutter={12}>
            <Col span={6}><Statistic title="Deuda total" value={formatMoneda(t.total, m)} styles={{ content: { fontSize: 18 } }} /></Col>
            <Col span={6}><Statistic title="Letras vencidas" value={formatMoneda(t.vencidas, m)} styles={{ content: { fontSize: 18, color: t.vencidas ? ROJO : undefined } }} /></Col>
            <Col span={6}><Statistic title="Letras por vencer" value={formatMoneda(t.por_vencer, m)} styles={{ content: { fontSize: 18 } }} /></Col>
            <Col span={6}><Statistic title="Sin letras aún" value={formatMoneda(t.sin_paquete + t.en_tramite, m)} styles={{ content: { fontSize: 18 } }} /></Col>
          </Row>
        </Card>
      </Col>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Deuda con Proveedores</Typography.Title>
        <Button icon={<FileExcelOutlined />} loading={exportando} onClick={exportar}>Exportar Excel</Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>{(['PEN', 'USD'] as const).map(tarjetas)}</Row>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search placeholder="Proveedor o RUC" allowClear style={{ width: 280 }} enterButton={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)} onSearch={(v) => setBusqueda(v.trim())} />
          <Select allowClear placeholder="Moneda" style={{ width: 130 }} value={moneda} onChange={setMoneda}
            options={[{ value: 'PEN', label: 'Soles' }, { value: 'USD', label: 'Dólares' }]} />
        </Space>
        <Table
          size="small" rowKey={(r) => `${r.proveedor.id}-${r.moneda}`} columns={columnas} dataSource={deuda?.data ?? []} loading={isFetching}
          pagination={{ pageSize: 50, hideOnSinglePage: true }} scroll={{ x: 1000 }}
          rowClassName={(r) => (r.vencidas.monto > 0 ? 'fila-vencida' : '')}
        />
      </Card>
    </div>
  );
}
