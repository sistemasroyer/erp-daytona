import { useEffect, useRef, useState } from 'react';
import { App, Modal, Form, Select, Input, InputNumber, Switch, DatePicker, Typography, Button, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { gastosApi } from '@/api/gastos';
import { proveedoresApi } from '@/api/proveedores';
import { comprasApi } from '@/api/compras';
import { ApiError } from '@/api/types';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import { ProveedorNuevoModal } from '@/pages/proveedores/ProveedorNuevoModal';
import { CATEGORIAS_GASTO_LABEL, type CategoriaGasto } from '@/types/gasto';
import type { Proveedor } from '@/types/proveedor';
import type { Compra } from '@/types/compra';

function redondear2(v: number) {
  return Math.round(v * 100) / 100;
}

function labelCompra(c: Compra) {
  return c.serie ? `${c.serie}-${c.numero}` : c.numero || c.numero_interno;
}

interface LineaGasto {
  descripcion: string;
  cantidad: number;
  importeLinea: number;
  afectaIgv: boolean;
}

const LINEA_VACIA: LineaGasto = { descripcion: '', cantidad: 1, importeLinea: 0, afectaIgv: true };

export interface GastoInicial {
  categoria?: CategoriaGasto;
  compra?: { id: string; label: string };
  proveedor?: Proveedor;
  descripcionLinea?: string;
  montoLinea?: number;
  moneda?: 'PEN' | 'USD';
}

interface Props {
  open: boolean;
  inicial?: GastoInicial;
  onClose: () => void;
  onSaved: () => void;
}

export function GastoFormModal({ open, inicial, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoria, setCategoria] = useState<CategoriaGasto>('otros');
  const [tipoDocumento, setTipoDocumento] = useState('factura');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [proveedorTexto, setProveedorTexto] = useState('');
  const [modalProveedorNuevo, setModalProveedorNuevo] = useState(false);
  const [proveedorSugerido, setProveedorSugerido] = useState<{ ruc?: string; razonSocial?: string }>({});
  const [compraRelacionada, setCompraRelacionada] = useState<{ id: string; label: string } | null>(null);
  const [compraTexto, setCompraTexto] = useState('');
  const [fechaEmision, setFechaEmision] = useState<Dayjs>(dayjs());
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado');
  const [fechaVencimiento, setFechaVencimiento] = useState<Dayjs | null>(null);
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [tipoCambio, setTipoCambio] = useState(3.75);
  const [lineas, setLineas] = useState<LineaGasto[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoria(inicial?.categoria || 'otros');
    setTipoDocumento('factura');
    setSerie('');
    setNumero('');
    setProveedor(inicial?.proveedor || null);
    setProveedorTexto(inicial?.proveedor?.razon_social || '');
    setProveedorSugerido({});
    setCompraRelacionada(inicial?.compra || null);
    setCompraTexto(inicial?.compra?.label || '');
    setFechaEmision(dayjs());
    setCondicionPago('contado');
    setFechaVencimiento(null);
    setMoneda(inicial?.moneda || 'PEN');
    setTipoCambio(3.75);
    setLineas(inicial?.montoLinea ? [{ ...LINEA_VACIA, descripcion: inicial.descripcionLinea || 'Flete', importeLinea: inicial.montoLinea }] : []);
    setObservaciones('');
  }, [open, inicial]);

  const simb = moneda === 'USD' ? 'US$' : 'S/';

  const agregarLinea = () => setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  const actualizarLinea = (idx: number, cambios: Partial<LineaGasto>) => setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  const quitarLinea = (idx: number) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const calcularLinea = (l: LineaGasto) => {
    const subtotal = l.afectaIgv ? redondear2(l.importeLinea / 1.18) : redondear2(l.importeLinea);
    const igv = l.afectaIgv ? redondear2(l.importeLinea - subtotal) : 0;
    return { subtotal, igv, total: redondear2(subtotal + igv) };
  };

  const totales = lineas.reduce((acc, l) => {
    const { subtotal, igv, total } = calcularLinea(l);
    return { subtotal: acc.subtotal + subtotal, igv: acc.igv + igv, total: acc.total + total };
  }, { subtotal: 0, igv: 0, total: 0 });

  const importarXml = async (file: File) => {
    try {
      const texto = await file.text();
      const { data } = await gastosApi.importarXml(texto);

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
        setProveedorTexto('');
        setProveedorSugerido({ ruc: data.proveedor.ruc || undefined, razonSocial: data.proveedor.razon_social || undefined });
        message.warning(`El proveedor RUC ${data.proveedor.ruc || '—'} no está registrado. Click en "+ Nuevo" para crearlo con esos datos.`, 8);
      }

      setLineas(data.detalle.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, importeLinea: l.importe_linea, afectaIgv: l.afecta_igv })));

      message.success(`XML importado: ${data.detalle.length} línea(s) cargada(s).`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al importar el XML');
    }
  };

  const guardar = async () => {
    if (!proveedor) { message.warning('Busque y seleccione el proveedor emisor'); return; }
    if (!tipoDocumento.trim()) { message.warning('Ingrese el tipo de documento'); return; }
    if (!fechaEmision) { message.warning('Ingrese la fecha de emisión'); return; }
    if (condicionPago === 'credito' && !fechaVencimiento) { message.warning('Ingrese la fecha de vencimiento'); return; }
    if (lineas.length === 0) { message.warning('Agregue al menos una línea de detalle'); return; }
    const lineasInvalidas = lineas.filter((l) => !l.descripcion.trim() || !(l.importeLinea > 0));
    if (lineasInvalidas.length > 0) { message.warning('Hay líneas sin descripción o sin monto'); return; }

    setGuardando(true);
    try {
      await gastosApi.crear({
        categoria,
        tipo_documento: tipoDocumento.trim(),
        serie: serie.trim() || undefined,
        numero: numero.trim() || undefined,
        id_proveedor: proveedor.id,
        id_compra_relacionada: compraRelacionada?.id,
        fecha_emision: fechaEmision.format('YYYY-MM-DD'),
        condicion_pago: condicionPago,
        fecha_vencimiento: fechaVencimiento ? fechaVencimiento.format('YYYY-MM-DD') : undefined,
        moneda,
        tipo_cambio: moneda === 'USD' ? tipoCambio : undefined,
        observaciones: observaciones.trim() || undefined,
        detalle: lineas.map((l) => ({
          descripcion: l.descripcion.trim(),
          cantidad: l.cantidad || 1,
          importe_linea: l.importeLinea,
          afecta_igv: l.afectaIgv,
        })),
      });
      message.success('Gasto registrado correctamente');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar el gasto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Modal
        title="Nuevo Gasto"
        open={open}
        onCancel={onClose}
        onOk={guardar}
        confirmLoading={guardando}
        okText="Registrar Gasto"
        cancelText="Cancelar"
        width={820}
        destroyOnHidden
      >
        <Form layout="vertical">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <input ref={fileInputRef} type="file" accept=".xml,text/xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importarXml(f); }} />
            <Button size="small" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>Importar XML del proveedor</Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Categoría *">
              <Select
                value={categoria} onChange={setCategoria}
                options={Object.entries(CATEGORIAS_GASTO_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item label="Tipo de documento *">
              <Select
                value={tipoDocumento} onChange={setTipoDocumento}
                options={[
                  { value: 'factura', label: 'Factura' }, { value: 'boleta', label: 'Boleta' },
                  { value: 'recibo_honorarios', label: 'Recibo por honorarios' },
                  { value: 'ticket', label: 'Ticket' }, { value: 'otros', label: 'Otros' },
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item label="Serie">
              <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="F001" maxLength={4} />
            </Form.Item>
            <Form.Item label="Número">
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="00001234" maxLength={10} />
            </Form.Item>
            <Form.Item label="Fecha de emisión *">
              <DatePicker value={fechaEmision} onChange={(v) => v && setFechaEmision(v)} format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item label="Proveedor emisor *">
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Autocomplete<Proveedor>
                  placeholder="Buscar por RUC o razón social..."
                  value={proveedorTexto}
                  buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 8 })).data}
                  getLabel={(p) => p.razon_social}
                  renderOpcion={(p) => <><strong>{p.ruc}</strong> — {p.razon_social}</>}
                  onSelect={(p) => { setProveedor(p); setProveedorTexto(p.razon_social); }}
                />
              </div>
              <Button icon={<UserAddOutlined />} onClick={() => setModalProveedorNuevo(true)}>Nuevo</Button>
            </div>
            {proveedor && <Typography.Text type="success" style={{ fontSize: 12 }}>✓ {proveedor.ruc} — {proveedor.razon_social}</Typography.Text>}
          </Form.Item>

          <Form.Item label="Vincular a una compra (opcional, ej. flete de esa compra)">
            <Autocomplete<Compra>
              placeholder="Buscar compra por N° o proveedor..."
              value={compraTexto}
              buscar={async (q) => (await comprasApi.listar({ search: q, limit: 8 })).data}
              getLabel={labelCompra}
              renderOpcion={(c) => <>{labelCompra(c)} — {c.proveedor?.razon_social || '-'}</>}
              onSelect={(c) => { setCompraRelacionada({ id: c.id, label: labelCompra(c) }); setCompraTexto(labelCompra(c)); }}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Condición de pago">
              <Select value={condicionPago} onChange={setCondicionPago} options={[
                { value: 'contado', label: 'Contado' }, { value: 'credito', label: 'Crédito' },
              ]} />
            </Form.Item>
            {condicionPago === 'credito' && (
              <Form.Item label="Fecha de vencimiento *">
                <DatePicker value={fechaVencimiento} onChange={setFechaVencimiento} format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: moneda === 'USD' ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 8 }}>
            <Form.Item label="Moneda">
              <Select value={moneda} onChange={setMoneda} options={[{ value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]} />
            </Form.Item>
            {moneda === 'USD' && (
              <Form.Item label="Tipo de cambio">
                <InputNumber value={tipoCambio} onChange={(v) => setTipoCambio(v ?? 3.75)} min={1} step={0.001} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Text strong>Detalle de la factura</Typography.Text>
            <Button size="small" icon={<PlusOutlined />} onClick={agregarLinea}>Agregar línea</Button>
          </div>

          {lineas.length === 0 ? <Empty description="Agregue las líneas del comprobante" /> : lineas.map((l, idx) => {
            const { subtotal, igv } = calcularLinea(l);
            return (
              <div key={idx} style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 130px 90px 32px', gap: 8, alignItems: 'end' }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Descripción</Typography.Text>
                    <Input size="small" value={l.descripcion} onChange={(e) => actualizarLinea(idx, { descripcion: e.target.value })} placeholder="Ej: Alquiler enero" />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Cant.</Typography.Text>
                    <InputNumber size="small" min={0.0001} step={1} value={l.cantidad} onChange={(v) => actualizarLinea(idx, { cantidad: v ?? 1 })} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Monto ({simb})</Typography.Text>
                    <InputNumber size="small" min={0} step={0.01} value={l.importeLinea} onChange={(v) => actualizarLinea(idx, { importeLinea: v ?? 0 })} style={{ width: '100%' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Afecta IGV</Typography.Text>
                    <Switch size="small" checked={l.afectaIgv} onChange={(v) => actualizarLinea(idx, { afectaIgv: v })} />
                  </div>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => quitarLinea(idx)} />
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>Base: {formatMoneda(subtotal, moneda)} — IGV: {formatMoneda(igv, moneda)}</Typography.Text>
              </div>
            );
          })}

          {lineas.length > 0 && (
            <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatMoneda(totales.subtotal, moneda)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IGV</span><span>{formatMoneda(totales.igv, moneda)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginTop: 4 }}><span>TOTAL</span><span>{formatMoneda(totales.total, moneda)}</span></div>
            </div>
          )}

          <Form.Item label="Observaciones" style={{ marginTop: 12 }}>
            <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional..." />
          </Form.Item>
        </Form>
      </Modal>

      <ProveedorNuevoModal
        open={modalProveedorNuevo}
        rucInicial={proveedorSugerido.ruc}
        razonSocialInicial={proveedorSugerido.razonSocial}
        onClose={() => setModalProveedorNuevo(false)}
        onCreado={(p) => { setProveedor(p); setProveedorTexto(p.razon_social); setModalProveedorNuevo(false); }}
      />
    </>
  );
}
