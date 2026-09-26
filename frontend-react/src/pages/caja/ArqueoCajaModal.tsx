import { useState } from 'react';
import { App, Modal, Row, Col, Typography, InputNumber, Input, Checkbox, Alert } from 'antd';
import { cajaApi } from '@/api/caja';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { DENOMINACIONES } from '@/types/caja';

const redondear2 = (v: number) => Math.round(v * 100) / 100;

export function ArqueoCajaModal({ open, idApertura, saldoSistema, onClose, onSaved, cierre = false }: {
  cierre?: boolean; open: boolean; idApertura: string; saldoSistema: number; onClose: () => void; onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [observaciones, setObservaciones] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalContado = redondear2(
    DENOMINACIONES.reduce((acc, d) => acc + d.denominacion * (cantidades[d.denominacion] ?? 0), 0),
  );
  const diferencia = redondear2(totalContado - saldoSistema);

  const reset = () => { setCantidades({}); setObservaciones(''); setConfirmado(false); };

  const confirmar = async () => {
    const detalle = DENOMINACIONES
      .map((d) => ({ ...d, cantidad: cantidades[d.denominacion] ?? 0 }))
      .filter((d) => cierre || d.cantidad > 0);
    if (!detalle.length) { message.warning('Ingrese al menos una denominación'); return; }
    if (saving || (cierre && !confirmado)) return;
    setSaving(true);
    try {
      await (cierre ? cajaApi.cerrar : cajaApi.registrarArqueo)(idApertura, { detalle, observaciones: observaciones.trim() || undefined });
      message.success(cierre ? 'Caja cerrada con arqueo final' : 'Arqueo registrado');
      reset();
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar el arqueo');
    } finally {
      setSaving(false);
    }
  };

  const renderFila = (denominacion: number) => (
    <div key={denominacion} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Typography.Text style={{ width: 70 }}>S/ {denominacion.toFixed(2)}</Typography.Text>
      <InputNumber
        value={cantidades[denominacion] ?? null}
        aria-label={`Cantidad de S/ ${denominacion.toFixed(2)}`}
        disabled={saving}
        onChange={(v) => { setCantidades((prev) => ({ ...prev, [denominacion]: v ?? 0 })); setConfirmado(false); }}
        min={0}
        step={1}
        precision={0}
        style={{ width: 90 }}
      />
      <Typography.Text type="secondary" style={{ width: 90, textAlign: 'right' }}>
        {formatMoneda(redondear2(denominacion * (cantidades[denominacion] ?? 0)))}
      </Typography.Text>
    </div>
  );

  return (
    <Modal
      title={cierre ? 'Arqueo final y cierre de caja' : 'Arqueo de Caja'}
      open={open}
      onCancel={() => { if (!saving) { reset(); onClose(); } }}
      onOk={confirmar}
      confirmLoading={saving}
      okText={cierre ? 'Confirmar arqueo y cerrar caja' : 'Registrar Arqueo'}
      okButtonProps={{ disabled: cierre ? !confirmado : totalContado === 0 }}
      cancelText="Cancelar"
      width={520}
      destroyOnHidden
    >
      {cierre && <Alert type="info" showIcon title="Solo efectivo. Las cantidades vacías cuentan como cero." style={{ marginBottom: 16 }} />}
      <div style={{ background: '#e6f4ff', borderRadius: 6, padding: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span>Saldo sistema:</span>
        <strong>{formatMoneda(saldoSistema)}</strong>
      </div>

      <Row gutter={24}>
        <Col span={12}>
          <Typography.Text strong>Monedas</Typography.Text>
          <div style={{ marginTop: 8 }}>
            {DENOMINACIONES.filter((d) => d.tipo === 'moneda').map((d) => renderFila(d.denominacion))}
          </div>
        </Col>
        <Col span={12}>
          <Typography.Text strong>Billetes</Typography.Text>
          <div style={{ marginTop: 8 }}>
            {DENOMINACIONES.filter((d) => d.tipo === 'billete').map((d) => renderFila(d.denominacion))}
          </div>
        </Col>
      </Row>

      <Typography.Text strong>Observaciones (opcional)</Typography.Text>
      <Input maxLength={500} disabled={saving} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del arqueo" style={{ margin: '4px 0 12px' }} />

      <Typography.Title level={5} style={{ textAlign: 'center', marginTop: 8 }}>
        Total contado: {formatMoneda(totalContado)}
      </Typography.Title>
      {(cierre || totalContado > 0) && (
        <Typography.Title level={5} style={{ textAlign: 'center', marginTop: 4, color: diferencia >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {diferencia === 0 ? 'Caja cuadrada' : diferencia > 0 ? 'Sobrante' : 'Faltante'}: {diferencia >= 0 ? '+' : ''}{formatMoneda(diferencia)}
        </Typography.Title>
      )}
      {cierre && <Checkbox checked={confirmado} disabled={saving} onChange={(e) => setConfirmado(e.target.checked)}>
        Confirmo que conté todo el efectivo y revisé la diferencia{totalContado === 0 ? '. La caja no contiene efectivo' : ''}.
      </Checkbox>}
    </Modal>
  );
}
