import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Dropdown, Form, Input, InputNumber, Modal, Radio, Select, Space, Typography } from 'antd';
import { BankOutlined, CalendarOutlined, DeleteOutlined, DollarOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCuotasApi } from '@/api/letras';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useConfirmar } from '@/components/ConfirmModal';
import { formatMoneda } from '@/utils/format';
import { METODOS_PAGO_LETRA, type Letra, type ModoEliminarLetra } from '@/types/letras';

type Accion = 'pagar' | 'codigo' | 'monto' | 'fecha' | 'eliminar';

const errorTexto = (err: unknown, defecto: string) => (err instanceof ApiError ? err.message : defecto);

/** Invalida todo lo que muestra letras (listado, calendario, paquete) tras un cambio. */
export function useRefrescarLetras() {
  const queryClient = useQueryClient();
  return () => {
    for (const k of ['letras-cuotas', 'letras-cuotas-resumen', 'letras-calendario', 'letras-paquete', 'letras-paquetes', 'letras-paquetes-resumen']) {
      queryClient.invalidateQueries({ queryKey: [k] });
    }
  };
}

/** Botón "⋯" con las acciones de una letra: pago, código del banco, monto, fecha y eliminar. */
export function AccionesLetra({ letra, etiqueta, onCambio }: { letra: Letra; etiqueta?: string; onCambio?: () => void }) {
  const { hasPermiso } = useAuth();
  const [accion, setAccion] = useState<Accion | null>(null);
  const refrescar = useRefrescarLetras();
  const pendiente = letra.estado === 'pendiente';
  const puedeEditar = hasPermiso('letras:editar');

  const items = [
    pendiente && puedeEditar && { key: 'pagar', icon: <DollarOutlined />, label: 'Registrar pago' },
    letra.estado !== 'cancelada' && puedeEditar && { key: 'codigo', icon: <BankOutlined />, label: 'Código del banco' },
    pendiente && puedeEditar && { key: 'monto', icon: <EditOutlined />, label: 'Cambiar monto' },
    pendiente && puedeEditar && { key: 'fecha', icon: <CalendarOutlined />, label: 'Cambiar fecha' },
    pendiente && hasPermiso('letras:eliminar') && { key: 'eliminar', icon: <DeleteOutlined />, label: 'Eliminar letra', danger: true },
  ].filter(Boolean) as { key: Accion; icon: React.ReactNode; label: string; danger?: boolean }[];

  if (!items.length) return null;
  const listo = () => { setAccion(null); refrescar(); onCambio?.(); };
  const props = { letra, onClose: () => setAccion(null), onListo: listo };

  return (
    <>
      <Dropdown trigger={['click']} menu={{ items, onClick: ({ key }) => setAccion(key as Accion) }}>
        {etiqueta ? <Button size="small">{etiqueta}</Button> : <Button size="small" icon={<MoreOutlined />} aria-label="Acciones de la letra" />}
      </Dropdown>
      {accion === 'pagar' && <PagarModal {...props} />}
      {accion === 'codigo' && <CodigoBancoModal {...props} />}
      {accion === 'monto' && <MontoModal {...props} />}
      {accion === 'fecha' && <FechaModal {...props} />}
      {accion === 'eliminar' && <EliminarModal {...props} />}
    </>
  );
}

interface ModalProps { letra: Letra; onClose: () => void; onListo: () => void }

const titulo = (l: Letra, accion: string) => `${accion} — cuota ${l.numero_cuota} (${formatMoneda(l.monto, l.moneda)}, ${dayjs(l.fecha_pago).format('DD/MM/YYYY')})`;

