import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Row, Col, Button, Typography, Tag, Modal, Select, InputNumber, Input, Space } from 'antd';
import { UnlockOutlined, LockOutlined, PlusCircleOutlined, MinusCircleOutlined, ReloadOutlined, WalletOutlined, AuditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { cajaApi } from '@/api/caja';
import { metodosPagoApi } from '@/api/metodos-pago';
import { gastosApi } from '@/api/gastos';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { CajaResumenVista } from './CajaResumenVista';
import { ArqueoCajaModal } from './ArqueoCajaModal';

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

  const { data: arqueosData } = useQuery({
    queryKey: ['caja-arqueos', apertura?.id],
    queryFn: () => cajaApi.arqueos(apertura!.id),
    enabled: !!apertura,
  });

  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalMov, setModalMov] = useState<'ingreso' | 'egreso' | null>(null);
  const [modalArqueo, setModalArqueo] = useState(false);

  const recargarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ['caja-apertura-activa'] });
    queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
    queryClient.invalidateQueries({ queryKey: ['caja-arqueos'] });
  };

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
              <Button block icon={<AuditOutlined />} onClick={() => setModalArqueo(true)}>Arqueo de Caja</Button>
              <Button block type="primary" style={{ background: '#faad14', borderColor: '#faad14' }} icon={<LockOutlined />} onClick={() => setModalCerrar(true)}>
                Cerrar Caja
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchResumen()}>Actualizar</Button>
      </div>

      {resumen && <CajaResumenVista resumen={resumen} arqueos={arqueosData?.data} />}

      <ArqueoCajaModal
        cierre
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

      <ArqueoCajaModal
        open={modalArqueo}
        idApertura={apertura.id}
        saldoSistema={saldoSistema}
        onClose={() => setModalArqueo(false)}
        onSaved={() => { setModalArqueo(false); recargarTodo(); }}
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

function MovimientoModal({ tipo, idApertura, onClose, onSaved }: {
  tipo: 'ingreso' | 'egreso' | null; idApertura: string; onClose: () => void; onSaved: () => void;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState<number | null>(null);
  const [idMetodoPago, setIdMetodoPago] = useState<string | undefined>(undefined);
  const [idGasto, setIdGasto] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const { data: metodosData } = useQuery({ queryKey: ['metodos-pago'], queryFn: metodosPagoApi.listar, enabled: !!tipo });

  // Solo para egresos: gastos registrados y no pagados, para poder vincular el egreso al gasto
  // en vez de crear un movimiento suelto sin relación (ver PagarGastoModal en GastoDetalleModal.tsx,
  // que hace lo mismo desde el lado de Gastos — acá se ofrece el mismo camino desde Caja).
  const { data: gastosData } = useQuery({
    queryKey: ['gastos-pendientes'],
    queryFn: () => gastosApi.listar({ estado: 'registrado', pagado: 'false', limit: 100 }),
    enabled: tipo === 'egreso',
  });
  const gastoSeleccionado = gastosData?.data.find((g) => g.id === idGasto);

  const reset = () => {
    setConcepto(''); setMonto(null); setIdMetodoPago(undefined); setIdGasto(undefined);
  };

  const confirmar = async () => {
    if (idGasto) {
      if (!idMetodoPago) { message.warning('Seleccione un método de pago'); return; }
      setSaving(true);
      try {
        await gastosApi.pagar(idGasto, { id_metodo_pago: idMetodoPago, id_caja_apertura: idApertura });
        message.success('Pago de gasto registrado');
        queryClient.invalidateQueries({ queryKey: ['gastos-pendientes'] });
        queryClient.invalidateQueries({ queryKey: ['gastos'] });
        queryClient.invalidateQueries({ queryKey: ['gasto', idGasto] });
        reset();
        onSaved();
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : 'Error al registrar el pago del gasto');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!concepto.trim() || !monto) { message.warning('Complete concepto y monto'); return; }
    setSaving(true);
    try {
      await cajaApi.movimiento(idApertura, { tipo: tipo!, concepto: concepto.trim(), monto, id_metodo_pago: idMetodoPago });
      message.success('Movimiento registrado');
      reset();
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
      open={!!tipo} onCancel={() => { reset(); onClose(); }} onOk={confirmar} confirmLoading={saving} okText="Registrar" cancelText="Cancelar" destroyOnHidden
    >
      {tipo === 'egreso' && (
        <>
          <Typography.Text strong>¿Es el pago de un gasto pendiente? (opcional)</Typography.Text>
          <Select
            value={idGasto} onChange={setIdGasto} allowClear style={{ width: '100%', margin: '4px 0 12px' }}
            placeholder="Sin vincular a un gasto"
            options={(gastosData?.data || []).map((g) => ({
              value: g.id,
              label: `${g.numero_interno} — ${g.razon_social_emisor} — ${formatMoneda(g.total_pen)}`,
            }))}
          />
        </>
      )}

      {idGasto ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Egreso por <strong>{gastoSeleccionado?.numero_interno}</strong> ({gastoSeleccionado?.razon_social_emisor}):{' '}
          <strong>{formatMoneda(gastoSeleccionado?.total_pen || 0)}</strong>.
        </Typography.Text>
      ) : (
        <>
          <Typography.Text strong>Concepto</Typography.Text>
          <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del movimiento" style={{ margin: '4px 0 12px' }} autoFocus />
          <Typography.Text strong>Monto (S/)</Typography.Text>
          <InputNumber value={monto} onChange={setMonto} min={0.01} step={0.01} style={{ width: '100%', marginTop: 4, marginBottom: 12 }} />
        </>
      )}

      <Typography.Text strong>Método de pago {idGasto ? '' : '(opcional)'}</Typography.Text>
      <Select
        value={idMetodoPago} onChange={setIdMetodoPago} allowClear={!idGasto} style={{ width: '100%', marginTop: 4 }}
        placeholder="Sin especificar"
        options={(metodosData?.data || []).map((m) => ({ value: m.id, label: m.nombre }))}
      />
    </Modal>
  );
}
