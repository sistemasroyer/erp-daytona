import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Typography, Button, InputNumber, Input, Space, Empty, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, StopOutlined, ArrowLeftOutlined, EnvironmentOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tomaInventarioApi } from '@/api/toma-inventario';
import { productosApi } from '@/api/productos';
import { Autocomplete } from '@/components/Autocomplete';
import { EstadoTag } from '@/components/EstadoTag';
import { useConfirmar } from '@/components/ConfirmModal';
import { ApiError } from '@/api/types';
import type { DetalleTomaInventario } from '@/types/toma-inventario';
import type { Producto } from '@/types/producto';

function fmtCantidad(v: string | number) {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function TomaInventarioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();

  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null);
  const [cantidadEntrada, setCantidadEntrada] = useState(0);
  const [agregando, setAgregando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [editandoUbicacion, setEditandoUbicacion] = useState<string | null>(null);
  const [ubicacionInput, setUbicacionInput] = useState('');
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);
  const editTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data, isFetching } = useQuery({
    queryKey: ['toma-inventario', id],
    queryFn: () => tomaInventarioApi.obtener(id!),
    enabled: !!id,
  });
  const toma = data?.data;
  const enProceso = toma?.estado === 'en_proceso';

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['toma-inventario', id] });

  const seleccionarProducto = (p: Producto) => {
    setProductoEntrada(p);
    setCantidadEntrada(Number(p.stock_actual));
  };

  const agregarProducto = async () => {
    if (!productoEntrada || !toma) return;
    setAgregando(true);
    try {
      await tomaInventarioApi.agregarItem(toma.id, { id_producto: productoEntrada.id, cantidad_contada: cantidadEntrada });
      setProductoEntrada(null);
      setCantidadEntrada(0);
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al agregar el producto');
    } finally {
      setAgregando(false);
    }
  };

  const actualizarCantidad = (idProducto: string, cantidad: number) => {
    if (!toma) return;
    if (editTimers.current[idProducto]) clearTimeout(editTimers.current[idProducto]);
    editTimers.current[idProducto] = setTimeout(async () => {
      try {
        await tomaInventarioApi.agregarItem(toma.id, { id_producto: idProducto, cantidad_contada: cantidad });
        refrescar();
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : 'Error al actualizar la cantidad');
      }
    }, 600);
  };

  const quitarProducto = async (idProducto: string) => {
    if (!toma) return;
    try {
      await tomaInventarioApi.quitarItem(toma.id, idProducto);
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al quitar el producto');
    }
  };

  const abrirEdicionUbicacion = (idProducto: string, ubicacionActual: string | null) => {
    setEditandoUbicacion(idProducto);
    setUbicacionInput(ubicacionActual || '');
  };

  const guardarUbicacion = async (idProducto: string) => {
    setGuardandoUbicacion(true);
    try {
      await productosApi.actualizar(idProducto, { ubicacion: ubicacionInput.trim() || undefined });
      setEditandoUbicacion(null);
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar la ubicación');
    } finally {
      setGuardandoUbicacion(false);
    }
  };

  const finalizar = async () => {
    if (!toma) return;
    const ok = await confirmar(
      `¿Finalizar la toma ${toma.numero_interno}? Se congelan el stock del sistema y la diferencia de cada línea con su valor actual, y ya no se podrán agregar ni editar productos contados. Esto no modifica el stock — si hay diferencias a corregir, se hace aparte desde Ajustes de Inventario.`,
      'Finalizar Toma de Inventario',
    );
    if (!ok) return;
    setFinalizando(true);
    try {
      await tomaInventarioApi.finalizar(toma.id);
      message.success('Toma de inventario finalizada');
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al finalizar la toma de inventario');
    } finally {
      setFinalizando(false);
    }
  };

  const anular = async () => {
    if (!toma) return;
    const ok = await confirmar(`¿Anular la toma ${toma.numero_interno}? No se aplicará ninguna corrección de stock.`, 'Anular Toma de Inventario');
    if (!ok) return;
    try {
      await tomaInventarioApi.anular(toma.id);
      message.success('Toma de inventario anulada');
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al anular la toma de inventario');
    }
  };

  if (isFetching && !toma) return null;
  if (!toma) return <Empty description="Toma de inventario no encontrada" style={{ marginTop: 48 }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Link to="/inventario/tomas"><Button icon={<ArrowLeftOutlined />} /></Link>
          <Typography.Title level={4} style={{ margin: 0 }}>{toma.numero_interno}</Typography.Title>
          <EstadoTag estado={toma.estado} />
        </Space>
        {enProceso && (
          <Space wrap>
            <Button danger icon={<StopOutlined />} onClick={anular}>Anular</Button>
            <Button type="primary" icon={<CheckOutlined />} loading={finalizando} onClick={finalizar}>Finalizar Toma</Button>
          </Space>
        )}
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Responsable</Typography.Text>
            <Typography.Text strong>{toma.usuario ? `${toma.usuario.nombre} ${toma.usuario.apellido}` : '-'}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Inicio</Typography.Text>
            <Typography.Text strong>{dayjs(toma.fecha_inicio).format('DD/MM/YYYY HH:mm')}</Typography.Text>
          </div>
          {toma.fecha_finalizacion && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Finalización</Typography.Text>
              <Typography.Text strong>{dayjs(toma.fecha_finalizacion).format('DD/MM/YYYY HH:mm')}</Typography.Text>
            </div>
          )}
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Almacén</Typography.Text>
            <Typography.Text strong>{toma.almacen?.nombre || '-'}</Typography.Text>
          </div>
        </div>
      </Card>

      {enProceso && (
        <Card size="small" title="Buscar producto" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
            <div style={{ flex: '1 1 260px' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Código o nombre</Typography.Text>
              <Autocomplete<Producto>
                placeholder="Buscar producto..."
                value={productoEntrada ? `${productoEntrada.codigo} — ${productoEntrada.nombre}` : ''}
                buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
                getLabel={(p) => `${p.codigo} — ${p.nombre}`}
                renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre} {p.ubicacion && <Tag style={{ marginLeft: 4 }}>{p.ubicacion}</Tag>}</>}
                onSelect={seleccionarProducto}
              />
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Stock sistema</Typography.Text>
              <div style={{ background: '#f5f5f5', borderRadius: 6, padding: '4px 11px', textAlign: 'right' }}>
                {productoEntrada ? fmtCantidad(productoEntrada.stock_actual) : '—'}
              </div>
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Cantidad contada</Typography.Text>
              <InputNumber min={0} step={1} value={cantidadEntrada} disabled={!productoEntrada} onChange={(v) => setCantidadEntrada(v ?? 0)} style={{ width: '100%' }} />
            </div>
            <Button type="primary" icon={<PlusOutlined />} disabled={!productoEntrada} loading={agregando} onClick={agregarProducto} style={{ flex: '0 0 auto' }}>
              Agregar
            </Button>
          </div>
        </Card>
      )}

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        Productos contados ({toma.detalle?.length ?? 0})
      </Typography.Text>

      {!toma.detalle || toma.detalle.length === 0 ? (
        <Card size="small"><Empty description="Todavía no se contó ningún producto" /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {toma.detalle.map((d: DetalleTomaInventario) => {
            const dif = Number(d.diferencia);
            const editandoEsta = editandoUbicacion === d.id_producto;
            return (
              <Card key={d.id} size="small" style={{ borderColor: dif !== 0 ? undefined : '#f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <Typography.Text strong style={{ display: 'block', overflowWrap: 'break-word' }}>{d.producto?.nombre || '-'}</Typography.Text>
                    <Space size={4} wrap style={{ marginTop: 4 }}>
                      <Tag>{d.producto?.codigo}</Tag>
                      {editandoEsta ? null : d.producto?.ubicacion
                        ? <Tag icon={<EnvironmentOutlined />} color="blue">{d.producto.ubicacion}</Tag>
                        : <Tag icon={<EnvironmentOutlined />}>Sin ubicación</Tag>}
                      {enProceso && !editandoEsta && (
                        <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} icon={<EditOutlined />} onClick={() => abrirEdicionUbicacion(d.id_producto, d.producto?.ubicacion ?? null)}>
                          Editar ubicación
                        </Button>
                      )}
                    </Space>
                    {editandoEsta && (
                      <Space.Compact style={{ marginTop: 6, width: '100%', maxWidth: 260 }}>
                        <Input
                          size="small" autoFocus value={ubicacionInput} placeholder="Ej: A-01, PASILLO-3"
                          onChange={(e) => setUbicacionInput(e.target.value.toUpperCase())}
                          onPressEnter={() => guardarUbicacion(d.id_producto)}
                        />
                        <Button size="small" type="primary" loading={guardandoUbicacion} onClick={() => guardarUbicacion(d.id_producto)}>Guardar</Button>
                        <Button size="small" onClick={() => setEditandoUbicacion(null)}>Cancelar</Button>
                      </Space.Compact>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Stock sistema: {fmtCantidad(d.stock_sistema)}</Typography.Text>
                    {enProceso ? (
                      <InputNumber
                        size="small" min={0} step={1} defaultValue={Number(d.cantidad_contada)}
                        onChange={(v) => actualizarCantidad(d.id_producto, v ?? 0)}
                        style={{ width: 110, marginTop: 4 }}
                      />
                    ) : (
                      <Typography.Text strong style={{ fontSize: 18, display: 'block' }}>{fmtCantidad(d.cantidad_contada)}</Typography.Text>
                    )}
                    <Typography.Text strong type={dif === 0 ? undefined : dif > 0 ? 'success' : 'danger'} style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                      {dif === 0 ? 'sin diferencia' : `${dif > 0 ? '+' : ''}${fmtCantidad(dif)} ${dif > 0 ? 'sobra' : 'falta'}`}
                    </Typography.Text>
                  </div>
                </div>

                {enProceso && (
                  <Button size="small" danger icon={<DeleteOutlined />} style={{ marginTop: 8 }} onClick={() => quitarProducto(d.id_producto)}>
                    Quitar
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
