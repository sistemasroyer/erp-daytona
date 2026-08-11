import { useEffect, useState } from 'react';
import { App, Modal, Form, Select, DatePicker, Input, Typography, Button, InputNumber, Row, Col, Empty, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { ordenesCompraApi } from '@/api/ordenes-compra';
import { proveedoresApi } from '@/api/proveedores';
import { productosApi } from '@/api/productos';
import { ApiError } from '@/api/types';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import { useBorrador, listarBorradores, descartarBorrador, type BorradorGuardado } from '@/hooks/useBorrador';
import { BorradorBanner } from '@/components/BorradorBanner';
import type { Proveedor } from '@/types/proveedor';
import type { Producto } from '@/types/producto';

interface ItemOrden {
  producto: Producto;
  cantidad: number;
  precio: number;
}

interface BorradorOrden {
  proveedor: Proveedor | null;
  moneda: 'PEN' | 'USD';
  fechaRequerida: string | null;
  observaciones: string;
  items: ItemOrden[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function OrdenNuevaModal({ open, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [fechaRequerida, setFechaRequerida] = useState<Dayjs | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setProveedor(null); setMoneda('PEN'); setFechaRequerida(null); setObservaciones(''); setItems([]);
  };
  // No reseteamos el estado acá: el modal usa destroyOnHidden y se desmonta solo al cerrarse,
  // y resetear en memoria antes de eso disparaba el efecto "vacío" del borrador y lo borraba.
  const handleClose = () => onClose();

  // Borrador local (recuperación ante corte de luz/internet o cierre accidental)
  const [borradores, setBorradores] = useState<BorradorGuardado<BorradorOrden>[]>([]);
  const datosBorrador: BorradorOrden = { proveedor, moneda, fechaRequerida: fechaRequerida ? fechaRequerida.format('YYYY-MM-DD') : null, observaciones, items };
  const { limpiar: limpiarBorrador } = useBorrador('orden-compra', datosBorrador, {
    vacio: (d) => !d.proveedor && d.items.length === 0,
  });

  useEffect(() => {
    if (open) setBorradores(listarBorradores<BorradorOrden>('orden-compra'));
  }, [open]);

  const restaurarBorrador = (b: BorradorGuardado<BorradorOrden>) => {
    const d = b.datos;
    setProveedor(d.proveedor);
    setMoneda(d.moneda);
    setFechaRequerida(d.fechaRequerida ? dayjs(d.fechaRequerida) : null);
    setObservaciones(d.observaciones);
    setItems(d.items);
    descartarBorrador(b.clave);
    setBorradores((prev) => prev.filter((x) => x.clave !== b.clave));
  };

  const descartarBorradorLista = (clave: string) => {
    descartarBorrador(clave);
    setBorradores((prev) => prev.filter((x) => x.clave !== clave));
  };

  const agregarItem = (p: Producto) => {
    if (items.find((i) => i.producto.id === p.id)) return;
    setItems((prev) => [...prev, { producto: p, cantidad: 1, precio: Number(p.precio_compra_sin_igv || 0) }]);
  };
  const actualizarItem = (idx: number, cambios: Partial<ItemOrden>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  const quitarItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const guardar = async () => {
    if (!proveedor) { message.warning('Seleccione un proveedor'); return; }
    if (items.length === 0) { message.warning('Agregue productos'); return; }
    setSaving(true);
    try {
      await ordenesCompraApi.crear({
        id_proveedor: proveedor.id,
        moneda,
        fecha_requerida: fechaRequerida ? fechaRequerida.format('YYYY-MM-DD') : undefined,
        observaciones: observaciones.trim() || undefined,
        detalle: items.map((i) => ({ id_producto: i.producto.id, cantidad: i.cantidad, precio_referencial: i.precio })),
      });
      message.success('Orden creada correctamente');
      limpiarBorrador();
      reset();
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al crear la orden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nueva Orden de Compra"
      open={open}
      onCancel={handleClose}
      onOk={guardar}
      confirmLoading={saving}
      okText="Crear Orden"
      cancelText="Cancelar"
      width={800}
      destroyOnHidden
    >
      <BorradorBanner
        borradores={borradores}
        resumen={(d) => `${d.proveedor ? d.proveedor.razon_social : 'Sin proveedor'} — ${d.items.length} ítem(s)`}
        onRestaurar={restaurarBorrador}
        onDescartar={descartarBorradorLista}
      />
      <Form layout="vertical">
        <Row gutter={[16, 8]}>
          <Col xs={24} md={12}>
            <Form.Item label="Proveedor" required>
              <Autocomplete<Proveedor>
                placeholder="Buscar proveedor..."
                buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 5 })).data}
                getLabel={(p) => p.razon_social}
                renderOpcion={(p) => <>{p.razon_social} <Typography.Text type="secondary">({p.ruc})</Typography.Text></>}
                onSelect={setProveedor}
              />
              {proveedor && <Typography.Text type="success" style={{ fontSize: 12 }}>✓ {proveedor.razon_social}</Typography.Text>}
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Moneda">
              <Select value={moneda} onChange={setMoneda} options={[{ value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Fecha requerida">
              <DatePicker value={fechaRequerida} onChange={setFechaRequerida} style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Observaciones">
              <Input.TextArea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong>Productos</Typography.Text>
        </div>
        <div style={{ maxWidth: 400, marginBottom: 12 }}>
          <Autocomplete<Producto>
            placeholder="Buscar por código o nombre..."
            buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
            getLabel={() => ''}
            renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre}</>}
            onSelect={agregarItem}
          />
        </div>

        {items.length === 0 ? <Empty description="Agregue productos" /> : items.map((item, idx) => (
          <Row key={item.producto.id} gutter={8} align="middle" style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, marginBottom: 8 }}>
            <Col span={9}>
              <Typography.Text strong>{item.producto.nombre}</Typography.Text>
              <br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.producto.codigo}</Typography.Text>
            </Col>
            <Col span={5}>
              <Space.Compact style={{ width: '100%' }}>
                <Button size="small" disabled>Cant.</Button>
                <InputNumber size="small" min={0.001} step={1} value={item.cantidad} onChange={(v) => actualizarItem(idx, { cantidad: v ?? 0 })} style={{ width: '100%' }} />
              </Space.Compact>
            </Col>
            <Col span={6}>
              <Space.Compact style={{ width: '100%' }}>
                <Button size="small" disabled>S/</Button>
                <InputNumber size="small" min={0} step={0.01} value={item.precio} onChange={(v) => actualizarItem(idx, { precio: v ?? 0 })} style={{ width: '100%' }} />
              </Space.Compact>
            </Col>
            <Col span={3}>
              <Typography.Text strong>{formatMoneda(item.cantidad * item.precio, moneda)}</Typography.Text>
            </Col>
            <Col span={1}>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => quitarItem(idx)} />
            </Col>
          </Row>
        ))}
      </Form>
    </Modal>
  );
}