function PagarModal({ letra, onClose, onListo }: ModalProps) {
  const { message } = App.useApp();
  const [fecha, setFecha] = useState<Dayjs>(dayjs());
  const [metodo, setMetodo] = useState('TRANSFERENCIA');
  const [operacion, setOperacion] = useState('');
  const [monto, setMonto] = useState<number | null>(Number(letra.monto));
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);
  const diferencia = monto ? Math.abs(monto - Number(letra.monto)) / Number(letra.monto) : 0;

  const guardar = async () => {
    if (!monto || !metodo) return;
    setGuardando(true);
    try {
      const { data } = await letrasCuotasApi.pagar(letra.id, {
        fecha_pago_efectivo: fecha.format('YYYY-MM-DD'), metodo_pago: metodo, monto_pagado: monto,
        numero_operacion: operacion.trim() || undefined, observaciones: obs.trim() || undefined,
      });
      message.success(data.paquete_completado ? 'Pago registrado. Era la última letra: el paquete quedó Completado.' : 'Pago registrado');
      onListo();
    } catch (err) {
      message.error(errorTexto(err, 'No se pudo registrar el pago'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open title={titulo(letra, 'Registrar pago')} onCancel={onClose} onOk={guardar} okText="Registrar pago" confirmLoading={guardando} okButtonProps={{ disabled: !monto || !metodo }} destroyOnHidden>
      <Form layout="vertical">
        <Space.Compact block>
          <Form.Item label="Fecha del pago" style={{ flex: 1, marginRight: 12 }}>
            <DatePicker value={fecha} onChange={(d) => d && setFecha(d)} format="DD/MM/YYYY" allowClear={false} disabledDate={(d) => d.isAfter(dayjs(), 'day')} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={`Monto pagado (${letra.moneda})`} style={{ flex: 1 }}>
            <InputNumber value={monto} onChange={setMonto} min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>
        {diferencia > 0.1 && <Alert type="error" showIcon title="El monto pagado no puede diferir más de 10% del monto de la letra" style={{ marginBottom: 12 }} />}
        <Form.Item label="Método de pago">
          <Select value={metodo} onChange={setMetodo} options={METODOS_PAGO_LETRA.map((m) => ({ value: m, label: m }))} />
        </Form.Item>
        <Form.Item label="N° de operación">
          <Input value={operacion} onChange={(e) => setOperacion(e.target.value)} maxLength={50} />
        </Form.Item>
        <Form.Item label="Observaciones" style={{ marginBottom: 0 }}>
          <Input.TextArea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function CodigoBancoModal({ letra, onClose, onListo }: ModalProps) {
  const { message } = App.useApp();
  const [codigo, setCodigo] = useState(letra.codigo_banco ?? '');
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    try {
      await letrasCuotasApi.codigoBanco(letra.id, codigo.trim());
      message.success('Código del banco guardado');
      onListo();
    } catch (err) {
      message.error(errorTexto(err, 'No se pudo guardar'));
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal open title={titulo(letra, 'Código del banco')} onCancel={onClose} onOk={guardar} okText="Guardar" confirmLoading={guardando} destroyOnHidden>
      <Typography.Paragraph type="secondary">El número que el banco le asigna a la letra (déjelo vacío para quitarlo).</Typography.Paragraph>
      <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={50} autoFocus onPressEnter={guardar} />
    </Modal>
  );
}

function MontoModal({ letra, onClose, onListo }: ModalProps) {
  const { message } = App.useApp();
  const [monto, setMonto] = useState<number | null>(Number(letra.monto));
  const [guardando, setGuardando] = useState(false);
  const delta = (monto ?? 0) - Number(letra.monto);
  const guardar = async () => {
    if (!monto) return;
    setGuardando(true);
    try {
      const { data } = await letrasCuotasApi.cambiarMonto(letra.id, monto);
      message.success(`Monto cambiado; la diferencia se repartió entre ${data.redistribuidas} letra(s) pendiente(s)`);
      onListo();
    } catch (err) {
      message.error(errorTexto(err, 'No se pudo cambiar el monto'));
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal open title={titulo(letra, 'Cambiar monto')} onCancel={onClose} onOk={guardar} okText="Cambiar monto" confirmLoading={guardando} okButtonProps={{ disabled: !monto || Math.abs(delta) < 0.005 }} destroyOnHidden>
      <Form layout="vertical">
        <Form.Item label={`Nuevo monto (${letra.moneda})`}>
          <InputNumber value={monto} onChange={setMonto} min={0.01} precision={2} style={{ width: '100%' }} autoFocus />
        </Form.Item>
      </Form>
      <Alert type="info" showIcon title={Math.abs(delta) < 0.005
        ? 'El total del paquete no cambia: la diferencia se reparte entre las demás letras pendientes, en proporción a su monto.'
        : `Las demás letras pendientes ${delta > 0 ? 'bajarán' : 'subirán'} en total ${formatMoneda(Math.abs(delta), letra.moneda)}, en proporción a su monto.`} />
    </Modal>
  );
}

function FechaModal({ letra, onClose, onListo }: ModalProps) {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const [fecha, setFecha] = useState<Dayjs>(dayjs(letra.fecha_pago));
  const [guardando, setGuardando] = useState(false);
  const texto = fecha.format('YYYY-MM-DD');

  const guardar = async () => {
    setGuardando(true);
    try {
      await moverLetra(letra.id, texto, confirmar);
      message.success(`Letra movida al ${fecha.format('dddd DD/MM/YYYY')}`);
      onListo();
    } catch (err) {
      if (err !== CANCELADO) message.error(errorTexto(err, 'No se pudo mover la letra'));
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal open title={titulo(letra, 'Cambiar fecha')} onCancel={onClose} onOk={guardar} okText="Mover" confirmLoading={guardando} okButtonProps={{ disabled: texto === letra.fecha_pago }} destroyOnHidden>
      <Form layout="vertical">
        <Form.Item label="Nueva fecha de pago" extra={`La fecha del banco será el ${fecha.subtract(7, 'day').format('DD/MM/YYYY')} (7 días antes).`}>
          <DatePicker value={fecha} onChange={(d) => d && setFecha(d)} format="dddd DD/MM/YYYY" allowClear={false} disabledDate={(d) => d.day() === 0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export const CANCELADO = Symbol('cancelado');

/** Mueve la letra; si el día pasa su límite + 10%, pregunta antes de forzarlo. Lanza CANCELADO si el usuario desiste. */
export async function moverLetra(id: string, fecha: string, confirmar: ReturnType<typeof useConfirmar>['confirmar']) {
  try {
    await letrasCuotasApi.cambiarFecha(id, fecha);
  } catch (err) {
    if (!(err instanceof ApiError) || !err.message.includes('límite')) throw err;
    const ok = await confirmar(err.message.replace('Confirme para moverla igual.', '¿Moverla igual?'), 'El día supera su límite');
    if (!ok) throw CANCELADO;
    await letrasCuotasApi.cambiarFecha(id, fecha, true);
  }
}

function EliminarModal({ letra, onClose, onListo }: ModalProps) {
  const { message } = App.useApp();
  const [modo, setModo] = useState<ModoEliminarLetra>('auto');
  const [destino, setDestino] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const { data } = useQuery({
    queryKey: ['letras-cuotas', 'paquete', letra.id_paquete],
    queryFn: () => letrasCuotasApi.listar({ id_paquete: letra.id_paquete, estado: 'pendiente', limit: 100 }),
  });
  const otras = (data?.data ?? []).filter((l) => l.id !== letra.id);

  const guardar = async () => {
    setGuardando(true);
    try {
      await letrasCuotasApi.eliminar(letra.id, modo, modo === 'elegir' ? destino : undefined);
      message.success('Letra eliminada');
      onListo();
    } catch (err) {
      message.error(errorTexto(err, 'No se pudo eliminar'));
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal open title={titulo(letra, 'Eliminar letra')} onCancel={onClose} onOk={guardar} okText="Eliminar" okButtonProps={{ danger: true, disabled: (modo === 'auto' && !otras.length) || (modo === 'elegir' && !destino) }} confirmLoading={guardando} destroyOnHidden>
      <Typography.Paragraph>¿Qué hacer con sus {formatMoneda(letra.monto, letra.moneda)}?</Typography.Paragraph>
      <Radio.Group value={modo} onChange={(e) => setModo(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Radio value="auto" disabled={!otras.length}>Repartirlo entre las demás letras pendientes ({otras.length})</Radio>
        <Radio value="elegir" disabled={!otras.length}>Sumarlo a una letra</Radio>
        <Radio value="ninguno">No pasarlo a otra letra (el total de letras quedará menor que el del paquete)</Radio>
      </Radio.Group>
      {modo === 'elegir' && (
        <Select style={{ width: '100%', marginTop: 12 }} placeholder="Letra que recibe el monto" value={destino} onChange={setDestino}
          options={otras.map((l) => ({ value: l.id, label: `Cuota ${l.numero_cuota} — ${dayjs(l.fecha_pago).format('DD/MM/YYYY')} — ${formatMoneda(l.monto, l.moneda)}` }))} />
      )}
      {!otras.length && <Alert type="warning" showIcon style={{ marginTop: 12 }} title="Es la única letra pendiente. Si no quedan letras, el paquete vuelve a Aprobado para generarlas de nuevo." />}
    </Modal>
  );
}
