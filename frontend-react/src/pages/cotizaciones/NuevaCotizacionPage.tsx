import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { createPortal } from 'react-dom';
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

function preciosDisponibles(producto: Producto): { numero: number; valor: number }[] {
  return [1, 2, 3, 4, 5]
    .map((n) => ({ numero: n, valor: Number((producto as unknown as Record<string, string>)[`precio_venta_${n}`] || 0) }))
    .filter((p) => p.valor > 0);
}

export function NuevaCotizacionPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const idPuntoVenta = user?.idPuntoVenta || undefined;

  // Cabecera
  const [series, setSeries] = useState<SerieDocumento[]>([]);
  const [idSerie, setIdSerie] = useState<string | undefined>(undefined);
  const [mostrarObs, setMostrarObs] = useState(false);
  const [observaciones, setObservaciones] = useState('');

  // Cliente
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteResultados, setClienteResultados] = useState<Cliente[]>([]);
  const [mostrarClienteResultados, setMostrarClienteResultados] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [modalClienteNuevo, setModalClienteNuevo] = useState(false);
  const clienteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clienteBoxRef = useRef<HTMLDivElement>(null);

  // Entrada de producto
  const [items, setItems] = useState<ItemCotizacion[]>([]);
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
  const sugerenciasDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

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
      if (clienteBoxRef.current && !clienteBoxRef.current.contains(e.target as Node)) setMostrarClienteResultados(false);
      const dentroEntrada = entradaBoxRef.current?.contains(e.target as Node);
      const dentroDropdown = sugerenciasDropdownRef.current?.contains(e.target as Node);
      if (!dentroEntrada && !dentroDropdown) setSugerencias([]);
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Card size="small" style={{ flex: '3 1 480px' }} title={<><Typography.Text strong>Productos</Typography.Text> <Typography.Text type="secondary" style={{ fontSize: 12 }}>Escriba el código o nombre y presione Enter para avanzar</Typography.Text></>}>
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
          </div>
          {dropdownPos && sugerencias.length > 0 && createPortal(
            <div
              ref={sugerenciasDropdownRef}
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
                    onMouseDown={(e) => { e.preventDefault(); seleccionarProductoEntrada(p); }}
                    style={{ padding: '10px 12px', cursor: 'pointer', background: i === sugerenciaActiva ? '#f0f7ff' : '#fff', borderBottom: i < sugerencias.length - 1 ? '1px solid #f0f0f0' : undefined }}
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
                            <span key={pr.numero} style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 999, padding: '3px 10px', fontSize: 12, color: '#389e0d', fontWeight: 700 }}>
                              P{pr.numero}: {formatMoneda(pr.valor)}
                            </span>
                          ))}
                        </span>
                      )}
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
