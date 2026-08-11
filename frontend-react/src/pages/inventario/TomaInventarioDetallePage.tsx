import { useEffect, useRef, useState } from 'react';
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
import type { DetalleTomaInventario, TomaInventario } from '@/types/toma-inventario';
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
  const [cantidadEntrada, setCantidadEntrada] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

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
    setCantidadEntrada(null); // el conteo tiene que arrancar vacío, sin sugerir el stock del sistema
  };

  const agregarProducto = async () => {
    if (!productoEntrada || !toma || cantidadEntrada === null) return;
    setAgregando(true);
    try {
      await tomaInventarioApi.agregarItem(toma.id, { id_producto: productoEntrada.id, cantidad_contada: cantidadEntrada });
      setProductoEntrada(null);
      setCantidadEntrada(null);
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al agregar el producto');
    } finally {
      setAgregando(false);
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
            <div style={{ flex: '1 1 130px' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Cantidad contada</Typography.Text>
              <InputNumber
                min={0} step={1} value={cantidadEntrada} disabled={!productoEntrada}
                placeholder="Ingrese la cantidad"
                onChange={(v) => setCantidadEntrada(v)}
                style={{ width: '100%' }}
              />
            </div>
            <Button type="primary" icon={<PlusOutlined />} disabled={!productoEntrada || cantidadEntrada === null} loading={agregando} onClick={agregarProducto} style={{ flex: '0 0 auto' }}>
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
          {toma.detalle.map((d) => (
            <ItemCard key={d.id} toma={toma} detalle={d} enProceso={!!enProceso} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ toma, detalle, enProceso }: { toma: TomaInventario; detalle: DetalleTomaInventario; enProceso: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [cantidad, setCantidad] = useState(Number(detalle.cantidad_contada));
  const [observaciones, setObservaciones] = useState(detalle.observaciones || '');
  const [editandoUbicacion, setEditandoUbicacion] = useState(false);
  const [ubicacionInput, setUbicacionInput] = useState('');
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);
  const tocado = useRef(false);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['toma-inventario', toma.id] });

  useEffect(() => {
    if (!tocado.current) return;
    const t = setTimeout(async () => {
      try {
        await tomaInventarioApi.agregarItem(toma.id, { id_producto: detalle.id_producto, cantidad_contada: cantidad, observaciones: observaciones || undefined });
        refrescar();
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : 'Error al guardar los cambios');
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidad, observaciones]);

  const quitar = async () => {
    try {
      await tomaInventarioApi.quitarItem(toma.id, detalle.id_producto);
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al quitar el producto');
    }
  };

  const abrirEdicionUbicacion = () => {
    setUbicacionInput(detalle.producto?.ubicacion || '');
    setEditandoUbicacion(true);
  };

  const guardarUbicacion = async () => {
    setGuardandoUbicacion(true);
    try {
      await productosApi.actualizar(detalle.id_producto, { ubicacion: ubicacionInput.trim() || undefined });
      setEditandoUbicacion(false);
      refrescar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar la ubicación');
    } finally {
      setGuardandoUbicacion(false);
    }
  };

  const dif = Number(detalle.diferencia);
  const colorBorde = dif > 0 ? '#b7eb8f' : dif < 0 ? '#ffa39e' : '#f0f0f0';

  return (
    <Card size="small" style={{ borderColor: colorBorde, borderWidth: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <Typography.Text strong style={{ display: 'block', overflowWrap: 'break-word' }}>{detalle.producto?.nombre || '-'}</Typography.Text>
          <Space size={4} wrap style={{ marginTop: 4 }}>
            <Tag>{detalle.producto?.codigo}</Tag>
            {editandoUbicacion ? null : detalle.producto?.ubicacion
              ? <Tag icon={<EnvironmentOutlined />} color="blue">{detalle.producto.ubicacion}</Tag>
              : <Tag icon={<EnvironmentOutlined />}>Sin ubicación</Tag>}
            {enProceso && !editandoUbicacion && (
              <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} icon={<EditOutlined />} onClick={abrirEdicionUbicacion}>
                Editar ubicación
              </Button>
            )}
          </Space>
          {editandoUbicacion && (
            <Space.Compact style={{ marginTop: 6, width: '100%', maxWidth: 260 }}>
              <Input
                size="small" autoFocus value={ubicacionInput} placeholder="Ej: A-01, PASILLO-3"
                onChange={(e) => setUbicacionInput(e.target.value.toUpperCase())}
                onPressEnter={guardarUbicacion}
              />
              <Button size="small" type="primary" loading={guardandoUbicacion} onClick={guardarUbicacion}>Guardar</Button>
              <Button size="small" onClick={() => setEditandoUbicacion(false)}>Cancelar</Button>
            </Space.Compact>
          )}
        </div>

        <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Stock sistema: {fmtCantidad(detalle.stock_sistema)}</Typography.Text>
          {enProceso ? (
            <InputNumber
              size="large" min={0} step={1} value={cantidad}
              onChange={(v) => { tocado.current = true; setCantidad(v ?? 0); }}
              style={{ width: 120, marginTop: 4, fontWeight: 700 }}
            />
          ) : (
            <Typography.Text strong style={{ fontSize: 20, display: 'block' }}>{fmtCantidad(detalle.cantidad_contada)}</Typography.Text>
          )}
          <Typography.Text strong type={dif === 0 ? undefined : dif > 0 ? 'success' : 'danger'} style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            {dif === 0 ? 'sin diferencia' : `${dif > 0 ? '+' : ''}${fmtCantidad(dif)} ${dif > 0 ? 'sobra' : 'falta'}`}
          </Typography.Text>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Observación</Typography.Text>
        {enProceso ? (
          <Input.TextArea
            size="small" rows={2} value={observaciones}
            onChange={(e) => { tocado.current = true; setObservaciones(e.target.value); }}
            placeholder="Ej: producto en mal estado, caja rota, diferencia justificada…"
          />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{detalle.observaciones || '—'}</Typography.Text>
        )}
      </div>

      {enProceso && (
        <Button size="small" danger icon={<DeleteOutlined />} style={{ marginTop: 8 }} onClick={quitar}>
          Quitar
        </Button>
      )}
    </Card>
  );
}
