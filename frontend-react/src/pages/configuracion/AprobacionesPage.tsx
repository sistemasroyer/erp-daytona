import { App, Button, Card, Form, Input, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aprobacionesApi } from '@/api/aprobaciones';
import type { AutorizacionRegistro } from '@/api/aprobaciones';
import { ApiError } from '@/api/types';

const FECHA = (valor: string) => new Date(valor).toLocaleString('es-PE');
const RECURSOS = { ventas: 'Venta / cotización', compras: 'Compra', gastos: 'Gasto', ordenes_compra: 'Orden de compra', toma_inventario: 'Toma de inventario' };

export function AprobacionesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const estado = useQuery({ queryKey: ['mi-pin'], queryFn: aprobacionesApi.estadoPin });
  const historial = useQuery({ queryKey: ['aprobaciones-historial'], queryFn: aprobacionesApi.historial });
  const guardar = async (desactivar = false) => {
    let valores;
    try { valores = await form.validateFields(desactivar ? ['password'] : undefined); } catch { return; }
    setSaving(true);
    try {
      if (desactivar) await aprobacionesApi.desactivarPin(valores.password);
      else await aprobacionesApi.configurarPin({ password: valores.password, pin: valores.pin });
      message.success(desactivar ? 'PIN desactivado' : 'PIN guardado');
      form.resetFields();
      await Promise.all([estado.refetch(), historial.refetch()]);
    } catch (error) { message.error(error instanceof ApiError ? error.message : 'No se pudo guardar el PIN'); }
    finally { setSaving(false); }
  };
  return <>
    <Card title="Mi PIN de aprobación" style={{ maxWidth: 500, marginBottom: 16 }}>
      {estado.isError ? <Typography.Text type="danger">No se pudo consultar el PIN. Verifique su permiso Seguridad → Aprobar.</Typography.Text> : <Tag color={estado.data?.data.activo ? 'green' : 'default'}>{estado.data?.data.activo ? 'Activo' : 'Sin PIN activo'}</Tag>}
      <Form form={form} layout="vertical" autoComplete="off" disabled={saving} style={{ marginTop: 12 }}>
        <Form.Item name="password" label="Contraseña de mi cuenta" rules={[{ required: true, message: 'Ingrese su contraseña' }]}><Input.Password autoComplete="current-password" /></Form.Item>
        <Form.Item name="pin" label="Nuevo PIN (6 a 8 dígitos)" rules={[{ required: true, pattern: /^\d{6,8}$/, message: 'Ingrese de 6 a 8 dígitos' }]}><Input.Password maxLength={8} inputMode="numeric" autoComplete="new-password" /></Form.Item>
        <Form.Item name="confirmar" label="Confirmar PIN" dependencies={['pin']} rules={[{ required: true, message: 'Confirme el PIN' }, ({ getFieldValue }) => ({ validator: (_, v) => v === getFieldValue('pin') ? Promise.resolve() : Promise.reject(new Error('Los PIN no coinciden')) })]}><Input.Password maxLength={8} inputMode="numeric" autoComplete="new-password" /></Form.Item>
        <Space><Button type="primary" loading={saving} onClick={() => guardar()}>Guardar PIN</Button><Button danger disabled={!estado.data?.data.activo || saving} onClick={() => guardar(true)}>Desactivar</Button></Space>
      </Form>
    </Card>
    <Card title="Últimas 100 autorizaciones" extra={<Button onClick={() => historial.refetch()}>Actualizar</Button>}>
      {historial.isError && <Typography.Text type="danger">No se pudo cargar el historial.</Typography.Text>}
      <Table<AutorizacionRegistro> rowKey="id" loading={historial.isFetching} dataSource={historial.data?.data ?? []} scroll={{ x: 'max-content' }} columns={[
        { title: 'Fecha', dataIndex: 'fecha_creacion', render: FECHA },
        { title: 'Documento', render: (_, a) => <><div>{RECURSOS[a.recurso]}</div><Typography.Text type="secondary">{a.numero_documento}</Typography.Text></> },
        { title: 'Solicitante', render: (_, a) => `${a.solicitante.nombre} ${a.solicitante.apellido}` },
        { title: 'Supervisor', render: (_, a) => `${a.aprobador.nombre} ${a.aprobador.apellido}` },
        { title: 'Motivo', dataIndex: 'motivo' },
        { title: 'Estado', render: (_, a) => a.usada_en ? <Tag color="green">Utilizada</Tag> : <Tag>{new Date(a.vence_en) <= new Date() ? 'Vencida' : 'Pendiente'}</Tag> },
      ]} />
    </Card>
  </>;
}
