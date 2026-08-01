import { useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { App, Card, Select, Input, Button, Typography, InputNumber, Switch, DatePicker, Space, Alert, Empty } from 'antd';
import { UploadOutlined, DeleteOutlined, CheckCircleOutlined, LinkOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { comprasApi } from '@/api/compras';
import { proveedoresApi } from '@/api/proveedores';
import { productosApi } from '@/api/productos';
import { almacenesApi } from '@/api/almacenes';
import { gastosApi } from '@/api/gastos';
import { ApiError } from '@/api/types';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import type { Proveedor } from '@/types/proveedor';
import type { DetalleImportadoXml } from '@/types/compra';
import type { Gasto } from '@/types/gasto';

function labelGastoFlete(g: Gasto) {
  return `${g.numero_interno} — ${g.razon_social_emisor} (${formatMoneda(g.total, g.moneda)})`;
}

type ModoIngreso = 'precio_sin_igv' | 'precio_con_igv' | 'total_sin_igv' | 'total_con_igv';

interface ProductoItem {
  id: string;
  codigo: string;
  nombre: string;
  afecta_igv: boolean;
  precio_compra_sin_igv?: string;
}

interface ItemCompra {
  producto: ProductoItem;
  cantidad: number;
  valor: number;
  afecta_igv: boolean;
}

const MODO_INFO: Record<ModoIngreso, { label: (simb: string) => string; desc: string; ejemplo: string }> = {
  precio_sin_igv: {
    label: (simb) => `Precio unit. sin IGV (${simb})`,
    desc: 'Ingresa el precio por unidad sin IGV. El sistema calcula el total de la línea multiplicando por la cantidad y agrega el IGV.',
    ejemplo: 'Ej: costo 100.00 × 5 und × 1.18 = S/ 590.00',
  },
  precio_con_igv: {
    label: (simb) => `Precio unit. con IGV (${simb})`,
    desc: 'Ingresa el precio por unidad con IGV incluido. El sistema multiplica por la cantidad.',
    ejemplo: 'Ej: precio 118.00 × 5 und = S/ 590.00',
  },
  total_sin_igv: {
    label: (simb) => `Total línea sin IGV (${simb})`,
    desc: 'Ingresa el importe total de la línea sin IGV. El sistema agrega el 18% de IGV.',
    ejemplo: 'Ej: subtotal 500.00 × 1.18 = S/ 590.00',
  },
  total_con_igv: {
    label: (simb) => `Total línea con IGV (${simb})`,
    desc: 'Ingresa el importe total de la línea tal como aparece en la factura (ya incluye IGV).',
    ejemplo: 'Ej: total factura 590.00 → base 500.00 + IGV 90.00',
  },
};

function redondear2(v: number) {
  return Math.round(v * 100) / 100;
}

function getImporteLinea(item: ItemCompra, modo: ModoIngreso) {
  const v = item.valor || 0;
  const cant = item.cantidad || 1;
  const igvFactor = item.afecta_igv ? 1.18 : 1;
  switch (modo) {
    case 'precio_sin_igv': return v * cant * igvFactor;
    case 'precio_con_igv': return v * cant;
    case 'total_sin_igv': return v * igvFactor;
    case 'total_con_igv': return v;
    default: return v;
  }
}

function getCostoUnitarioSinIgvPen(item: ItemCompra, modo: ModoIngreso, moneda: 'PEN' | 'USD', tipoCambio: number) {
  const importeLinea = getImporteLinea(item, modo);
  const tc = moneda === 'USD' ? tipoCambio : 1;
  const importeLineaPen = importeLinea * tc;
  const base = item.afecta_igv ? importeLineaPen / 1.18 : importeLineaPen;
  return item.cantidad > 0 ? base / item.cantidad : 0;
}

export function NuevaCompraPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tipoDocumento, setTipoDocumento] = useState<'factura' | 'boleta' | 'nota' | 'otros'>('factura');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [fechaEmision, setFechaEmision] = useState<Dayjs>(dayjs());
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [proveedorTexto, setProveedorTexto] = useState('');
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado');
  const [fechaVencimiento, setFechaVencimiento] = useState<Dayjs | null>(null);
  const [idAlmacen, setIdAlmacen] = useState<string | undefined>(undefined);
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [tipoCambio, setTipoCambio] = useState(3.75);
  const [observaciones, setObservaciones] = useState('');

  const [tieneFlete, setTieneFlete] = useState(false);
  const [fleteMonto, setFleteMonto] = useState(0);
  const [fleteMoneda, setFleteMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [fleteTipoProrrateo, setFleteTipoProrrateo] = useState<'precio' | 'cantidad'>('precio');
  const [proveedorFlete, setProveedorFlete] = useState<Proveedor | null>(null);
  const [gastoFlete, setGastoFlete] = useState<Gasto | null>(null);
  const [gastoFleteTexto, setGastoFleteTexto] = useState('');

  const [modoIngreso, setModoIngreso] = useState<ModoIngreso>('total_sin_igv');
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [totalFacturaVerificacion, setTotalFacturaVerificacion] = useState<number | undefined>(undefined);
  const [lineasSinAsociar, setLineasSinAsociar] = useState<DetalleImportadoXml[]>([]);
  const [guardando, setGuardando] = useState(false);

  const { data: almacenesData } = useQuery({ queryKey: ['almacenes-all'], queryFn: () => almacenesApi.listar() });

  const simb = moneda === 'USD' ? 'US$' : 'S/';

  const agregarProducto = (p: import('@/types/producto').Producto) => {
    if (items.find((i) => i.producto.id === p.id)) { message.warning('El producto ya está agregado'); return; }
    const ultimoCosto = Number(p.precio_compra_sin_igv || 0);
    const afectaIgv = p.afecta_igv !== false;
    let valorInicial = 0;
    if (ultimoCosto > 0) {
      switch (modoIngreso) {
        case 'precio_sin_igv': valorInicial = ultimoCosto; break;
        case 'precio_con_igv': valorInicial = afectaIgv ? redondear2(ultimoCosto * 1.18) : ultimoCosto; break;
        case 'total_sin_igv': valorInicial = ultimoCosto; break;
        case 'total_con_igv': valorInicial = afectaIgv ? redondear2(ultimoCosto * 1.18) : ultimoCosto; break;
      }
    }
    setItems((prev) => [...prev, { producto: { id: p.id, codigo: p.codigo, nombre: p.nombre, afecta_igv: afectaIgv, precio_compra_sin_igv: p.precio_compra_sin_igv }, cantidad: 1, valor: valorInicial, afecta_igv: afectaIgv }]);
  };

  const actualizarItem = (idx: number, cambios: Partial<ItemCompra>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  const quitarItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const vincularGastoFlete = (g: Gasto) => {
    setGastoFlete(g);
    setGastoFleteTexto(labelGastoFlete(g));
    setFleteMonto(Number(g.total));
    setFleteMoneda(g.moneda);
    if (g.id_proveedor) {
      setProveedorFlete({
        id: g.id_proveedor, ruc: g.proveedor?.ruc || '', razon_social: g.proveedor?.razon_social || g.razon_social_emisor,
        nombre_comercial: null, direccion: null, email: null, telefono: null, contacto: null, cuenta_detraccion: null, dias_credito: 0, estado: true,
      });
    } else {
      setProveedorFlete(null);
    }
  };

  const quitarVinculoGastoFlete = () => {
    setGastoFlete(null);
    setGastoFleteTexto('');
    setFleteMonto(0);
    setProveedorFlete(null);
  };

  const totales = useMemo(() => {
    const tc = moneda === 'USD' ? tipoCambio : 1;
    let subtotal = 0;
    let igvTotal = 0;
    items.forEach((item) => {
      const importeLinea = getImporteLinea(item, modoIngreso);
      const importeLineaPen = importeLinea * tc;
      const base = item.afecta_igv ? importeLineaPen / 1.18 : importeLineaPen;
      const igv = item.afecta_igv ? importeLineaPen - base : 0;
      subtotal += base;
      igvTotal += igv;
    });
    const flete = tieneFlete ? fleteMonto * (fleteMoneda === 'USD' ? tc : 1) : 0;
    const total = subtotal + igvTotal;
    return { subtotal, igvTotal, flete, total };
  }, [items, modoIngreso, moneda, tipoCambio, tieneFlete, fleteMonto, fleteMoneda]);

  const validacion = useMemo(() => {
    if (totalFacturaVerificacion === undefined || items.length === 0) return null;
    const tc = moneda === 'USD' ? tipoCambio : 1;
    const totalFacturaPen = totalFacturaVerificacion * tc;
    const diff = Math.abs(totales.total - totalFacturaPen);
    return diff < 0.05
      ? { ok: true, texto: 'Cuadra con el total de la factura ✓' }
      : { ok: false, texto: `Diferencia: S/ ${diff.toFixed(2)} — revise los importes` };
  }, [totalFacturaVerificacion, items.length, moneda, tipoCambio, totales.total]);

  const importarXml = async (file: File) => {
    try {
      const texto = await file.text();
      const { data } = await comprasApi.importarXml(texto);

      if (data.tipo_documento === 'factura' || data.tipo_documento === 'boleta') setTipoDocumento(data.tipo_documento);
      setSerie(data.serie || '');
      setNumero(data.numero || '');
      if (data.fecha_emision) setFechaEmision(dayjs(data.fecha_emision));
      if (data.moneda === 'PEN' || data.moneda === 'USD') setMoneda(data.moneda);

      if (data.proveedor.encontrado) {
        setProveedor({ id: data.proveedor.id, ruc: data.proveedor.ruc, razon_social: data.proveedor.razon_social, nombre_comercial: null, direccion: null, email: null, telefono: null, contacto: null, cuenta_detraccion: null, dias_credito: 0, estado: true });
        setProveedorTexto(data.proveedor.razon_social);
      } else {
        setProveedor(null);
        setProveedorTexto(data.proveedor.razon_social || '');
        message.warning(`El proveedor RUC ${data.proveedor.ruc || '—'} (${data.proveedor.razon_social || 'desconocido'}) no está registrado. Créelo en Proveedores y vuelva a importar el XML.`, 8);
      }

      setModoIngreso('total_con_igv');

      const nuevosItems: ItemCompra[] = [];
      const sinAsociar: DetalleImportadoXml[] = [];
      for (const linea of data.detalle) {
        if (linea.producto) {
          nuevosItems.push({
            producto: { id: linea.producto.id, codigo: linea.producto.codigo, nombre: linea.producto.nombre, afecta_igv: linea.afecta_igv, precio_compra_sin_igv: linea.producto.precio_compra_sin_igv },
            cantidad: linea.cantidad,
            valor: linea.importe_linea,
            afecta_igv: linea.afecta_igv,
          });
        } else {
          sinAsociar.push(linea);
        }
      }
      setItems(nuevosItems);
      setLineasSinAsociar(sinAsociar);
      if (data.totales?.total) setTotalFacturaVerificacion(data.totales.total);

      message[sinAsociar.length ? 'warning' : 'success'](
        `XML importado: ${nuevosItems.length} producto(s) asociado(s)${sinAsociar.length ? `, ${sinAsociar.length} sin asociar (revise el aviso debajo)` : ''}.`,
      );
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al importar el XML');
    }
  };

  const guardar = async () => {
    if (!proveedor) { message.warning('Seleccione un proveedor'); return; }
    if (!idAlmacen) { message.warning('Seleccione un almacén destino'); return; }
    if (!numero.trim()) { message.warning('Ingrese el número del documento'); return; }
    if (!fechaEmision) { message.warning('Ingrese la fecha de emisión'); return; }
    if (items.length === 0) { message.warning('Agregue al menos un producto'); return; }
    if (condicionPago === 'credito' && !fechaVencimiento) { message.warning('Ingrese la fecha de vencimiento para compras al crédito'); return; }

    const itemsSinValor = items.filter((i) => !(i.valor > 0));
    if (itemsSinValor.length > 0) { message.warning(`${itemsSinValor.length > 1 ? itemsSinValor.length + ' ítems' : 'Un ítem'} sin valor ingresado.`); return; }
    const itemsSinCantidad = items.filter((i) => !(i.cantidad > 0));
    if (itemsSinCantidad.length > 0) { message.warning('Hay ítems con cantidad inválida'); return; }

    const tc = moneda === 'USD' ? tipoCambio : 1;
    setGuardando(true);
    try {
      await comprasApi.crear({
        tipo_documento: tipoDocumento,
        serie: serie.trim() || undefined,
        numero: numero.trim(),
        id_proveedor: proveedor.id,
        id_almacen: idAlmacen,
        moneda,
        tipo_cambio: tc,
        fecha_emision: fechaEmision.format('YYYY-MM-DD'),
        condicion_pago: condicionPago,
        fecha_vencimiento: fechaVencimiento ? fechaVencimiento.format('YYYY-MM-DD') : undefined,
        observaciones: observaciones.trim() || undefined,
        flete_monto: tieneFlete ? fleteMonto : 0,
        flete_moneda: tieneFlete ? fleteMoneda : undefined,
        flete_tipo_prorrateo: tieneFlete ? fleteTipoProrrateo : undefined,
        id_proveedor_flete: tieneFlete ? (proveedorFlete?.id || undefined) : undefined,
        id_gasto_flete: tieneFlete ? (gastoFlete?.id || undefined) : undefined,
        detalle: items.map((i) => ({
          id_producto: i.producto.id,
          cantidad: i.cantidad,
          importe_linea: getImporteLinea(i, modoIngreso),
          afecta_igv: i.afecta_igv,
        })),
      });
      message.success('¡Compra registrada! Stock y precios actualizados.');
      navigate('/compras');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar la compra');
    } finally {
      setGuardando(false);
    }
  };

  const inputLabel = MODO_INFO[modoIngreso].label(simb);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Nueva Compra</Typography.Title>
        <Link to="/compras"><Button>Cancelar</Button></Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <Card
            size="small" style={{ marginBottom: 12 }}
            title="Datos del documento"
            extra={
              <>
                <input ref={fileInputRef} type="file" accept=".xml,text/xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importarXml(f); }} />
                <Button size="small" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>Importar XML del proveedor</Button>
              </>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Tipo doc. *</Typography.Text>
                <Select size="small" value={tipoDocumento} onChange={setTipoDocumento} style={{ width: '100%' }} options={[
                  { value: 'factura', label: 'Factura' }, { value: 'boleta', label: 'Boleta' }, { value: 'nota', label: 'Nota' }, { value: 'otros', label: 'Otros' },
                ]} />
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Serie</Typography.Text>
                <Input size="small" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="F001" maxLength={4} />
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Número *</Typography.Text>
                <Input size="small" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="00001234" maxLength={10} />
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Fecha emisión</Typography.Text>
                <DatePicker size="small" value={fechaEmision} onChange={(v) => v && setFechaEmision(v)} format="DD/MM/YYYY" style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Proveedor *</Typography.Text>
                <Autocomplete<Proveedor>
                  placeholder="Buscar por RUC o razón social..."
                  value={proveedorTexto}
                  buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 8 })).data}
                  getLabel={(p) => p.razon_social}
                  renderOpcion={(p) => <><strong>{p.ruc}</strong> — {p.razon_social}</>}
                  onSelect={(p) => { setProveedor(p); setProveedorTexto(p.razon_social); }}
                />
                {proveedor && <Typography.Text type="success" style={{ fontSize: 12 }}><CheckCircleOutlined /> {proveedor.razon_social}</Typography.Text>}
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Condición de pago</Typography.Text>
                <Select size="small" value={condicionPago} onChange={setCondicionPago} style={{ width: '100%' }} options={[
                  { value: 'contado', label: 'Contado' }, { value: 'credito', label: 'Crédito (letras)' },
                ]} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: condicionPago === 'credito' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Almacén destino *</Typography.Text>
                <Select size="small" value={idAlmacen} onChange={setIdAlmacen} style={{ width: '100%' }} placeholder="Seleccione" options={(almacenesData?.data || []).map((a) => ({ value: a.id, label: a.nombre }))} />
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Moneda factura</Typography.Text>
                <Select size="small" value={moneda} onChange={setMoneda} style={{ width: '100%' }} options={[
                  { value: 'PEN', label: 'PEN — Soles' }, { value: 'USD', label: 'USD — Dólares' },
                ]} />
              </div>
              {moneda === 'USD' && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Tipo de cambio (S/ por USD)</Typography.Text>
                  <InputNumber size="small" value={tipoCambio} onChange={(v) => setTipoCambio(v ?? 3.75)} min={1} step={0.001} style={{ width: '100%' }} />
                </div>
              )}
              {condicionPago === 'credito' && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Fecha vencimiento *</Typography.Text>
                  <DatePicker size="small" value={fechaVencimiento} onChange={setFechaVencimiento} format="DD/MM/YYYY" style={{ width: '100%' }} />
                </div>
              )}
            </div>

            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Observaciones</Typography.Text>
            <Input size="small" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="N° orden, referencias, notas..." />
          </Card>

          <Card
            size="small" style={{ marginBottom: 12 }}
            title={<><Switch size="small" checked={tieneFlete} onChange={(v) => { setTieneFlete(v); if (!v) quitarVinculoGastoFlete(); }} style={{ marginRight: 8 }} />Incluir flete / transporte</>}
          >
            {tieneFlete && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Vincular a una factura de flete ya registrada (opcional)</Typography.Text>
                  {gastoFlete ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '6px 10px' }}>
                      <LinkOutlined style={{ color: '#389e0d' }} />
                      <Typography.Text style={{ flex: 1 }}>{labelGastoFlete(gastoFlete)}</Typography.Text>
                      <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={quitarVinculoGastoFlete}>Quitar vínculo</Button>
                    </div>
                  ) : (
                    <Autocomplete<Gasto>
                      placeholder="Buscar por proveedor o N° de gasto..."
                      value={gastoFleteTexto}
                      buscar={async (q) => (await gastosApi.listar({ categoria: 'flete', sin_vincular: 'true', search: q, limit: 8 })).data}
                      getLabel={labelGastoFlete}
                      renderOpcion={(g) => <>{labelGastoFlete(g)}</>}
                      onSelect={vincularGastoFlete}
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Monto flete</Typography.Text>
                    <InputNumber size="small" value={fleteMonto} onChange={(v) => setFleteMonto(v ?? 0)} min={0} step={0.01} style={{ width: '100%' }} disabled={!!gastoFlete} />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Moneda flete</Typography.Text>
                    <Select size="small" value={fleteMoneda} onChange={setFleteMoneda} style={{ width: '100%' }} disabled={!!gastoFlete} options={[{ value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]} />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Prorratear por</Typography.Text>
                    <Select size="small" value={fleteTipoProrrateo} onChange={setFleteTipoProrrateo} style={{ width: '100%' }} options={[
                      { value: 'precio', label: 'Importe (proporcional)' }, { value: 'cantidad', label: 'Cantidad' },
                    ]} />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Transportista</Typography.Text>
                    {gastoFlete ? (
                      <Input size="small" disabled value={proveedorFlete?.razon_social || gastoFlete.razon_social_emisor} />
                    ) : (
                      <Autocomplete<Proveedor>
                        placeholder="Sin especificar"
                        buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 8 })).data}
                        getLabel={(p) => p.razon_social}
                        renderOpcion={(p) => <>{p.razon_social}</>}
                        onSelect={setProveedorFlete}
                      />
                    )}
                  </div>
                </div>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  {gastoFlete
                    ? 'Monto y transportista tomados de la factura vinculada — la registrarás como pagada desde el módulo Gastos.'
                    : 'El flete es un gasto aparte de la factura del proveedor: no se suma al total a pagar por la mercadería, solo aumenta el costo del inventario. Si todavía no tenés la factura, escribí el monto estimado — luego podés registrarla como Gasto desde el detalle de esta compra.'}
                </Typography.Paragraph>
              </>
            )}
          </Card>

          <Card
            size="small"
            title="Ítems de la factura"
            extra={
              <Space wrap>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Ingresar como:</Typography.Text>
                <Select
                  size="small" value={modoIngreso} onChange={setModoIngreso} style={{ width: 160 }}
                  options={(Object.keys(MODO_INFO) as ModoIngreso[]).map((m) => ({ value: m, label: MODO_INFO[m].label(simb) }))}
                />
                <div style={{ minWidth: 260 }}>
                  <Autocomplete<import('@/types/producto').Producto>
                    placeholder="Agregar producto..."
                    buscar={async (q) => (await productosApi.listar({ search: q, limit: 8 })).data}
                    getLabel={() => ''}
                    renderOpcion={(p) => <><strong>{p.codigo}</strong> — {p.nombre}</>}
                    onSelect={agregarProducto}
                  />
                </div>
              </Space>
            }
          >
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>{MODO_INFO[modoIngreso].desc} {MODO_INFO[modoIngreso].ejemplo}</Typography.Text>

            {items.length === 0 ? <Empty description="Agregue los productos de la factura" /> : items.map((item, idx) => {
              const costoUnit = getCostoUnitarioSinIgvPen(item, modoIngreso, moneda, tipoCambio);
              const tc = moneda === 'USD' ? tipoCambio : 1;
              const importeLineaPen = getImporteLinea(item, modoIngreso) * tc;
              const base = item.afecta_igv ? importeLineaPen / 1.18 : importeLineaPen;
              const igv = item.afecta_igv ? importeLineaPen - base : 0;
              return (
                <div key={item.producto.id} style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div><strong>{item.producto.nombre}</strong> <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.producto.codigo}</Typography.Text></div>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => quitarItem(idx)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 140px 90px 130px 130px 1fr', gap: 12, alignItems: 'end' }}>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cantidad</Typography.Text>
                      <InputNumber size="small" min={0.001} step={1} value={item.cantidad} onChange={(v) => actualizarItem(idx, { cantidad: v ?? 1 })} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{inputLabel}</Typography.Text>
                      <InputNumber size="small" min={0} step={0.0001} value={item.valor} onChange={(v) => actualizarItem(idx, { valor: v ?? 0 })} style={{ width: '100%' }} prefix={simb} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Afecta IGV</Typography.Text>
                      <Switch size="small" checked={item.afecta_igv} onChange={(v) => actualizarItem(idx, { afecta_igv: v })} />
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Costo unit. s/IGV</Typography.Text>
                      <div style={{ background: '#e6f4ff', borderRadius: 4, padding: '2px 6px', textAlign: 'center', fontWeight: 600, color: '#0958d9', fontSize: 12 }}>
                        {costoUnit > 0 ? `S/ ${costoUnit.toFixed(4)}` : '—'}
                      </div>
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Costo unit. c/IGV</Typography.Text>
                      <div style={{ background: '#e6f4ff', borderRadius: 4, padding: '2px 6px', textAlign: 'center', fontWeight: 600, color: '#0958d9', fontSize: 12 }}>
                        {costoUnit > 0 ? `S/ ${(item.afecta_igv ? costoUnit * 1.18 : costoUnit).toFixed(4)}` : '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {moneda === 'USD' ? `= S/ ${importeLineaPen.toFixed(2)} | ` : ''}Base: S/ {base.toFixed(2)}, IGV: S/ {igv.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}

            {lineasSinAsociar.length > 0 && (
              <Alert
                type="warning" showIcon style={{ marginTop: 12 }}
                title="Ítems del XML sin producto asociado — agréguelos manualmente"
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {lineasSinAsociar.map((l, i) => (
                      <li key={i}><strong>{l.codigo_proveedor || '—'}</strong> — {l.descripcion} (cant. {l.cantidad}, {simb} {l.importe_linea.toFixed(2)} c/IGV)</li>
                    ))}
                  </ul>
                }
              />
            )}

            {items.length > 0 && (
              <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Total factura con IGV (verificación)</Typography.Text>
                    <InputNumber size="small" value={totalFacturaVerificacion} onChange={(v) => setTotalFacturaVerificacion(v ?? undefined)} min={0} step={0.01} style={{ width: '100%' }} prefix={simb} />
                  </div>
                  {validacion && (
                    <Typography.Text type={validacion.ok ? 'success' : 'danger'} strong>{validacion.texto}</Typography.Text>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div style={{ position: 'sticky', top: 16 }}>
          <Card size="small" style={{ borderColor: '#52c41a' }} title={<Typography.Text style={{ color: '#389e0d' }}>Resumen de compra</Typography.Text>}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal (sin IGV)</span><strong>{formatMoneda(totales.subtotal)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>IGV 18%</span><span>{formatMoneda(totales.igvTotal)}</span></div>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text strong>TOTAL A PAGAR AL PROVEEDOR</Typography.Text>
              <Typography.Text strong style={{ fontSize: 18, color: '#389e0d' }}>{formatMoneda(totales.total)}</Typography.Text>
            </div>

            {tieneFlete && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderRadius: 6, padding: 8, marginBottom: 12 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Flete (gasto aparte, no incluido arriba)</Typography.Text>
                <strong>{formatMoneda(totales.flete)}</strong>
              </div>
            )}

            <Button type="primary" size="large" block loading={guardando} onClick={guardar}>Registrar Compra</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
