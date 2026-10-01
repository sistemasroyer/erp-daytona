import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCatalogosApi } from '@/api/letras';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useConfirmar } from '@/components/ConfirmModal';
import { DIAS_SEMANA, type Banco, type DiaNoPago, type MonedaLetras } from '@/types/letras';

/** Configuración del módulo Letras: bancos, días de no pago y monto máximo de letras por día de la semana. */
export function ConfiguracionLetrasPage() {
  return (
    <div>
      <Typography.Title level={4}>Configuración de Letras</Typography.Title>
      <Tabs
        items={[
          { key: 'limites', label: 'Límite de pago por día', children: <LimitesTab /> },
          { key: 'dias', label: 'Días de no pago', children: <DiasNoPagoTab /> },
          { key: 'bancos', label: 'Bancos', children: <BancosTab /> },
        ]}
      />
    </div>
  );
}

// ─── Límites por día ─────────────────────────────────────────────────────────
function LimitesTab() {
  const { message } = App.useApp();
  const { hasPermiso } = useAuth();
  const puedeEditar = hasPermiso('letras:editar');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['letras-limites'], queryFn: () => letrasCatalogosApi.listarLimites() });
  const [moneda, setMoneda] = useState<MonedaLetras>('PEN');
  const [montos, setMontos] = useState<Record<number, number | null>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const m: Record<number, number | null> = {};
    for (let d = 1; d <= 7; d++) {
      const lim = data?.data.find((l) => l.moneda === moneda && l.dia_semana === d);
      m[d] = lim ? Number(lim.monto_maximo) : null;
    }
    setMontos(m);
  }, [data, moneda]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await letrasCatalogosApi.guardarLimites(moneda, Object.entries(montos).map(([d, v]) => ({ dia_semana: Number(d), monto_maximo: v ?? null })));
      message.success('Límites guardados');
      queryClient.invalidateQueries({ queryKey: ['letras-limites'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <Typography.Paragraph type="secondary">
        Monto máximo de letras que la empresa puede pagar cada día de la semana. Al generar letras, el sistema reparte las cuotas
        para no pasar estos montos (sumando lo ya programado de todos los proveedores). Si un día tiene límite en soles y en dólares,
        se usa el mayor tras convertir con el tipo de cambio. Sin límite configurado se usa S/ 5,000. El domingo nunca se programan pagos.
      </Typography.Paragraph>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Text>Moneda del límite:</Typography.Text>
        <Select value={moneda} onChange={setMoneda} style={{ width: 160 }} options={[{ value: 'PEN', label: 'Soles (S/)' }, { value: 'USD', label: 'Dólares (US$)' }]} />
      </Space>
      <Table
        size="small" pagination={false} loading={isLoading} rowKey="dia"
        dataSource={[1, 2, 3, 4, 5, 6, 7].map((dia) => ({ dia }))}
        columns={[
          { title: 'Día', render: (_, r) => <>{DIAS_SEMANA[r.dia]} {r.dia === 7 && <Tag>No hábil</Tag>}</> },
          {
            title: 'Monto máximo', width: 260, render: (_, r) => (
              <InputNumber
                value={montos[r.dia]} min={0} step={500} precision={2} style={{ width: '100%' }} disabled={!puedeEditar || r.dia === 7}
                placeholder="Sin límite propio" prefix={moneda === 'USD' ? 'US$' : 'S/'}
                onChange={(v) => setMontos((prev) => ({ ...prev, [r.dia]: v }))}
              />
            ),
          },
        ]}
      />
      {puedeEditar && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardar}>Guardar límites en {moneda === 'USD' ? 'dólares' : 'soles'}</Button>
        </div>
      )}
    </Card>
  );
}

