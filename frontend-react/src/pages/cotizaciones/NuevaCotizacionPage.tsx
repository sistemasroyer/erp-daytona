import { Autocomplete } from '@/components/Autocomplete';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { configMargenesApi } from '@/api/config-margenes';
import { Link } from 'react-router-dom';
import { App, Card, Select, Input, Button, Typography, InputNumber, Space, Collapse, Modal } from 'antd';
import { CheckOutlined, UserAddOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { ventasApi } from '@/api/ventas';
import { clientesApi } from '@/api/clientes';
import { productosApi } from '@/api/productos';
import { seriesDocumentoApi } from '@/api/series-documento';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import { useAuth } from '@/auth/AuthContext';
import { ClienteNuevoModal } from '../ventas/ClienteNuevoModal';
import { useBorrador, listarBorradores, descartarBorrador, type BorradorGuardado } from '@/hooks/useBorrador';
import { BorradorBanner } from '@/components/BorradorBanner';
import type { Cliente } from '@/types/cliente';
import type { Producto } from '@/types/producto';
import type { SerieDocumento } from '@/types/serie-documento';

interface ItemCotizacion {
  producto: Producto;
  cantidad: number;
  precio_tipo: number;
  precio: number;
}

interface BorradorCotizacion {
  idSerie: string | undefined;
  observaciones: string;
  mostrarObs: boolean;
  cliente: Cliente | null;
  clienteQuery: string;
  items: ItemCotizacion[];
}

export function NuevaCotizacionPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const idPuntoVenta = user?.idPuntoVenta || undefined;

  const { data: listasData, isPending: cargandoPrecios, isError: errorPrecios } = useQuery({
    queryKey: ['precios-venta-activos'],
    queryFn: configMargenesApi.preciosVenta,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });
  const preciosDisponibles = (producto: Producto) => (listasData?.data ?? [])
    .map(({ numero }) => ({ numero, valor: Number(producto[`precio_venta_${numero}` as keyof Producto]) }))
    .filter((p) => Number.isFinite(p.valor) && p.valor > 0);


  // Cabecera
  const [series, setSeries] = useState<SerieDocumento[]>([]);
  const [idSerie, setIdSerie] = useState<string | undefined>(undefined);
  const [mostrarObs, setMostrarObs] = useState(false);
  const [observaciones, setObservaciones] = useState('');

  // Cliente
  const [clienteQuery, setClienteQuery] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [modalClienteNuevo, setModalClienteNuevo] = useState(false);

  // Entrada de producto
  const [items, setItems] = useState<ItemCotizacion[]>([]);
  const [codigoInput, setCodigoInput] = useState('');
  const [sugerencias, setSugerencias] = useState<Producto[]>([]);
  const [sugerenciaActiva, setSugerenciaActiva] = useState(-1);
  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null);
  const [cantidadEntrada, setCantidadEntrada] = useState(1);
  const [precioTipoEntrada, setPrecioTipoEntrada] = useState<number | undefined>(undefined);
  const [precioMenuAbierto, setPrecioMenuAbierto] = useState(false);
  const busquedaVersionRef = useRef(0);
  const entradaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codigoInputRef = useRef<ComponentRef<typeof Input>>(null);
  const cantidadInputRef = useRef<ComponentRef<typeof InputNumber>>(null);
  const precioSelectRef = useRef<ComponentRef<typeof Select>>(null);
  const entradaBoxRef = useRef<HTMLDivElement>(null);
  const sugerenciasDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    sugerenciasDropdownRef.current?.querySelector('[data-producto-activo="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sugerenciaActiva]);

  useEffect(() => () => {
    busquedaVersionRef.current++;
    if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
  }, []);

  const [guardando, setGuardando] = useState(false);
  const [modalImpresionOpen, setModalImpresionOpen] = useState(false);
  const [cotizacionReciente, setCotizacionReciente] = useState<{ id: string } | null>(null);

  // Borrador local (recuperación ante corte de luz/internet o cierre accidental)
  const [borradores, setBorradores] = useState<BorradorGuardado<BorradorCotizacion>[]>([]);
  const datosBorrador: BorradorCotizacion = { idSerie, observaciones, mostrarObs, cliente, clienteQuery, items };
  const { limpiar: limpiarBorrador } = useBorrador('cotizacion', datosBorrador, {
    vacio: (d) => !d.cliente && d.items.length === 0,
  });

  useEffect(() => {
    setBorradores(listarBorradores<BorradorCotizacion>('cotizacion'));
  }, []);

  const restaurarBorrador = (b: BorradorGuardado<BorradorCotizacion>) => {
    const d = b.datos;
    setIdSerie(d.idSerie);
    setObservaciones(d.observaciones);
    setMostrarObs(d.mostrarObs);
    setCliente(d.cliente);
    setClienteQuery(d.clienteQuery);
    setItems(d.items);
    descartarBorrador(b.clave);
    setBorradores((prev) => prev.filter((x) => x.clave !== b.clave));
  };

  const descartarBorradorLista = (clave: string) => {
    descartarBorrador(clave);
    setBorradores((prev) => prev.filter((x) => x.clave !== clave));
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await seriesDocumentoApi.listar(idPuntoVenta);
        setSeries(data.filter((s) => s.activo));
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : 'Error al cargar datos iniciales');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const dentroEntrada = entradaBoxRef.current?.contains(e.target as Node);
      const dentroDropdown = sugerenciasDropdownRef.current?.contains(e.target as Node);
      if (!dentroEntrada && !dentroDropdown) {
        busquedaVersionRef.current++;
        if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
        setSugerencias([]);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // El dropdown de sugerencias se porta fuera del contenedor con scroll de la tabla
  // (que fuerza overflow-y:auto por la mezcla con overflow-x:auto) para que no quede recortado.
  useLayoutEffect(() => {
    if (sugerencias.length === 0) { setDropdownPos(null); return; }
    const actualizarPos = () => {
      const el = codigoInputRef.current?.input;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 16);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setDropdownPos({ top: rect.bottom + 4, left: Math.max(8, left), width });
    };
    actualizarPos();
    window.addEventListener('scroll', actualizarPos, true);
    window.addEventListener('resize', actualizarPos);
    return () => {
      window.removeEventListener('scroll', actualizarPos, true);
      window.removeEventListener('resize', actualizarPos);
    };
  }, [sugerencias.length]);

  const seriesDisponibles = series.filter((s) => s.tipo_documento === 'COTIZACION');
  useEffect(() => {
    setIdSerie(seriesDisponibles[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  // ==================== CLIENTE ====================
  const seleccionarCliente = (c: Cliente) => {
    setCliente(c);
    setClienteQuery(c.razon_social);
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
    setPrecioMenuAbierto(false);
    setProductoEntrada(null);
    setCantidadEntrada(1);
    setPrecioTipoEntrada(undefined);
  };

  const seleccionarProductoEntrada = (p: Producto, numeroPrecio?: number) => {
    busquedaVersionRef.current++;
    if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
    setProductoEntrada(p);
    setCodigoInput(p.codigo);
    setSugerencias([]);
    const precios = preciosDisponibles(p);
    setPrecioTipoEntrada(precios.find((precio) => precio.numero === numeroPrecio)?.numero ?? precios[0]?.numero);
    setCantidadEntrada(1);
    setTimeout(() => { cantidadInputRef.current?.focus(); cantidadInputRef.current?.select(); }, 0);
  };

  const buscarSugerencias = (q: string) => {
    const version = ++busquedaVersionRef.current;
    setSugerencias([]);
    setSugerenciaActiva(-1);
    setCodigoInput(q);
    if (productoEntrada) resetEntrada();
    if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
    if (!q.trim()) { setSugerencias([]); return; }
    entradaTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await productosApi.listar({ search: q.trim(), limit: 8 });
        if (version !== busquedaVersionRef.current) return;
        setSugerencias(data);
        setSugerenciaActiva(-1);
      } catch { /* búsqueda silenciosa */ }
    }, 200);
  };

  const confirmarFilaEntrada = () => {
    if (!productoEntrada || !precioTipoEntrada) return;
    const cantidad = Math.max(1, cantidadEntrada || 1);
    const precioActivo = preciosDisponibles(productoEntrada).find((p) => p.numero === precioTipoEntrada);
    if (!precioActivo) { message.warning('Seleccione un precio activo'); return; }
    const precio = precioActivo.valor;
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
      setSugerenciaActiva((prev) => prev < 0 ? sugerencias.length - 1 : (prev - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      busquedaVersionRef.current++;
      if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
      setSugerencias([]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugerencias.length) {
        seleccionarProductoEntrada(sugerencias[Math.max(0, sugerenciaActiva)]);
        return;
      }
      const version = ++busquedaVersionRef.current;
      if (entradaTimerRef.current) clearTimeout(entradaTimerRef.current);
      const q = codigoInput.trim();
      if (!q) return;
      try {
        const { data: prods } = await productosApi.listar({ search: q, limit: 8 });
        if (version !== busquedaVersionRef.current) return;
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

  const handlePrecioKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (precioMenuAbierto) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) confirmarFilaEntrada();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cantidadInputRef.current?.focus();
    }
  };

  const quitarItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const actualizarItem = (idx: number, cambios: Partial<ItemCotizacion>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));

  // ==================== TOTALES ====================
  const totalCotizacion = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const subtotalCotizacion = totalCotizacion / 1.18;
  const igvCotizacion = totalCotizacion - subtotalCotizacion;

  // ==================== RESET / GUARDAR ====================
  const resetearFormulario = () => {
    setItems([]);
    setCodigoInput('');
    resetEntrada();
    setSugerencias([]);
    setCliente(null);
    setClienteQuery('');
    setObservaciones('');
    setMostrarObs(false);
  };

  const finalizarCotizacion = (opcion: 'imprimir' | 'sin_imprimir' | 'nueva') => {
    setModalImpresionOpen(false);
    if (opcion === 'imprimir' && cotizacionReciente) {
      window.open(`/ventas/imprimir?id=${cotizacionReciente.id}`, '_blank', 'noopener,noreferrer');
    }
    resetearFormulario();
    setCotizacionReciente(null);
  };

  const guardar = async () => {
    if (!cliente) { message.warning('Seleccione un cliente'); return; }
    if (!idSerie) { message.warning('No hay una serie configurada para Cotización. Configúrela en Configuración → Series.'); return; }
    if (items.length === 0) { message.warning('Agregue al menos un producto'); return; }
    if (items.some((item) => !preciosDisponibles(item.producto).some((p) => p.numero === item.precio_tipo))) {
      message.warning('Hay productos con precios desactivados. Seleccione un precio activo.');
      return;
    }

    setGuardando(true);
    try {
      const { data: cotizacion } = await ventasApi.crear({
        tipo_documento: 'COTIZACION',
        id_serie_documento: idSerie,
        id_cliente: cliente.id,
        moneda: 'PEN',
        observaciones: observaciones || undefined,
        detalle: items.map((i) => ({ id_producto: i.producto.id, cantidad: i.cantidad, precio_tipo: i.precio_tipo })),
      });

      message.success('¡Cotización registrada correctamente!');
      setCotizacionReciente(cotizacion);
      setModalImpresionOpen(true);
      limpiarBorrador();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar la cotización');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <BorradorBanner
        borradores={borradores}
        resumen={(d) => `${d.cliente ? d.cliente.razon_social : 'Sin cliente'} — ${d.items.length} ítem(s) — ${formatMoneda(d.items.reduce((s, i) => s + i.cantidad * i.precio, 0))}`}
        onRestaurar={restaurarBorrador}
        onDescartar={descartarBorradorLista}
      />
      <Card size="small" style={{ marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Serie *</Typography.Text>
            <Select
              value={idSerie} onChange={setIdSerie} style={{ width: '100%' }} size="small"
              placeholder={seriesDisponibles.length ? 'Seleccione' : 'Sin series configuradas'}
              options={seriesDisponibles.map((s) => ({ value: s.id, label: s.serie }))}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Cliente *</Typography.Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <Autocomplete<Cliente>
                  placeholder="Buscar cliente por nombre o documento..."
                  value={clienteQuery}
                  buscar={async (q) => (await clientesApi.listar({ search: q, limit: 8 })).data}
                  getLabel={(c) => c.razon_social}
                  renderOpcion={(c) => <><strong>{c.razon_social}</strong> {c.numero_documento}</>}
                  onSelect={seleccionarCliente}
                />
              </div>
              <Button icon={<UserOutlined />} onClick={usarClienteGenerico}>Cliente genérico</Button>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => setModalClienteNuevo(true)}>Nuevo cliente</Button>
            </div>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Card size="small" style={{ flex: '3 1 480px' }} title="Productos">
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
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
                      <InputNumber size="small" min={1} step={1} precision={0} value={item.cantidad} onChange={(v) => actualizarItem(idx, { cantidad: v ?? 1 })} style={{ width: '100%' }} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <Select
                        size="small" value={precios.some((p) => p.numero === item.precio_tipo) ? item.precio_tipo : undefined} style={{ width: '100%' }}
                        placeholder="Seleccione un precio activo"
                        status={precios.some((p) => p.numero === item.precio_tipo) ? undefined : 'error'}
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
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={sugerencias.length > 0}
                    aria-controls={sugerencias.length ? 'productos-resultados' : undefined}
                    aria-activedescendant={sugerenciaActiva >= 0 && sugerencias[sugerenciaActiva] ? 'producto-opcion-' + sugerenciaActiva : undefined}
                    size="small"
                    placeholder="Código o nombre..."
                    value={codigoInput}
                    onChange={(e) => buscarSugerencias(e.target.value)}
                    onKeyDown={handleCodigoKeyDown}
                    autoComplete="off"
                  />
                </td>
                <td style={{ padding: 6, fontSize: 13, color: '#8c8c8c' }}>{productoEntrada?.nombre || '—'}</td>
                <td style={{ padding: 6 }}>
                  <InputNumber
                    ref={cantidadInputRef}
                    size="small" min={1} step={1} precision={0} value={cantidadEntrada} disabled={!productoEntrada}
                    onChange={(v) => setCantidadEntrada(v ?? 1)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); precioSelectRef.current?.focus(); setPrecioMenuAbierto(true); } }}
                    style={{ width: '100%' }}
                  />
                </td>
                <td style={{ padding: 6 }} onKeyDownCapture={handlePrecioKeyDown}>
                  <Select
                    ref={precioSelectRef}
                    open={precioMenuAbierto}
                    onOpenChange={setPrecioMenuAbierto}
                    size="small" value={productoEntrada && preciosDisponibles(productoEntrada).some((p) => p.numero === precioTipoEntrada) ? precioTipoEntrada : undefined} disabled={!productoEntrada || cargandoPrecios || errorPrecios} style={{ width: '100%' }}
                    placeholder="Seleccione un precio activo"
                    onChange={setPrecioTipoEntrada}
                    onSelect={() => setPrecioMenuAbierto(false)}
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
          </div>
          {dropdownPos && sugerencias.length > 0 && createPortal(
            <div
              ref={sugerenciasDropdownRef}
              id="productos-resultados"
              role="listbox"
              style={{
                position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 1060,
                background: '#fff', border: '1px solid #d9d9d9', borderRadius: 10, maxHeight: 360, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              }}
            >
              {sugerencias.map((p, i) => {
                const precios = preciosDisponibles(p);
                return (
                  <div
                    key={p.id}
                    id={'producto-opcion-' + i}
                    role="option"
                    aria-selected={i === sugerenciaActiva}
                    data-producto-activo={i === sugerenciaActiva}
                    onMouseEnter={() => setSugerenciaActiva(i)}
                    onMouseDown={(e) => { e.preventDefault(); seleccionarProductoEntrada(p); }}
                    style={{ padding: '10px 12px', cursor: 'pointer', background: i === sugerenciaActiva ? '#bae0ff' : '#fff', borderBottom: i < sugerencias.length - 1 ? '1px solid #f0f0f0' : undefined }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{p.codigo}</Typography.Text>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</span>
                      {p.marca ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>· {p.marca.nombre}</Typography.Text> : null}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#595959', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#1f1f1f', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 999, padding: '3px 10px' }}>
                        Stock: {Number(p.stock_actual || 0).toFixed(0)}
                      </span>
                      {precios.length > 0 && (
                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {precios.map((pr) => (
                            <Button key={pr.numero} size="small"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); seleccionarProductoEntrada(p, pr.numero); }}
                              aria-label={`Seleccionar ${p.nombre} con precio P${pr.numero}: ${formatMoneda(pr.valor)}`}
                              style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 999, padding: '3px 10px', fontSize: 12, color: '#389e0d', fontWeight: 700 }}>
                              P{pr.numero}: {formatMoneda(pr.valor)}
                            </Button>
                          ))}
                        </span>
                      )}
                      {!precios.length && <Typography.Text type="secondary">
                        {cargandoPrecios ? 'Cargando precios…' : errorPrecios ? 'No se pudieron cargar los precios' : 'Sin precios activos'}
                      </Typography.Text>}
                    </div>
                  </div>
                );
              })}
            </div>,
            document.body,
          )}
        </Card>

        <div style={{ flex: '1 1 300px' }}>
          <Card size="small" title="Resumen" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal</span><strong>{formatMoneda(subtotalCotizacion)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>IGV (18%)</span><span>{formatMoneda(igvCotizacion)}</span></div>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text strong style={{ fontSize: 16 }}>TOTAL</Typography.Text>
              <Typography.Text strong style={{ fontSize: 16, color: '#1677ff' }}>{formatMoneda(totalCotizacion)}</Typography.Text>
            </div>
          </Card>

          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block icon={<CheckOutlined />} loading={guardando} onClick={guardar}>
              Registrar Cotización
            </Button>
            <Link to="/cotizaciones"><Button block>Cancelar</Button></Link>
          </Space>
        </div>
      </div>

      <Modal
        open={modalImpresionOpen}
        title="Cotización registrada"
        onCancel={() => finalizarCotizacion('sin_imprimir')}
        footer={[
          <Button key="sin-imprimir" onClick={() => finalizarCotizacion('sin_imprimir')}>
            No imprimir
          </Button>,
          <Button key="nueva" type="primary" onClick={() => finalizarCotizacion('nueva')}>
            Nueva cotización
          </Button>,
          <Button key="imprimir" type="primary" onClick={() => finalizarCotizacion('imprimir')}>
            Imprimir
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Typography.Text>
            La cotización se registró correctamente. Puedes revisar la vista previa antes de imprimir.
          </Typography.Text>
          {cotizacionReciente && (
            <iframe
              title="Vista previa del documento"
              src={`/ventas/imprimir?id=${cotizacionReciente.id}`}
              style={{ width: '100%', height: 420, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}
            />
          )}
        </div>
      </Modal>

      <ClienteNuevoModal
        open={modalClienteNuevo}
        onClose={() => setModalClienteNuevo(false)}
        onCreado={(c) => { seleccionarCliente(c); setModalClienteNuevo(false); }}
      />
    </div>
  );
}
