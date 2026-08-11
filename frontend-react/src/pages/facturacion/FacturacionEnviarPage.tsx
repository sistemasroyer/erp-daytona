import { useState } from 'react';
import { App, Card, Table, Button, Select, DatePicker, Typography, Space, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SendOutlined, FilterOutlined, SmileOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { ventasApi } from '@/api/ventas';
import { ApiError } from '@/api/types';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { Venta } from '@/types/venta';

export function FacturacionEnviarPage() {
  const { message } = App.useApp();
  const [tipoDoc, setTipoDoc] = useState<'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'>('BOLETA');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [cargando, setCargando] = useState(false);
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [enviandoIds, setEnviandoIds] = useState<Set<string>>(new Set());
  const [enviandoTodos, setEnviandoTodos] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await ventasApi.listar({ tipo_documento: tipoDoc, fecha_desde: desde.format('YYYY-MM-DD'), limit: 100 });
      let filtradas = data;
      filtradas = estadoFiltro ? filtradas.filter((v) => v.estado_sunat === estadoFiltro) : filtradas.filter((v) => v.estado_sunat !== 'aceptado');
      filtradas = filtradas.filter((v) => v.estado_venta !== 'anulada');
      setVentas(filtradas);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cargar datos');
    } finally {
      setCargando(false);
    }
  };

  const enviar = async (id: string) => {
    setEnviandoIds((prev) => new Set(prev).add(id));
    try {
      const { data: v } = await ventasApi.reenviarSunat(id);
      const envio = v.sunat_envios?.[0];
      setVentas((prev) => (prev ? prev.map((it) => (it.id === id ? v : it)) : prev));
      if (v.estado_sunat === 'aceptado') {
        message.success(`${v.numero_comprobante} fue aceptado por SUNAT`);
      } else {
        message.error(`${v.numero_comprobante} no fue aceptado: ${envio?.error_mensaje || 'ver detalle'}`);
      }
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al enviar a SUNAT');
    } finally {
      setEnviandoIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const enviarTodos = async () => {
    const pendientes = (ventas || []).filter((v) => v.estado_sunat !== 'aceptado');
    if (pendientes.length === 0) { message.warning('No hay documentos pendientes'); return; }
    setEnviandoTodos(true);
    for (const v of pendientes) {
      await enviar(v.id);
    }
    setEnviandoTodos(false);
  };

  const columns: ColumnsType<Venta> = [
    { title: 'Comprobante', render: (_, v) => v.numero_comprobante || `${v.serie}-${String(v.correlativo).padStart(8, '0')}` },
    { title: 'Fecha', render: (_, v) => dayjs(v.fecha_emision).format('DD/MM/YYYY') },
    { title: 'Cliente', render: (_, v) => v.cliente?.razon_social || '-' },
    { title: 'Total', align: 'right', render: (_, v) => formatMoneda(v.total, v.moneda) },
    { title: 'Estado SUNAT', align: 'center', render: (_, v) => <EstadoTag estado={v.estado_sunat} /> },
    { title: 'Detalle', render: (_, v) => <Typography.Text type="danger" style={{ fontSize: 12 }}>{v.estado_sunat === 'aceptado' ? '' : v.sunat_envios?.[0]?.error_mensaje || ''}</Typography.Text> },
    {
      title: 'Acciones', align: 'center', width: 140,
      render: (_, v) => v.estado_sunat === 'aceptado'
        ? <Typography.Text type="success" style={{ fontSize: 12 }}><SmileOutlined /> Aceptado</Typography.Text>
        : <Button size="small" icon={<SendOutlined />} loading={enviandoIds.has(v.id)} onClick={() => enviar(v.id)}>{v.sunat_envios?.length ? 'Reintentar' : 'Enviar'}</Button>,
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Enviar Documentos a SUNAT</Typography.Title>

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        title="Los comprobantes ya no se envían automáticamente a SUNAT al emitirse. Desde aquí puedes enviarlos (o reintentar los que fallaron) manualmente, uno por uno o todos los pendientes de una vez."
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Tipo de documento</Typography.Text>
            <Select value={tipoDoc} onChange={setTipoDoc} style={{ width: 160 }} options={[
              { value: 'BOLETA', label: 'Boleta' }, { value: 'FACTURA', label: 'Factura' }, { value: 'NOTA_CREDITO', label: 'Nota de Crédito' },
            ]} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Estado SUNAT</Typography.Text>
            <Select value={estadoFiltro} onChange={setEstadoFiltro} style={{ width: 200 }} options={[
              { value: '', label: 'Todos (excepto aceptados)' }, { value: 'pendiente', label: 'Pendiente' },
              { value: 'rechazado', label: 'Rechazado' }, { value: 'error', label: 'Error' }, { value: 'aceptado', label: 'Aceptado' },
            ]} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} format="DD/MM/YYYY" />
          </div>
          <Button type="primary" icon={<FilterOutlined />} loading={cargando} onClick={cargar} style={{ marginTop: 20 }}>Filtrar</Button>
        </Space>
      </Card>

      <Card
        size="small"
        title={<Typography.Text type="secondary" style={{ fontWeight: 400 }}>{ventas ? `${ventas.length} documentos` : '-'}</Typography.Text>}
        extra={<Button icon={<SendOutlined />} loading={enviandoTodos} onClick={enviarTodos}>Enviar todos los pendientes</Button>}
      >
        <Table<Venta>
          size="small" rowKey="id" columns={columns} dataSource={ventas || []} loading={cargando}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: ventas === null ? 'Use el filtro para cargar documentos' : 'Sin documentos pendientes 🎉' }}
        />
      </Card>
    </div>
  );
}
