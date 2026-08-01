import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Row, Col, Button, Table, Typography, Tag, Modal, Select, InputNumber, Input, Empty, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UnlockOutlined, LockOutlined, PlusCircleOutlined, MinusCircleOutlined, ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { cajaApi } from '@/api/caja';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import type { MovimientoCaja } from '@/types/caja';

export function CajaPage() {
  const queryClient = useQueryClient();

  const { data: aperturaData, isFetching: cargandoApertura } = useQuery({
    queryKey: ['caja-apertura-activa'],
    queryFn: () => cajaApi.miAperturaActiva(),
  });
  const apertura = aperturaData ?? null;

  const { data: resumenData, refetch: refetchResumen } = useQuery({
    queryKey: ['caja-resumen', apertura?.id],
    queryFn: () => cajaApi.resumen(apertura!.id),
    enabled: !!apertura,
  });
  const resumen = resumenData?.data;
  const saldoSistema = resumen?.resumen.saldo_actual ?? Number(apertura?.monto_apertura ?? 0);

  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalMov, setModalMov] = useState<'ingreso' | 'egreso' | null>(null);

  const recargarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ['caja-apertura-activa'] });
    queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
  };

  const columns: ColumnsType<MovimientoCaja> = [
    { title: 'Hora', dataIndex: 'fecha', render: (v) => dayjs(v).format('HH:mm:ss') },
    { title: 'Tipo', dataIndex: 'tipo', render: (v) => <Tag color={v === 'ingreso' ? 'success' : 'error'}>{v}</Tag> },
    { title: 'Concepto', dataIndex: 'concepto' },
    {
      title: 'Monto', align: 'right',
      render: (_, m) => (
        <Typography.Text strong type={m.tipo === 'ingreso' ? 'success' : 'danger'}>
          {m.tipo === 'ingreso' ? '+' : '-'}{formatMoneda(m.monto)}
        </Typography.Text>
      ),
    },
  ];

  if (cargandoApertura) return null;

  if (!apertura) {
    return (
      <>
        <Card style={{ borderColor: '#faad14', textAlign: 'center', padding: '32px 0' }}>
          <WalletOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <Typography.Title level={4}>No hay caja abierta</Typography.Title>
          <Typography.Text type="secondary">Abra una caja para comenzar a operar</Typography.Text>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<UnlockOutlined />} onClick={() => setModalAbrir(true)}>
              Abrir Caja
            </Button>
          </div>
        </Card>
        <AbrirCajaModal open={modalAbrir} onClose={() => setModalAbrir(false)} onSaved={() => { setModalAbrir(false); recargarTodo(); }} />
      </>
    );
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card style={{ borderColor: '#52c41a', textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Caja</Typography.Text>
            <Typography.Title level={5} style={{ margin: '4px 0' }}>{apertura.caja?.nombre || 'Caja'}</Typography.Title>
            <Tag color="success">Abierta</Tag>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Apertura</Typography.Text>
            <Typography.Title level={5} style={{ margin: '4px 0' }}>{formatMoneda(apertura.monto_apertura)}</Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{dayjs(apertura.fecha_apertura).format('DD/MM/YYYY HH:mm')}</Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderColor: '#1677ff', textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Saldo Sistema</Typography.Text>
            <Typography.Title level={5} style={{ margin: '4px 0', color: '#1677ff' }}>{formatMoneda(saldoSistema)}</Typography.Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Button block icon={<PlusCircleOutlined />} onClick={() => setModalMov('ingreso')}>Ingreso</Button>
              <Button block danger icon={<MinusCircleOutlined />} onClick={() => setModalMov('egreso')}>Egreso</Button>
              <Button block type="primary" style={{ background: '#faad14', borderColor: '#faad14' }} icon={<LockOutlined />} onClick={() => setModalCerrar(true)}>
                Cerrar Caja
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={<><WalletOutlined style={{ marginRight: 8 }} />Movimientos de caja</>}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => refetchResumen()} />}
      >
        {resumen?.movimientos.length
          ? <Table<MovimientoCaja> rowKey="id" columns={columns} dataSource={resumen.movimientos} pagination={false} />
          : <Empty description="Sin movimientos" />}
      </Card>

      <CerrarCajaModal
        open={modalCerrar}
        idApertura={apertura.id}
        saldoSistema={saldoSistema}
        onClose={() => setModalCerrar(false)}
        onSaved={() => { setModalCerrar(false); recargarTodo(); }}
      />

      <MovimientoModal
        tipo={modalMov}
        idApertura={apertura.id}
        onClose={() => setModalMov(null)}
        onSaved={() => { setModalMov(null); refetchResumen(); }}
      />
    </div>
  );
}

function AbrirCajaModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const { data } = useQuery({ queryKey: ['cajas'], queryFn: () => cajaApi.cajas(), enabled: open });
  const [idCaja, setIdCaja] = useState<string | undefined>(undefined);
  const [monto, setMonto] = useState(0);
  const [saving, setSaving] = useState(false);

  const confirmar = async () => {
    if (!idCaja) { message.warning('Seleccione una caja'); return; }
    setSaving(true);
    try {
      await cajaApi.abrir({ id_caja: idCaja, monto_apertura: monto });
      message.success('Caja abierta correctamente');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al abrir la caja');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Abrir Caja" open={open} onCancel={onClose} onOk={confirmar} confirmLoading={saving} okText="Abrir" okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }} cancelText="Cancelar" destroyOnHidden>
      <Typography.Text strong>Caja</Typography.Text>
      <Select value={idCaja} onChange={setIdCaja} style={{ width: '100%', margin: '4px 0 12px' }} options={(data?.data || []).map((c) => ({ value: c.id, label: c.nombre }))} />
      <Typography.Text strong>Monto de apertura (S/)</Typography.Text>
      <InputNumber value={monto} onChange={(v) => setMonto(v ?? 0)} min={0} step={0.01} style={{ width: '100%', marginTop: 4 }} />
    </Modal>
  );
}

function CerrarCajaModal({ open, idApertura, saldoSistema, onClose, onSaved }: {
  open: boolean; idApertura: string; saldoSistema: number; onClose: () => void; onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [monto, setMonto] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const diferencia = monto !== null ? monto - saldoSistema : null;

  const confirmar = async () => {
    if (monto === null || monto < 0) { message.warning('Ingrese el monto contado'); return; }
    setSaving(true);
    try {
      await cajaApi.cerrar(idApertura, { monto_cierre: monto });
      message.success('Caja cerrada correctamente');
      setMonto(null);
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cerrar la caja');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Cerrar Caja" open={open} onCancel={onClose} onOk={confirmar} confirmLoading={saving} okText="Cerrar Caja" okButtonProps={{ style: { background: '#faad14', borderColor: '#faad14' } }} cancelText="Cancelar" destroyOnHidden>
      <div style={{ background: '#e6f4ff', borderRadius: 6, padding: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span>Saldo sistema:</span>
        <strong>{formatMoneda(saldoSistema)}</strong>
      </div>
      <Typography.Text strong>Monto contado en caja (S/)</Typography.Text>
      <InputNumber value={monto} onChange={setMonto} min={0} step={0.01} style={{ width: '100%', marginTop: 4 }} autoFocus />
      {diferencia !== null && (
        <Typography.Title level={5} style={{ textAlign: 'center', marginTop: 16, color: diferencia >= 0 ? '#52c41a' : '#ff4d4f' }}>
          Diferencia: {diferencia >= 0 ? '+' : ''}{formatMoneda(diferencia)}
        </Typography.Title>
      )}
    </Modal>
  );
}

function MovimientoModal({ tipo, idApertura, onClose, onSaved }: {
  tipo: 'ingreso' | 'egreso' | null; idApertura: string; onClose: () => void; onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const confirmar = async () => {
    if (!concepto.trim() || !monto) { message.warning('Complete concepto y monto'); return; }
    setSaving(true);
    try {
      await cajaApi.movimiento(idApertura, { tipo: tipo!, concepto: concepto.trim(), monto });
      message.success('Movimiento registrado');
      setConcepto(''); setMonto(null);
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={tipo === 'ingreso' ? 'Ingreso de Caja' : 'Egreso de Caja'}
      open={!!tipo} onCancel={onClose} onOk={confirmar} confirmLoading={saving} okText="Registrar" cancelText="Cancelar" destroyOnHidden
    >
      <Typography.Text strong>Concepto</Typography.Text>
      <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del movimiento" style={{ margin: '4px 0 12px' }} autoFocus />
      <Typography.Text strong>Monto (S/)</Typography.Text>
      <InputNumber value={monto} onChange={setMonto} min={0.01} step={0.01} style={{ width: '100%', marginTop: 4 }} />
    </Modal>
  );
}
