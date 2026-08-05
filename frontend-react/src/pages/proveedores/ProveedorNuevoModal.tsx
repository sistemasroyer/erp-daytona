import { useEffect, useState } from 'react';
import { App, Modal, Form, Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { proveedoresApi } from '@/api/proveedores';
import { ApiError } from '@/api/types';
import type { Proveedor } from '@/types/proveedor';

interface Props {
  open: boolean;
  rucInicial?: string;
  razonSocialInicial?: string;
  onClose: () => void;
  onCreado: (proveedor: Proveedor) => void;
}

export function ProveedorNuevoModal({ open, rucInicial, razonSocialInicial, onClose, onCreado }: Props) {
  const { message } = App.useApp();
  const [ruc, setRuc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRuc(rucInicial || '');
    setRazonSocial(razonSocialInicial || '');
    setDireccion('');
    setTelefono('');
  }, [open, rucInicial, razonSocialInicial]);

  const consultar = async () => {
    if (!ruc.trim() || ruc.trim().length !== 11) { message.warning('Ingrese un RUC válido (11 dígitos)'); return; }
    setConsultando(true);
    try {
      const { data } = await proveedoresApi.consultarRuc(ruc.trim());
      setRazonSocial(data.razon_social || data.nombre_completo || '');
      if (data.direccion) setDireccion(data.direccion);
      message.success('Datos obtenidos correctamente');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo consultar el RUC');
    } finally {
      setConsultando(false);
    }
  };

  const guardar = async () => {
    if (!ruc.trim() || ruc.trim().length !== 11) { message.warning('Ingrese un RUC válido (11 dígitos)'); return; }
    if (!razonSocial.trim()) { message.warning('Ingrese la razón social'); return; }
    setSaving(true);
    try {
      const { data } = await proveedoresApi.crear({
        ruc: ruc.trim(),
        razon_social: razonSocial.trim(),
        direccion: direccion.trim() || undefined,
        telefono: telefono.trim() || undefined,
      });
      message.success('Proveedor creado y seleccionado');
      onCreado(data);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el proveedor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nuevo Proveedor"
      open={open}
      onCancel={onClose}
      onOk={guardar}
      confirmLoading={saving}
      okText="Guardar y usar"
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label="RUC" required>
          <Input value={ruc} onChange={(e) => setRuc(e.target.value)} maxLength={11} autoFocus suffix={
            <Button type="text" size="small" icon={<SearchOutlined />} loading={consultando} onClick={consultar} title="Consultar SUNAT" />
          } />
        </Form.Item>
        <Form.Item label="Razón social" required>
          <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Form.Item>
          <Form.Item label="Dirección">
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
