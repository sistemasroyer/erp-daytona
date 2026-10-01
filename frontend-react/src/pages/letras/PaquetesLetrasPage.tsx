import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCatalogosApi, letrasPaquetesApi } from '@/api/letras';
import { proveedoresApi } from '@/api/proveedores';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Autocomplete } from '@/components/Autocomplete';
import { EstadoTag } from '@/components/EstadoTag';
import { SelectConCrear } from '@/components/SelectConCrear';
import { usePagination } from '@/hooks/usePagination';
import { formatMoneda } from '@/utils/format';
import { ESTADO_PAQUETE_LABEL, type EstadoPaqueteLetras, type MonedaLetras, type PaqueteLetras } from '@/types/letras';
import type { Proveedor } from '@/types/proveedor';

const ESTADOS_RESUMEN: EstadoPaqueteLetras[] = ['borrador', 'pendiente_aprobacion', 'aprobado', 'en_proceso', 'completado', 'cancelado'];

export function PaquetesLetrasPage() {
  const navigate = useNavigate();
  const { hasPermiso } = useAuth();
  const { page, limit, setPage } = usePagination(20);
  const [search, setSearch] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoPaqueteLetras | undefined>(undefined);
  const [moneda, setMoneda] = useState<MonedaLetras | undefined>(undefined);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['letras-paquetes', page, limit, busqueda, estado, moneda],
    queryFn: () => letrasPaquetesApi.listar({ page, limit, search: busqueda || undefined, estado, moneda }),
  });
  const { data: resumen } = useQuery({ queryKey: ['letras-paquetes-resumen'], queryFn: () => letrasPaquetesApi.resumen() });

  const columnas: ColumnsType<PaqueteLetras> = [
    { title: 'Código', dataIndex: 'codigo', render: (v) => <strong>{v}</strong> },
    { title: 'Proveedor', render: (_, p) => <><div>{p.proveedor.razon_social}</div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.proveedor.ruc}</Typography.Text></> },
    { title: 'Monto', align: 'right', render: (_, p) => <strong>{formatMoneda(p.monto_total, p.moneda)}</strong> },
    { title: 'Pago', render: (_, p) => `${dayjs(p.fecha_inicio_pago).format('DD/MM/YYYY')} → ${dayjs(p.fecha_fin_pago).format('DD/MM/YYYY')}` },
    { title: 'Letras', align: 'center', render: (_, p) => p.letras_total ? `${p.letras_pagadas}/${p.letras_total} pagadas` : `${p.numero_cuotas} sugerida(s)` },
    { title: 'Banco', render: (_, p) => p.banco?.siglas || p.banco?.nombre || '-' },
    { title: 'Estado', align: 'center', render: (_, p) => <EstadoTag estado={p.estado} /> },
    { title: '', width: 60, render: (_, p) => <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/letras/paquetes/${p.id}`)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Paquetes de Letras</Typography.Title>
        {hasPermiso('letras:crear') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setNuevoAbierto(true)}>Nuevo paquete</Button>}
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {ESTADOS_RESUMEN.map((e) => (
          <Col key={e} xs={12} sm={8} lg={4}>
            <Card size="small" hoverable onClick={() => { setEstado(estado === e ? undefined : e); setPage(1); }} style={{ borderColor: estado === e ? '#1677ff' : undefined }}>
              <Statistic title={ESTADO_PAQUETE_LABEL[e]} value={resumen?.data[e] ?? 0} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="Código, proveedor o RUC" allowClear style={{ width: 280 }} enterButton={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)} onSearch={(v) => { setBusqueda(v.trim()); setPage(1); }}
          />
          <Select
            allowClear placeholder="Estado" style={{ width: 210 }} value={estado}
            onChange={(v) => { setEstado(v); setPage(1); }}
            options={ESTADOS_RESUMEN.map((e) => ({ value: e, label: ESTADO_PAQUETE_LABEL[e] }))}
          />
          <Select
            allowClear placeholder="Moneda" style={{ width: 140 }} value={moneda}
            onChange={(v) => { setMoneda(v); setPage(1); }}
            options={[{ value: 'PEN', label: 'Soles' }, { value: 'USD', label: 'Dólares' }]}
          />
        </Space>
        <Table
          size="small" rowKey="id" columns={columnas} dataSource={data?.data || []} loading={isFetching}
          onRow={(p) => ({ onDoubleClick: () => navigate(`/letras/paquetes/${p.id}`) })}
          pagination={{ current: page, pageSize: limit, total: data?.meta?.total ?? 0, onChange: setPage, showTotal: (t) => `${t} paquetes` }}
        />
      </Card>

      <NuevoPaqueteModal open={nuevoAbierto} onClose={() => setNuevoAbierto(false)} onCreado={(p) => navigate(`/letras/paquetes/${p.id}`)} />
    </div>
  );
}

function NuevoPaqueteModal({ open, onClose, onCreado }: { open: boolean; onClose: () => void; onCreado: (p: PaqueteLetras) => void }) {
  const { message } = App.useApp();
  const { hasPermiso } = useAuth();
  const queryClient = useQueryClient();
  const { data: bancosData } = useQuery({ queryKey: ['letras-bancos'], queryFn: () => letrasCatalogosApi.listarBancos(), enabled: open });
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [moneda, setMoneda] = useState<MonedaLetras>('PEN');
  const [idBanco, setIdBanco] = useState<string | undefined>(undefined);
  const [inicio, setInicio] = useState<Dayjs>(dayjs());
  const [diasCredito, setDiasCredito] = useState(30);
  const [cuotas, setCuotas] = useState(1);
  const [comentarios, setComentarios] = useState('');
  const [guardando, setGuardando] = useState(false);

  const elegirProveedor = (p: Proveedor) => {
    setProveedor(p);
    if (p.dias_credito) setDiasCredito(p.dias_credito);
    if (p.letras_pago_unico) setCuotas(1);
  };

  const guardar = async () => {
    if (!proveedor) { message.warning('Seleccione el proveedor'); return; }
    setGuardando(true);
    try {
      const { data } = await letrasPaquetesApi.crear({
        id_proveedor: proveedor.id, moneda, id_banco: idBanco, fecha_inicio_pago: inicio.format('YYYY-MM-DD'),
        dias_credito: diasCredito, numero_cuotas: cuotas, comentarios: comentarios.trim() || undefined,
      });
      message.success(`Paquete ${data.codigo} creado. Ahora agregue sus documentos.`);
      queryClient.invalidateQueries({ queryKey: ['letras-paquetes'] });
      queryClient.invalidateQueries({ queryKey: ['letras-paquetes-resumen'] });
      onCreado(data);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al crear el paquete');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title="Nuevo paquete de letras" open={open} onCancel={onClose} onOk={guardar} confirmLoading={guardando} okText="Crear paquete" width={620} destroyOnHidden>
      <Form layout="vertical">
        <Form.Item label="Proveedor" required>
          <Autocomplete<Proveedor>
            placeholder="Buscar por RUC o razón social..."
            buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 8 })).data}
            getLabel={(p) => p.razon_social}
            renderOpcion={(p) => <><strong>{p.ruc}</strong> — {p.razon_social}</>}
            onSelect={elegirProveedor}
          />
          {proveedor?.letras_pago_unico && <Typography.Text type="warning" style={{ fontSize: 12 }}>Proveedor de PAGO ÚNICO: el paquete será de 1 cuota.</Typography.Text>}
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Moneda" required help="Solo entran facturas en esta moneda">
              <Select value={moneda} onChange={setMoneda} options={[{ value: 'PEN', label: 'Soles (S/)' }, { value: 'USD', label: 'Dólares (US$)' }]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Banco">
              <SelectConCrear
                allowClear placeholder="Seleccione" value={idBanco} onChange={setIdBanco}
                options={(bancosData?.data || []).filter((b) => b.estado).map((b) => ({ value: b.id, label: b.siglas ? `${b.siglas} — ${b.nombre}` : b.nombre }))}
                textoNuevo="Nuevo banco (escriba el nombre)" puedeCrear={hasPermiso('letras:editar')}
                crear={async (nombre) => {
                  const { data } = await letrasCatalogosApi.crearBanco({ nombre });
                  await queryClient.invalidateQueries({ queryKey: ['letras-bancos'] });
                  return data.id;
                }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="Inicio de pago" required>
              <DatePicker value={inicio} onChange={(v) => v && setInicio(v)} format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Días de crédito" required help={`Fin: ${inicio.add(diasCredito, 'day').format('DD/MM/YYYY')}`}>
              <InputNumber value={diasCredito} onChange={(v) => setDiasCredito(v ?? 0)} min={0} max={365} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Cuotas sugeridas" help="Se ajusta al generar">
              <InputNumber value={cuotas} onChange={(v) => setCuotas(v ?? 1)} min={1} max={36} disabled={!!proveedor?.letras_pago_unico} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Comentarios">
          <Input.TextArea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
