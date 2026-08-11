import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { App, Card, Row, Col, Select, Input, Button, Typography, Empty, Space, InputNumber } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, DeleteOutlined, FileTextOutlined, UnorderedListOutlined, SlidersOutlined } from '@ant-design/icons';
import { inventarioApi } from '@/api/inventario';
import { almacenesApi } from '@/api/almacenes';
import { productosApi } from '@/api/productos';
import { ApiError } from '@/api/types';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import { MOTIVO_AJUSTE_LABEL, type MotivoAjusteInventario } from '@/types/ajuste-inventario';
import type { Producto } from '@/types/producto';

interface ItemAjuste {
  producto: Producto;
  tipo: 'ajuste_positivo' | 'ajuste_negativo';
  cantidad: number;
  costoUnitario: number;
}

export function AjusteNuevoPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { data: almacenesData } = useQuery({ queryKey: ['almacenes'], queryFn: () => almacenesApi.listar() });
  const almacenes = almacenesData?.data || [];

  const [idAlmacen, setIdAlmacen] = useState<string | undefined>(undefined);
  const [motivo, setMotivo] = useState<MotivoAjusteInventario>('mermas_mal_estado');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemAjuste[]>([]);
  const [guardando, setGuardando] = useState(false);

  const agregarItem = (p: Producto) => {
    if (items.find((i) => i.producto.id === p.id)) return;
    setItems((prev) => [...prev, { producto: p, tipo: 'ajuste_negativo', cantidad: 1, costoUnitario: Number(p.costo_promedio || 0) }]);
  };

  const actualizarItem = (idx: number, cambios: Partial<ItemAjuste>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  };

  const quitarItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const entradas = items.filter((i) => i.tipo === 'ajuste_positivo').length;
  const salidas = items.filter((i) => i.tipo === 'ajuste_negativo').length;

  const registrar = async () => {
    if (!idAlmacen) { message.warning('Seleccione un almacén'); return; }
    if (items.length === 0) { message.warning('Agregue al menos un producto'); return; }
    if (items.some((i) => !(i.cantidad > 0))) { message.warning('Hay ítems con cantidad inválida'); return; }

    setGuardando(true);
    try {
      const res = await inventarioApi.crearAjuste({
        id_almacen: idAlmacen,
        motivo,
        observaciones: observaciones.trim() || undefined,
        detalle: items.map((i) => ({
          id_producto: i.producto.id, tipo: i.tipo, cantidad: i.cantidad, costo_unitario: i.costoUnitario || undefined,
        })),
      });
      message.success(`¡Ajuste ${res.data.numero_interno} registrado correctamente!`);
      navigate('/inventario/ajustes');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar el ajuste');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}><SlidersOutlined style={{ marginRight: 8 }} />Nuevo Ajuste de Inventario</Typography.Title>
        <Link to="/inventario/ajustes"><Button icon={<ArrowLeftOutlined />}>Volver</Button></Link>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title={<><FileTextOutlined style={{ marginRight: 8 }} />Datos del ajuste</>} style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Typography.Text strong style={{ fontSize: 13 }}>Almacén *</Typography.Text>
                <Select value={idAlmacen} onChange={setIdAlmacen} placeholder="Seleccione almacén" style={{ width: '100%', marginTop: 4 }} options={almacenes.map((a) => ({ value: a.id, label: a.nombre }))} />
              </Col>
              <Col xs={24} sm={12}>
                <Typography.Text strong style={{ fontSize: 13 }}>Motivo *</Typography.Text>
                <Select value={motivo} onChange={setMotivo} style={{ width: '100%', marginTop: 4 }} options={Object.entries(MOTIVO_AJUSTE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Col>
              <Col span={24} style={{ marginTop: 12 }}>
                <Typography.Text strong style={{ fontSize: 13 }}>Observaciones</Typography.Text>
                <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Detalle adicional del ajuste..." style={{ marginTop: 4 }} />
              </Col>
            </Row>
          </Card>

          <Card title={<><UnorderedListOutlined style={{ marginRight: 8 }} />Productos del ajuste</>}>
            <div style={{ marginBottom: 16, maxWidth: 360 }}>
              <Autocomplete<Producto>
                placeholder="Buscar por código o nombre..."
                buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
                getLabel={() => ''}
                renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre}</>}
                onSelect={agregarItem}
              />
            </div>

            {items.length === 0 ? (
              <Empty description="Busque y agregue los productos a ajustar" />
            ) : (
              items.map((item, idx) => (
                <Card key={item.producto.id} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <Typography.Text strong>{item.producto.nombre}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{item.producto.codigo}</Typography.Text>
                    </div>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => quitarItem(idx)} />
                  </div>
                  <Row gutter={[8, 8]} align="bottom">
                    <Col xs={12} sm={6}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>Tipo</Typography.Text>
                      <Select
                        size="small" value={item.tipo} onChange={(v) => actualizarItem(idx, { tipo: v })} style={{ width: '100%' }}
                        options={[{ value: 'ajuste_negativo', label: 'Salida (-)' }, { value: 'ajuste_positivo', label: 'Entrada (+)' }]}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>Cantidad</Typography.Text>
                      <InputNumber size="small" value={item.cantidad} onChange={(v) => actualizarItem(idx, { cantidad: v ?? 0 })} min={0.001} step={1} style={{ width: '100%' }} />
                    </Col>
                    <Col xs={12} sm={6}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>Costo unit. referencial</Typography.Text>
                      <Space.Compact style={{ width: '100%' }}>
                        <Button size="small" disabled>S/</Button>
                        <InputNumber size="small" value={item.costoUnitario} onChange={(v) => actualizarItem(idx, { costoUnitario: v ?? 0 })} min={0} step={0.0001} style={{ width: '100%' }} />
                      </Space.Compact>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Costo total ref.</Typography.Text>
                      <Typography.Text strong>{formatMoneda(item.cantidad * item.costoUnitario)}</Typography.Text>
                    </Col>
                  </Row>
                </Card>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen del ajuste" style={{ borderColor: '#faad14', position: 'sticky', top: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Typography.Text type="secondary">Ítems con entrada (+)</Typography.Text>
              <Typography.Text strong style={{ color: '#52c41a' }}>{entradas}</Typography.Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Typography.Text type="secondary">Ítems con salida (-)</Typography.Text>
              <Typography.Text strong style={{ color: '#ff4d4f' }}>{salidas}</Typography.Text>
            </div>
            <Button type="primary" block size="large" icon={<CheckCircleOutlined />} loading={guardando} onClick={registrar} style={{ background: '#faad14', borderColor: '#faad14', marginBottom: 8 }}>
              Registrar Ajuste
            </Button>
            <Link to="/inventario/ajustes"><Button block>Cancelar</Button></Link>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
