import { useState } from 'react';
import { App, Modal, Form, Select, InputNumber, Input, Typography } from 'antd';
import { inventarioApi } from '@/api/inventario';
import { productosApi } from '@/api/productos';
import { ApiError } from '@/api/types';
import { Autocomplete } from '@/components/Autocomplete';
import type { Almacen } from '@/types/almacen';
import type { Producto } from '@/types/producto';

interface Props {
  open: boolean;
  almacenes: Almacen[];
  onClose: () => void;
  onSaved: () => void;
}

export function TransferenciaModal({ open, almacenes, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [origen, setOrigen] = useState<string | undefined>(undefined);
  const [destino, setDestino] = useState<string | undefined>(undefined);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setProducto(null); setOrigen(undefined); setDestino(undefined); setCantidad(null); setMotivo(''); };

  const handleClose = () => { reset(); onClose(); };

  const transferir = async () => {
    if (!producto) { message.warning('Busque y seleccione un producto'); return; }
    if (!origen || !destino) { message.warning('Seleccione almacén de origen y destino'); return; }
    if (origen === destino) { message.warning('El almacén de origen y destino no pueden ser el mismo'); return; }
    if (!cantidad || cantidad <= 0) { message.warning('Ingrese una cantidad válida'); return; }

    setSaving(true);
    try {
      await inventarioApi.transferir({
        id_producto: producto.id, id_almacen_origen: origen, id_almacen_destino: destino,
        cantidad, motivo: motivo.trim() || undefined,
      });
      message.success('Transferencia realizada correctamente');
      reset();
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al transferir');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Transferencia entre Almacenes"
      open={open}
      onCancel={handleClose}
      onOk={transferir}
      confirmLoading={saving}
      okText="Transferir"
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label="Producto" required>
          <Autocomplete<Producto>
            placeholder="Buscar por código o nombre..."
            buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
            getLabel={(p) => p.nombre}
            renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre}</>}
            onSelect={setProducto}
          />
          {producto && <Typography.Text type="success" style={{ fontSize: 12 }}>✓ {producto.codigo} — {producto.nombre}</Typography.Text>}
        </Form.Item>

        <Form.Item label="Almacén origen" required>
          <Select value={origen} onChange={setOrigen} placeholder="Seleccione" options={almacenes.map((a) => ({ value: a.id, label: a.nombre }))} />
        </Form.Item>
        <Form.Item label="Almacén destino" required>
          <Select value={destino} onChange={setDestino} placeholder="Seleccione" options={almacenes.map((a) => ({ value: a.id, label: a.nombre }))} />
        </Form.Item>
        <Form.Item label="Cantidad" required>
          <InputNumber value={cantidad} onChange={setCantidad} min={0.001} step={0.001} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Motivo">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
