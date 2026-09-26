import { App, Button, Card, Descriptions, Space, Table, Tag, Tabs, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';

interface Dispositivo {
  id: string; id_usuario: string; ip: string; ultima_ip: string | null; navegador: string; sistema_operativo: string;
  user_agent: string; estado: 'pendiente' | 'aprobado' | 'bloqueado'; fecha_creacion: string; ultimo_uso: string | null;
  aprobado_en: string | null; usuario_modificacion: string | null; responsable?: string;
  usuario: { nombre: string; apellido: string; email: string };
  datos: { tipo?: string; zona_horaria?: string; idioma?: string; pantalla?: string; latitud?: number; longitud?: number; precision?: number } | null;
}
interface Acceso { id: string; fecha: string; email: string | null; ip: string; accion: string; resultado: string; detalle: string | null; user_agent: string | null; usuario: { nombre: string; apellido: string } | null }
const fecha = (s: string | null) => s ? new Date(s).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—';
const etiquetas: Record<string, string> = { exitoso: 'Exitoso', intento: 'Intento', no_encontrado: 'Usuario no encontrado', password_incorrecto: 'Contraseña incorrecta', pendiente: 'Pendiente', aprobado: 'Aprobado', bloqueado: 'Bloqueado', inicial_aprobado: 'Administrador inicial' };

export function DispositivosPage() {
  const { hasPermiso } = useAuth();
  const { modal, message } = App.useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const dispositivos = useQuery({ queryKey: ['dispositivos'], queryFn: () => api.get<Dispositivo[]>('/auth/dispositivos'), refetchInterval: 15000 });
  const accesos = useQuery({ queryKey: ['accesos'], queryFn: () => api.get<Acceso[]>('/auth/accesos'), refetchInterval: 30000 });
  const actualizar = () => Promise.all([dispositivos.refetch(), accesos.refetch()]);
  const decidir = (d: Dispositivo, accion: 'aprobar' | 'bloquear') => modal.confirm({
    title: accion === 'aprobar' ? 'Aprobar dispositivo' : 'Bloquear dispositivo',
    content: `${d.usuario.nombre} ${d.usuario.apellido} · ${d.navegador} / ${d.sistema_operativo} · ${d.ip}`,
    okText: accion === 'aprobar' ? 'Aprobar' : 'Bloquear', cancelText: 'Cancelar', okButtonProps: { danger: accion === 'bloquear' },
    onOk: async () => {
      setBusy(d.id);
      try { await api.patch(`/auth/dispositivos/${d.id}/${accion}`); message.success(accion === 'aprobar' ? 'Dispositivo aprobado' : 'Dispositivo bloqueado'); await actualizar(); }
      catch (e) { message.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'); throw e; }
      finally { setBusy(null); }
    },
  });
  const tabla = (items: Dispositivo[]) => <Table<Dispositivo> rowKey="id" dataSource={items} loading={dispositivos.isFetching} scroll={{ x: 'max-content' }} columns={[
    { title: 'Usuario', render: (_, d) => <><div>{d.usuario.nombre} {d.usuario.apellido}</div><Typography.Text type="secondary">{d.usuario.email}</Typography.Text></> },
    { title: 'Dispositivo', render: (_, d) => `${d.navegador} / ${d.sistema_operativo}` },
    { title: 'IP inicial / última', render: (_, d) => <>{d.ip}<br />{d.ultima_ip ?? '—'}</> },
    { title: 'Primer acceso', dataIndex: 'fecha_creacion', render: fecha },
    { title: 'Último intento', dataIndex: 'ultimo_uso', render: fecha },
    { title: 'Estado', render: (_, d) => <Tag color={d.estado === 'aprobado' ? 'green' : d.estado === 'pendiente' ? 'gold' : 'red'}>{etiquetas[d.estado]}</Tag> },
    { title: 'Acciones', render: (_, d) => <Space>
      {d.estado !== 'aprobado' && hasPermiso('seguridad:aprobar') && <Button type="primary" loading={busy === d.id} onClick={() => decidir(d, 'aprobar')}>Aprobar</Button>}
      {d.estado !== 'bloqueado' && hasPermiso('seguridad:anular') && <Button danger loading={busy === d.id} onClick={() => decidir(d, 'bloquear')}>Bloquear</Button>}
    </Space> },
  ]} expandable={{ expandedRowRender: d => <Descriptions size="small" column={2} items={[
    { key: 'tipo', label: 'Tipo', children: d.datos?.tipo ?? 'No disponible' },
    { key: 'zona', label: 'Zona horaria declarada', children: d.datos?.zona_horaria ?? 'No disponible' },
    { key: 'idioma', label: 'Idioma', children: d.datos?.idioma ?? 'No disponible' },
    { key: 'pantalla', label: 'Pantalla', children: d.datos?.pantalla ?? 'No disponible' },
    { key: 'ubicacion', label: 'Ubicación compartida al registrar', children: d.datos?.latitud != null && d.datos.longitud != null
      ? `${d.datos.latitud}, ${d.datos.longitud} (precisión: ${Math.round(d.datos.precision ?? 0)} m)` : 'No compartida' },
    { key: 'aprobacion', label: 'Fecha de aprobación', children: fecha(d.aprobado_en) },
    { key: 'responsable', label: 'Última decisión por', children: d.responsable ?? '—' },
    { key: 'ua', label: 'Información del navegador', children: d.user_agent },
  ]} /> }} />;
  const items = dispositivos.data?.data ?? [];
  return <Card title="Dispositivos y accesos" extra={<Button onClick={actualizar}>Actualizar</Button>}>
    {(dispositivos.isError || accesos.isError) && <Typography.Paragraph type="danger">No se pudo cargar la información.</Typography.Paragraph>}
    <Typography.Paragraph type="secondary">Fechas en hora de Perú. Se muestran los últimos 200 registros.</Typography.Paragraph>
    <Tabs items={[
      { key: 'pendientes', label: `Pendientes (${items.filter(d => d.estado === 'pendiente').length})`, children: tabla(items.filter(d => d.estado === 'pendiente')) },
      { key: 'todos', label: 'Dispositivos', children: tabla(items) },
      { key: 'accesos', label: 'Historial de accesos', children: <Table<Acceso> rowKey="id" dataSource={accesos.data?.data ?? []} loading={accesos.isFetching} scroll={{ x: 'max-content' }} columns={[
        { title: 'Fecha', dataIndex: 'fecha', render: fecha },
        { title: 'Usuario', render: (_, a) => a.usuario ? `${a.usuario.nombre} ${a.usuario.apellido}` : a.email ?? '—' },
        { title: 'IP', dataIndex: 'ip' },
        { title: 'Acción', dataIndex: 'accion', render: v => v === 'login' ? 'Inicio de sesión' : v === 'dispositivo' ? 'Dispositivo' : v },
        { title: 'Resultado', dataIndex: 'resultado', render: v => etiquetas[v] ?? v },
      ]} expandable={{ expandedRowRender: a => <>{a.user_agent ?? '—'}</> }} /> },
    ]} />
  </Card>;
}
