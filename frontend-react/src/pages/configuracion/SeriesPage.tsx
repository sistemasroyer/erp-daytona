import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Typography, Select, Switch, Modal, Form, Input, InputNumber, Tag, Alert, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { seriesDocumentoApi } from '@/api/series-documento';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import { CODIGOS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO_LABEL, type SerieDocumento } from '@/types/serie-documento';

export function SeriesPage() {
  const [puntoVentaFiltro, setPuntoVentaFiltro] = useState<string | undefined>(undefined);
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaPv, setNuevaPv] = useState<string | undefined>(undefined);
  const [nuevoTipo, setNuevoTipo] = useState<string>('01');
  const [nuevaSerie, setNuevaSerie] = useState('');
  const [modalCorr, setModalCorr] = useState<SerieDocumento | null>(null);
  const [nuevoCorrelativo, setNuevoCorrelativo] = useState(0);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();

  const { data: puntosVentaData } = useQuery({ queryKey: ['puntos-venta'], queryFn: () => seriesDocumentoApi.puntosVenta() });
  const { data, isFetching } = useQuery({
    queryKey: ['series-documento', puntoVentaFiltro],
    queryFn: () => seriesDocumentoApi.listar(puntoVentaFiltro),
  });
  const puntosVenta = puntosVentaData?.data || [];

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['series-documento'] });

  const toggleActivo = async (serie: SerieDocumento, activo: boolean) => {
    try {
      await seriesDocumentoApi.actualizar(serie.id, { activo });
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error');
    }
  };

  const crearSerie = async () => {
    if (!nuevaPv || !nuevaSerie.trim()) { message.warning('Todos los campos son requeridos'); return; }
    setSaving(true);
    try {
      await seriesDocumentoApi.crear({ id_punto_venta: nuevaPv, tipo_documento: nuevoTipo as never, serie: nuevaSerie.trim().toUpperCase() });
      setModalNueva(false);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al crear serie');
    } finally {
      setSaving(false);
    }
  };

  const guardarCorrelativo = async () => {
    if (!modalCorr) return;
    setSaving(true);
    try {
      await seriesDocumentoApi.resetCorrelativo(modalCorr.id, nuevoCorrelativo);
      setModalCorr(null);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (s: SerieDocumento) => {
    const ok = await confirmar('¿Eliminar esta serie?', 'Eliminar Serie');
    if (!ok) return;
    try {
      await seriesDocumentoApi.eliminar(s.id);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  const columns: ColumnsType<SerieDocumento> = [
    { title: 'Punto de Venta', render: (_, s) => s.punto_venta?.nombre || '—' },
    { title: 'Tipo de Documento', render: (_, s) => <><Tag>{s.tipo_documento}</Tag> {TIPOS_DOCUMENTO_LABEL[s.tipo_documento]}</> },
    { title: 'Serie', dataIndex: 'serie', render: (v) => <strong>{v}</strong> },
    { title: 'Correlativo Actual', align: 'right', render: (_, s) => <Tag color="blue">{String(s.correlativo_actual).padStart(8, '0')}</Tag> },
    { title: 'Estado', render: (_, s) => <Switch checked={s.activo} onChange={(v) => toggleActivo(s, v)} /> },
    {
      title: '', align: 'right',
      render: (_, s) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setModalCorr(s); setNuevoCorrelativo(s.correlativo_actual); }}>Correlativo</Button>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={s.correlativo_actual > 0} title={s.correlativo_actual > 0 ? 'Tiene documentos emitidos' : ''} onClick={() => eliminar(s)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Series y Correlativos</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setNuevaPv(undefined); setNuevoTipo('01'); setNuevaSerie(''); setModalNueva(true); }}>
          Nueva Serie
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={<>Las series definen el prefijo y correlativo para cada tipo de documento por punto de venta. Ejemplo: <code>F001</code> para Factura, <code>B001</code> para Boleta.</>}
      />

      <Select
        allowClear
        placeholder="Todos los puntos de venta"
        style={{ width: 300, marginBottom: 16 }}
        value={puntoVentaFiltro}
        onChange={setPuntoVentaFiltro}
        options={puntosVenta.map((pv) => ({ value: pv.id, label: pv.nombre }))}
      />

      <Table<SerieDocumento> rowKey="id" columns={columns} dataSource={data?.data} loading={isFetching} pagination={false} scroll={{ x: 'max-content' }} />

      <Modal title="Nueva Serie de Documento" open={modalNueva} onCancel={() => setModalNueva(false)} onOk={crearSerie} confirmLoading={saving} okText="Crear Serie" cancelText="Cancelar">
        <Form layout="vertical">
          <Form.Item label="Punto de Venta" required>
            <Select value={nuevaPv} onChange={setNuevaPv} placeholder="Seleccionar..." options={puntosVenta.map((pv) => ({ value: pv.id, label: pv.nombre }))} />
          </Form.Item>
          <Form.Item label="Tipo de Documento" required help="Nota de Venta y Cotización son documentos internos (no se envían a SUNAT).">
            <Select value={nuevoTipo} onChange={setNuevoTipo} options={CODIGOS_TIPO_DOCUMENTO} />
          </Form.Item>
          <Form.Item label="Serie" required help="Máximo 4 caracteres. Factura empieza con F, Boleta con B.">
            <Input value={nuevaSerie} onChange={(e) => setNuevaSerie(e.target.value.toUpperCase())} maxLength={4} placeholder="Ej: F001, B001, FF01..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Ajustar Correlativo" open={!!modalCorr} onCancel={() => setModalCorr(null)} onOk={guardarCorrelativo} confirmLoading={saving} okText="Actualizar" cancelText="Cancelar">
        <Typography.Paragraph type="secondary">Solo se puede avanzar el correlativo, no retroceder.</Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label={<>Serie: <strong>{modalCorr?.serie}</strong></>}>
            <InputNumber value={nuevoCorrelativo} onChange={(v) => setNuevoCorrelativo(v || 0)} min={modalCorr?.correlativo_actual || 0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
