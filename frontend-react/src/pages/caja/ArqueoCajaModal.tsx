import { useState } from 'react';
import { App, Modal, Row, Col, Typography, InputNumber, Input } from 'antd';
import { cajaApi } from '@/api/caja';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { DENOMINACIONES } from '@/types/caja';

const redondear2 = (v: number) => Math.round(v * 100) / 100;

export function ArqueoCajaModal({ open, idApertura, saldoSistema, onClose, onSaved }: {
  open: boolean; idApertura: string; saldoSistema: number; onClose: () => void; onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  const totalContado = redondear2(
    DENOMINACIONES.reduce((acc, d) => acc + d.denominacion * (cantidades[d.denominacion] ?? 0), 0),
  );
  const diferencia = redondear2(totalContado - saldoSistema);

  const reset = () => { setCantidades({}); setObservaciones(''); };

  const confirmar = async () => {
    const detalle = DENOMINACIONES
      .map((d) => ({ ...d, cantidad: cantidades[d.denominacion] ?? 0 }))
      .filter((d) => d.cantidad > 0);
    if (!detalle.length) { message.warning('Ingrese al menos una denominación'); return; }
    setSaving(true);
    try {
      await cajaApi.registrarArqueo(idApertura, { detalle, observaciones: observaciones.trim() || undefined });
      message.success('Arqueo registrado');
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
        onChange={(v) => setCantidades((prev) => ({ ...prev, [denominacion]: v ?? 0 }))}
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
      title="Arqueo de Caja"
      open={open}
      onCancel={() => { reset(); onClose(); }}
      onOk={confirmar}
      confirmLoading={saving}
      okText="Registrar Arqueo"
      okButtonProps={{ disabled: totalContado === 0 }}
      cancelText="Cancelar"
      width={520}
      destroyOnHidden
    >
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
      <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del arqueo" style={{ margin: '4px 0 12px' }} />

      <Typography.Title level={5} style={{ textAlign: 'center', marginTop: 8 }}>
        Total contado: {formatMoneda(totalContado)}
      </Typography.Title>
      {totalContado > 0 && (
        <Typography.Title level={5} style={{ textAlign: 'center', marginTop: 4, color: diferencia >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {diferencia >= 0 ? 'Sobrante' : 'Faltante'}: {diferencia >= 0 ? '+' : ''}{formatMoneda(diferencia)}
        </Typography.Title>
      )}
    </Modal>
  );
}
