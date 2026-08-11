import { useEffect, useState } from 'react';
import { App, Modal, Form, Input, Select, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { clientesApi } from '@/api/clientes';
import { ApiError } from '@/api/types';
import type { Cliente } from '@/types/cliente';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreado: (cliente: Cliente) => void;
}

export function ClienteNuevoModal({ open, onClose, onCreado }: Props) {
  const { message } = App.useApp();
  const [tipo, setTipo] = useState<'RUC' | 'DNI' | 'CE' | 'PASAPORTE'>('DNI');
  const [numero, setNumero] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo('DNI'); setNumero(''); setRazonSocial(''); setTelefono(''); setDireccion('');
  }, [open]);

  const consultar = async () => {
    if (!numero.trim()) { message.warning('Ingrese el número de documento'); return; }
    if (tipo !== 'DNI' && tipo !== 'RUC') { message.warning('Solo se puede consultar DNI o RUC'); return; }
    setConsultando(true);
    try {
      const { data } = await clientesApi.consultarDocumento(tipo.toLowerCase() as 'dni' | 'ruc', numero.trim());
      setRazonSocial(data.razon_social || data.nombre_completo || '');
      if (data.direccion) setDireccion(data.direccion);
      message.success('Datos obtenidos correctamente');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo consultar el documento');
    } finally {
      setConsultando(false);
    }
  };

  const guardar = async () => {
    if (!numero.trim() || !razonSocial.trim()) { message.warning('Complete número de documento y nombre/razón social'); return; }
    setSaving(true);
    try {
      const { data } = await clientesApi.crear({
        tipo_documento: tipo,
        numero_documento: numero.trim(),
        razon_social: razonSocial.trim(),
        telefono: telefono.trim() || undefined,
        direccion: direccion.trim() || undefined,
      });
      message.success('Cliente creado y seleccionado');
      onCreado(data);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nuevo Cliente"
      open={open}
      onCancel={onClose}
      onOk={guardar}
      confirmLoading={saving}
      okText="Guardar y usar en la venta"
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Form layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Form.Item label="Tipo documento">
            <Select value={tipo} onChange={setTipo} options={[
              { value: 'RUC', label: 'RUC' }, { value: 'DNI', label: 'DNI' },
              { value: 'CE', label: 'Carné extranjería' }, { value: 'PASAPORTE', label: 'Pasaporte' },
            ]} />
          </Form.Item>
          <Form.Item label="Número documento" required>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} autoFocus suffix={
              <Button type="text" size="small" icon={<SearchOutlined />} loading={consultando} onClick={consultar} title="Consultar SUNAT/RENIEC" />
            } />
          </Form.Item>
        </div>
        <Form.Item label="Nombre / Razón social" required>
          <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
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