// ─── Días de no pago ─────────────────────────────────────────────────────────
function DiasNoPagoTab() {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const { hasPermiso } = useAuth();
  const puedeEditar = hasPermiso('letras:editar');
  const queryClient = useQueryClient();
  const [anio, setAnio] = useState(dayjs().year());
  const { data, isLoading } = useQuery({ queryKey: ['letras-dias-no-pago', anio], queryFn: () => letrasCatalogosApi.listarDiasNoPago(anio) });
  const [editando, setEditando] = useState<DiaNoPago | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState<Dayjs | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'feriado' | 'especial'>('feriado');
  const [guardando, setGuardando] = useState(false);

  const abrir = (d: DiaNoPago | null) => {
    setEditando(d);
    setFecha(d ? dayjs(d.fecha) : null);
    setDescripcion(d?.descripcion ?? '');
    setTipo(d?.tipo ?? 'feriado');
    setAbierto(true);
  };

  const guardar = async () => {
    if (!fecha || !descripcion.trim()) { message.warning('Complete fecha y descripción'); return; }
    setGuardando(true);
    try {
      const dto = { fecha: fecha.format('YYYY-MM-DD'), descripcion: descripcion.trim(), tipo };
      if (editando) await letrasCatalogosApi.actualizarDiaNoPago(editando.id, dto);
      else await letrasCatalogosApi.crearDiaNoPago(dto);
      message.success('Día guardado');
      setAbierto(false);
      queryClient.invalidateQueries({ queryKey: ['letras-dias-no-pago'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (d: DiaNoPago) => {
    if (!(await confirmar(`¿Quitar ${dayjs(d.fecha).format('DD/MM/YYYY')} (${d.descripcion}) de los días de no pago?`))) return;
    try {
      await letrasCatalogosApi.eliminarDiaNoPago(d.id);
      queryClient.invalidateQueries({ queryKey: ['letras-dias-no-pago'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  const columnas: ColumnsType<DiaNoPago> = [
    { title: 'Fecha', render: (_, d) => dayjs(d.fecha).format('DD/MM/YYYY') },
    { title: 'Día', render: (_, d) => DIAS_SEMANA[dayjs(d.fecha).day() === 0 ? 7 : dayjs(d.fecha).day()] },
    { title: 'Descripción', dataIndex: 'descripcion' },
    { title: 'Tipo', render: (_, d) => <Tag color={d.tipo === 'feriado' ? 'blue' : 'purple'}>{d.tipo === 'feriado' ? 'Feriado' : 'Especial'}</Tag> },
    ...(puedeEditar ? [{
      title: '', width: 90, render: (_: unknown, d: DiaNoPago) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrir(d)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(d)} />
        </Space>
      ),
    }] : []),
  ];

  return (
    <Card>
      <Typography.Paragraph type="secondary">Fechas en que no se programan pagos de letras (feriados o días especiales).</Typography.Paragraph>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Text>Año:</Typography.Text>
        <InputNumber value={anio} onChange={(v) => v && setAnio(v)} min={2020} max={2100} />
        {puedeEditar && <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Agregar día</Button>}
      </Space>
      <Table size="small" rowKey="id" loading={isLoading} dataSource={data?.data || []} columns={columnas} pagination={false} />
      <Modal title={editando ? 'Editar día de no pago' : 'Nuevo día de no pago'} open={abierto} onCancel={() => setAbierto(false)} onOk={guardar} confirmLoading={guardando} okText="Guardar" destroyOnHidden>
        <Form layout="vertical">
          <Form.Item label="Fecha" required><DatePicker value={fecha} onChange={setFecha} format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Descripción" required><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Fiestas Patrias" /></Form.Item>
          <Form.Item label="Tipo">
            <Select value={tipo} onChange={setTipo} options={[{ value: 'feriado', label: 'Feriado' }, { value: 'especial', label: 'Especial' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

// ─── Bancos ──────────────────────────────────────────────────────────────────
function BancosTab() {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const { hasPermiso } = useAuth();
  const puedeEditar = hasPermiso('letras:editar');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['letras-bancos'], queryFn: () => letrasCatalogosApi.listarBancos() });
  const [editando, setEditando] = useState<Banco | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', siglas: '', descripcion: '', estado: true });
  const [guardando, setGuardando] = useState(false);

  const abrir = (b: Banco | null) => {
    setEditando(b);
    setForm({ nombre: b?.nombre ?? '', siglas: b?.siglas ?? '', descripcion: b?.descripcion ?? '', estado: b?.estado ?? true });
    setAbierto(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { message.warning('Ingrese el nombre del banco'); return; }
    setGuardando(true);
    try {
      const dto = { nombre: form.nombre.trim(), siglas: form.siglas.trim() || undefined, descripcion: form.descripcion.trim() || undefined, estado: form.estado };
      if (editando) await letrasCatalogosApi.actualizarBanco(editando.id, dto);
      else await letrasCatalogosApi.crearBanco(dto);
      message.success('Banco guardado');
      setAbierto(false);
      queryClient.invalidateQueries({ queryKey: ['letras-bancos'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (b: Banco) => {
    if (!(await confirmar(`¿Eliminar el banco ${b.nombre}?`))) return;
    try {
      await letrasCatalogosApi.eliminarBanco(b.id);
      queryClient.invalidateQueries({ queryKey: ['letras-bancos'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  return (
    <Card>
      <Typography.Paragraph type="secondary">Bancos donde se registran las letras de cada paquete.</Typography.Paragraph>
      {puedeEditar && <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)} style={{ marginBottom: 12 }}>Nuevo banco</Button>}
      <Table
        size="small" rowKey="id" loading={isLoading} dataSource={data?.data || []} pagination={false}
        columns={[
          { title: 'Banco', dataIndex: 'nombre' },
          { title: 'Siglas', dataIndex: 'siglas', render: (v) => v || '-' },
          { title: 'Descripción', dataIndex: 'descripcion', render: (v) => v || '-' },
          { title: 'Estado', render: (_, b) => <Tag color={b.estado ? 'success' : 'default'}>{b.estado ? 'Activo' : 'Inactivo'}</Tag> },
          ...(puedeEditar ? [{
            title: '', width: 90, render: (_: unknown, b: Banco) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => abrir(b)} />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(b)} />
              </Space>
            ),
          }] : []),
        ]}
      />
      <Modal title={editando ? 'Editar banco' : 'Nuevo banco'} open={abierto} onCancel={() => setAbierto(false)} onOk={guardar} confirmLoading={guardando} okText="Guardar" destroyOnHidden>
        <Form layout="vertical">
          <Form.Item label="Nombre" required><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Banco de Crédito del Perú" /></Form.Item>
          <Form.Item label="Siglas"><Input value={form.siglas} onChange={(e) => setForm({ ...form, siglas: e.target.value })} placeholder="Ej: BCP" /></Form.Item>
          <Form.Item label="Descripción"><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Form.Item>
          <Form.Item label="Activo"><Switch checked={form.estado} onChange={(v) => setForm({ ...form, estado: v })} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

