import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Link } from 'react-router-dom';
import { App, Card, Select, Input, Button, Typography, InputNumber, Space, Collapse } from 'antd';
import { CheckOutlined, UserAddOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { ventasApi } from '@/api/ventas';
import { clientesApi } from '@/api/clientes';
import { productosApi } from '@/api/productos';
import { seriesDocumentoApi } from '@/api/series-documento';
import { metodosPagoApi } from '@/api/metodos-pago';
import { cajaApi } from '@/api/caja';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { useAuth } from '@/auth/AuthContext';
import { ClienteNuevoModal } from './ClienteNuevoModal';
import type { Cliente } from '@/types/cliente';
import type { Producto } from '@/types/producto';
import type { SerieDocumento } from '@/types/serie-documento';
import type { MetodoPago } from '@/types/metodo-pago';

interface ItemVenta {
  producto: Producto;
  cantidad: number;
  precio_tipo: number;
  precio: number;
}

interface PagoState {
  id_metodo_pago: string;
  monto: number;
}

const TEXTO_BOTON: Record<string, string> = {
  FACTURA: 'Emitir Factura', BOLETA: 'Emitir Boleta',
  NOTA_VENTA: 'Registrar Nota de Venta', COTIZACION: 'Registrar Cotización',
};

function preciosDisponibles(producto: Producto): { numero: number; valor: number }[] {
  return [1, 2, 3, 4, 5]
    .map((n) => ({ numero: n, valor: Number((producto as unknown as Record<string, string>)[`precio_venta_${n}`] || 0) }))
    .filter((p) => p.valor > 0);
}

export function NuevaVentaPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const idPuntoVenta = user?.idPuntoVenta || undefined;

  // Cabecera
  const [tipoDocumento, setTipoDocumento] = useState<'BOLETA' | 'FACTURA' | 'NOTA_VENTA' | 'COTIZACION'>('BOLETA');
  const [series, setSeries] = useState<SerieDocumento[]>([]);
  const [idSerie, setIdSerie] = useState<string | undefined>(undefined);
  const [mostrarObs, setMostrarObs] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [idCajaApertura, setIdCajaApertura] = useState<string | undefined>(undefined);
  const [cajaLabel, setCajaLabel] = useState<string | null>(null);

  // Cliente
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteResultados, setClienteResultados] = useState<Cliente[]>([]);
  const [mostrarClienteResultados, setMostrarClienteResultados] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [modalClienteNuevo, setModalClienteNuevo] = useState(false);
  const clienteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clienteBoxRef = useRef<HTMLDivElement>(null);

  // Entrada de producto
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [codigoInput, setCodigoInput] = useState('');
  const [sugerencias, setSugerencias] = useState<Producto[]>([]);
  const [sugerenciaActiva, setSugerenciaActiva] = useState(-1);
  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null);
  const [cantidadEntrada, setCantidadEntrada] = useState(1);
  const [precioTipoEntrada, setPrecioTipoEntrada] = useState<number | undefined>(undefined);
  const entradaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codigoInputRef = useRef<ComponentRef<typeof Input>>(null);
  const cantidadInputRef = useRef<ComponentRef<typeof InputNumber>>(null);
  const precioSelectRef = useRef<ComponentRef<typeof Select>>(null);
  const entradaBoxRef = useRef<HTMLDivElement>(null);

  // Pagos
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [pagos, setPagos] = useState<PagoState[]>([]);

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [resMetodos, resSeries] = await Promise.all([
          metodosPagoApi.listar(),
          seriesDocumentoApi.listar(idPuntoVenta),
        ]);
        setMetodosPago(resMetodos.data);
        setSeries(resSeries.data.filter((s) => s.activo));
        if (resMetodos.data.length) setPagos([{ id_metodo_pago: resMetodos.data[0].id, monto: 0 }]);

        try {
          const apertura = await cajaApi.miAperturaActiva();
          if (apertura) { setIdCajaApertura(apertura.id); setCajaLabel(`${apertura.caja?.nombre || 'Caja'} (abierta)`); }
        } catch { /* sin caja activa */ }
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : 'Error al cargar datos iniciales');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteBoxRef.current && !clienteBoxRef.current.contains(e.target as Node)) setMostrarClienteResultados(false);
      if (entradaBoxRef.current && !entradaBoxRef.current.contains(e.target as Node)) setSugerencias([]);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const seriesDisponibles = series.filter((s) => s.tipo_documento === tipoDocumento);
  useEffect(() => {
    setIdSerie(seriesDisponibles[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDocumento, series]);

  // ==================== CLIENTE ====================
  const buscarCliente = (q: string) => {
    setClienteQuery(q);
    if (clienteTimerRef.current) clearTimeout(clienteTimerRef.current);
    if (q.trim().length < 2) { setClienteResultados([]); setMostrarClienteResultados(false); return; }
    clienteTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await clientesApi.listar({ search: q.trim(), limit: 8 });
        setClienteResultados(data);
        setMostrarClienteResultados(data.length > 0);
      } catch { /* búsqueda silenciosa */ }
    }, 350);
  };

  const seleccionarCliente = (c: Cliente) => {
    setCliente(c);
    setClienteQuery(c.razon_social);
    setMostrarClienteResultados(false);
  };

  const usarClienteGenerico = async () => {
    try {
      const { data } = await clientesApi.listar({ search: 'Clientes varios', limit: 1 });
      if (data.length) seleccionarCliente(data[0]);
      else message.warning('No se encontró cliente genérico en el sistema');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al buscar cliente genérico');
    }
  };

  // ==================== ENTRADA DE PRODUCTO ====================
  const resetEntrada = () => {
    setProductoEntrada(null);
    setCantidadEntrada(1);
    setPrecioTipoEntrada(undefined);
  };

  const seleccionarProductoEntrada = (p: Producto) => {
    setProductoEntrada(p);
    setCodigoInput(p.codigo);
    setSugerencias([]);
    const precios = preciosDisponibles(p);
    setPrecioTipoEntrada(precios[0]?.numero);
    setCantidadEntrada(1);
    setTimeout(() => { cantidadInputRef.current?.focus(); cantidadInputRef.current?.select(); }, 0);
  };

  const buscarSugerencias = (q: string) => {
    setCodigoInput(q);
    if (productoEntrada) resetEntrada();
    if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
    if (!q.trim()) { setSugerencias([]); return; }
    entradaTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await productosApi.listar({ search: q.trim(), limit: 8 });
        setSugerencias(data);
        setSugerenciaActiva(-1);
      } catch { /* búsqueda silenciosa */ }
    }, 200);
  };

  const confirmarFilaEntrada = () => {
    if (!productoEntrada || !precioTipoEntrada) return;
    const cantidad = Math.max(1, cantidadEntrada || 1);
    const precio = Number((productoEntrada as unknown as Record<string, string>)[`precio_venta_${precioTipoEntrada}`] || productoEntrada.precio_venta_1);
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === productoEntrada.id && i.precio_tipo === precioTipoEntrada);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + cantidad };
        return next;
      }
      return [...prev, { producto: productoEntrada, cantidad, precio_tipo: precioTipoEntrada, precio }];
    });
    setCodigoInput('');
    resetEntrada();
    codigoInputRef.current?.focus();
  };

  const handleCodigoKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!sugerencias.length) return;
      setSugerenciaActiva((prev) => (prev + 1) % sugerencias.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!sugerencias.length) return;
      setSugerenciaActiva((prev) => (prev - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === 'Escape') {
      setSugerencias([]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugerenciaActiva >= 0 && sugerencias[sugerenciaActiva]) {
        seleccionarProductoEntrada(sugerencias[sugerenciaActiva]);
        return;
      }
      const q = codigoInput.trim();
      if (!q) return;
      try {
        const { data: prods } = await productosApi.listar({ search: q, limit: 8 });
        const exacto = prods.find((p) => p.codigo?.toLowerCase() === q.toLowerCase());
        if (exacto) { seleccionarProductoEntrada(exacto); return; }
        if (prods.length === 1) { seleccionarProductoEntrada(prods[0]); return; }
        if (prods.length > 1) { setSugerencias(prods); setSugerenciaActiva(0); return; }
        message.warning('Producto no encontrado');
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : 'Error al buscar producto');
      }
    }
  };

  const quitarItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const actualizarItem = (idx: number, cambios: Partial<ItemVenta>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));

  // ==================== TOTALES / PAGOS ====================
  const totalVenta = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const subtotalVenta = totalVenta / 1.18;
  const igvVenta = totalVenta - subtotalVenta;
  const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);

  useEffect(() => {
    if (pagos.length === 1) {
      setPagos([{ ...pagos[0], monto: Math.round(totalVenta * 100) / 100 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalVenta]);

  const agregarPago = () => {
    if (pagos.length >= 3) { message.warning('Máximo 3 métodos de pago'); return; }
    setPagos((prev) => [...prev, { id_metodo_pago: metodosPago[0]?.id || '', monto: 0 }]);
  };
  const quitarPago = (idx: number) => setPagos((prev) => prev.filter((_, i) => i !== idx));
  const actualizarPago = (idx: number, cambios: Partial<PagoState>) => setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, ...cambios } : p)));

  // ==================== RESET / GUARDAR ====================
  const resetearFormulario = () => {
    setItems([]);
    setCodigoInput('');
    resetEntrada();
    setSugerencias([]);
    setPagos(metodosPago.length ? [{ id_metodo_pago: metodosPago[0].id, monto: 0 }] : []);
    setCliente(null);
    setClienteQuery('');
    setObservaciones('');
    setMostrarObs(false);
    setTipoDocumento('BOLETA');
  };

  const guardar = async () => {
    const esOficial = tipoDocumento === 'FACTURA' || tipoDocumento === 'BOLETA';
    if (!cliente) { message.warning('Seleccione un cliente'); return; }
    if (!idSerie) { message.warning('No hay una serie configurada para este tipo de documento. Configúrela en Configuración → Series.'); return; }
    if (items.length === 0) { message.warning('Agregue al menos un producto'); return; }

    const pagosValidos = pagos.filter((p) => p.monto > 0 && p.id_metodo_pago);
    const totalPagadoValido = pagosValidos.reduce((s, p) => s + p.monto, 0);
    if (esOficial && totalPagadoValido + 0.01 < totalVenta) {
      message.warning(`${tipoDocumento === 'FACTURA' ? 'La factura' : 'La boleta'} requiere el pago completo (falta ${formatMoneda(totalVenta - totalPagadoValido)})`);
      return;
    }

    setGuardando(true);
    try {
      const { data: venta } = await ventasApi.crear({
        tipo_documento: tipoDocumento,
        id_serie_documento: idSerie,
        id_cliente: cliente.id,
        moneda: 'PEN',
        observaciones: observaciones || undefined,
        id_caja_apertura: idCajaApertura,
        detalle: items.map((i) => ({ id_producto: i.producto.id, cantidad: i.cantidad, precio_tipo: i.precio_tipo })),
        pagos: pagosValidos.length ? pagosValidos : undefined,
      });

      const ventaEsOficial = venta.tipo_documento === 'FACTURA' || venta.tipo_documento === 'BOLETA';
      message.success(ventaEsOficial
        ? '¡Documento emitido! Recuerda enviarlo a SUNAT desde "Facturación → Enviar a SUNAT".'
        : '¡Documento emitido correctamente!');
      window.open(`/ventas/imprimir?id=${venta.id}`, '_blank');
      resetearFormulario();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar la venta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 200px', gap: 12, alignItems: 'end' }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Documento *</Typography.Text>
            <Select
              value={tipoDocumento} onChange={setTipoDocumento} style={{ width: '100%' }} size="small"
              options={[{ value: 'BOLETA', label: 'Boleta' }, { value: 'FACTURA', label: 'Factura' }, { value: 'NOTA_VENTA', label: 'Nota de Venta' }, { value: 'COTIZACION', label: 'Cotización' }]}
            />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Serie *</Typography.Text>
            <Select
              value={idSerie} onChange={setIdSerie} style={{ width: '100%' }} size="small"
              placeholder={seriesDisponibles.length ? 'Seleccione' : 'Sin series configuradas'}
              options={seriesDisponibles.map((s) => ({ value: s.id, label: s.serie }))}
            />
          </div>
          <div ref={clienteBoxRef} style={{ position: 'relative' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Cliente *</Typography.Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                size="small"
                placeholder="Buscar cliente por nombre o documento..."
                value={clienteQuery}
                onChange={(e) => buscarCliente(e.target.value)}
              />
              <Button size="small" icon={<UserOutlined />} title="Usar cliente genérico" onClick={usarClienteGenerico} />
              <Button size="small" icon={<UserAddOutlined />} title="Nuevo cliente (consulta SUNAT/RENIEC)" onClick={() => setModalClienteNuevo(true)} />
            </Space.Compact>
            {mostrarClienteResultados && clienteResultados.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 1000, width: '100%', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                {clienteResultados.map((c) => (
                  <div key={c.id} onClick={() => seleccionarCliente(c)} style={{ padding: '6px 12px', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                    <strong>{c.razon_social}</strong> <Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.numero_documento}</Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            {cliente && <Typography.Text type="success" style={{ fontSize: 12 }}>✓ {cliente.razon_social} ({cliente.numero_documento})</Typography.Text>}
          </div>
        </div>
        <Collapse
          ghost size="small" style={{ marginTop: 4 }}
          activeKey={mostrarObs ? ['obs'] : []}
          onChange={(k) => setMostrarObs((k as string[]).includes('obs'))}
          items={[{ key: 'obs', label: 'Agregar observación', children: (
            <Input size="small" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional..." />
          ) }]}
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Card size="small" title={<><Typography.Text strong>Productos</Typography.Text> <Typography.Text type="secondary" style={{ fontSize: 12 }}>Escriba el código o nombre y presione Enter para avanzar</Typography.Text></>}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                <th style={{ width: 130, padding: 6 }}>Código</th>
                <th style={{ padding: 6 }}>Producto</th>
                <th style={{ width: 70, padding: 6, textAlign: 'right' }}>Cant.</th>
                <th style={{ width: 170, padding: 6 }}>Precio</th>
                <th style={{ width: 90, padding: 6, textAlign: 'right' }}>Total</th>
                <th style={{ width: 36, padding: 6 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const precios = preciosDisponibles(item.producto);
                return (
                  <tr key={idx} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: 6, fontSize: 12, color: '#8c8c8c' }}>{item.producto.codigo}</td>
                    <td style={{ padding: 6 }}>{item.producto.nombre}</td>
                    <td style={{ padding: 6 }}>
                      <InputNumber size="small" min={1} value={item.cantidad} onChange={(v) => actualizarItem(idx, { cantidad: v ?? 1 })} style={{ width: '100%' }} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <Select
                        size="small" value={item.precio_tipo} style={{ width: '100%' }}
                        onChange={(v) => actualizarItem(idx, { precio_tipo: v, precio: precios.find((p) => p.numero === v)?.valor || item.precio })}
                        options={precios.map((p) => ({ value: p.numero, label: `P${p.numero}: ${formatMoneda(p.valor)}` }))}
                      />
                    </td>
                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>{formatMoneda(item.cantidad * item.precio)}</td>
                    <td style={{ padding: 6 }}>
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => quitarItem(idx)} />
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: 6, position: 'relative' }} ref={entradaBoxRef as never}>
                  <Input
                    ref={codigoInputRef}
                    size="small"
                    placeholder="Código o nombre..."
                    value={codigoInput}
                    onChange={(e) => buscarSugerencias(e.target.value)}
                    onKeyDown={handleCodigoKeyDown}
                    autoComplete="off"
                  />
                  {sugerencias.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 1000, width: 340, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 4, maxHeight: 280, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                      {sugerencias.map((p, i) => (
                        <div
                          key={p.id}
                          onMouseDown={(e) => { e.preventDefault(); seleccionarProductoEntrada(p); }}
                          style={{ padding: '6px 12px', cursor: 'pointer', background: i === sugerenciaActiva ? '#e6f4ff' : '#fff' }}
                        >
                          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.codigo}</Typography.Text> {p.nombre}</div>
                          <div style={{ fontSize: 12, color: '#8c8c8c' }}>Stock: {Number(p.stock_actual || 0).toFixed(0)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: 6, fontSize: 13, color: '#8c8c8c' }}>{productoEntrada?.nombre || '—'}</td>
                <td style={{ padding: 6 }}>
                  <InputNumber
                    ref={cantidadInputRef}
                    size="small" min={1} value={cantidadEntrada} disabled={!productoEntrada}
                    onChange={(v) => setCantidadEntrada(v ?? 1)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); precioSelectRef.current?.focus(); } }}
                    style={{ width: '100%' }}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <Select
                    ref={precioSelectRef}
                    size="small" value={precioTipoEntrada} disabled={!productoEntrada} style={{ width: '100%' }}
                    onChange={setPrecioTipoEntrada}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarFilaEntrada(); } }}
                    options={productoEntrada ? preciosDisponibles(productoEntrada).map((p) => ({ value: p.numero, label: `P${p.numero}: ${formatMoneda(p.valor)}` })) : []}
                  />
                </td>
                <td style={{ padding: 6, textAlign: 'right', fontSize: 13, color: '#8c8c8c' }}>
                  {productoEntrada && precioTipoEntrada ? formatMoneda(cantidadEntrada * (preciosDisponibles(productoEntrada).find((p) => p.numero === precioTipoEntrada)?.valor || 0)) : '—'}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </Card>

        <div>
          <Card size="small" title="Resumen" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal</span><strong>{formatMoneda(subtotalVenta)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>IGV (18%)</span><span>{formatMoneda(igvVenta)}</span></div>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text strong style={{ fontSize: 16 }}>TOTAL</Typography.Text>
              <Typography.Text strong style={{ fontSize: 16, color: '#1677ff' }}>{formatMoneda(totalVenta)}</Typography.Text>
            </div>
          </Card>

          <Card
            size="small" title="Pagos" style={{ marginBottom: 12 }}
            extra={<Button size="small" icon={<CheckOutlined />} onClick={agregarPago} title="Agregar pago" />}
          >
            {pagos.map((p, idx) => (
              <Space key={idx} style={{ marginBottom: 8, width: '100%' }}>
                <Select
                  size="small" value={p.id_metodo_pago} style={{ width: 140 }}
                  onChange={(v) => actualizarPago(idx, { id_metodo_pago: v })}
                  options={metodosPago.map((m) => ({ value: m.id, label: m.nombre }))}
                />
                <InputNumber size="small" min={0} step={0.01} value={p.monto} onChange={(v) => actualizarPago(idx, { monto: v ?? 0 })} style={{ width: 100 }} />
                {idx > 0 && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => quitarPago(idx)} />}
              </Space>
            ))}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text type="secondary">Total pagado</Typography.Text>
              <Typography.Text strong>{formatMoneda(totalPagado)}</Typography.Text>
            </div>
          </Card>

          <Card size="small" style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Caja activa</Typography.Text>
            <Input size="small" disabled value={cajaLabel || 'Sin asignar a caja'} />
          </Card>

          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block icon={<CheckOutlined />} loading={guardando} onClick={guardar}>
              {TEXTO_BOTON[tipoDocumento] || 'Guardar'}
            </Button>
            <Link to="/ventas"><Button block>Cancelar</Button></Link>
          </Space>
        </div>
      </div>

      <ClienteNuevoModal
        open={modalClienteNuevo}
        onClose={() => setModalClienteNuevo(false)}
        onCreado={(c) => { seleccionarCliente(c); setModalClienteNuevo(false); }}
      />
    </div>
  );
}
