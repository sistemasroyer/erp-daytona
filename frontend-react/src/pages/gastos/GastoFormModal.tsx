import { useEffect, useState } from 'react';
import { App, Modal, Form, Select, Input, InputNumber, Switch, DatePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { gastosApi } from '@/api/gastos';
import { proveedoresApi } from '@/api/proveedores';
import { comprasApi } from '@/api/compras';
import { ApiError } from '@/api/types';
import { Autocomplete } from '@/components/Autocomplete';
import { formatMoneda } from '@/utils/format';
import { CATEGORIAS_GASTO_LABEL, type CategoriaGasto } from '@/types/gasto';
import type { Proveedor } from '@/types/proveedor';
import type { Compra } from '@/types/compra';

function redondear2(v: number) {
  return Math.round(v * 100) / 100;
}

function labelCompra(c: Compra) {
  return c.serie ? `${c.serie}-${c.numero}` : c.numero || c.numero_interno;
}

export interface GastoInicial {
  categoria?: CategoriaGasto;
  compra?: { id: string; label: string };
  proveedor?: Proveedor;
  monto?: number;
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
  const [categoria, setCategoria] = useState<CategoriaGasto>('otros');
  const [tipoDocumento, setTipoDocumento] = useState('factura');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [rucEmisor, setRucEmisor] = useState('');
  const [razonSocialEmisor, setRazonSocialEmisor] = useState('');
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [proveedorTexto, setProveedorTexto] = useState('');
  const [compraRelacionada, setCompraRelacionada] = useState<{ id: string; label: string } | null>(null);
  const [compraTexto, setCompraTexto] = useState('');
  const [fechaEmision, setFechaEmision] = useState<Dayjs>(dayjs());
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado');
  const [fechaVencimiento, setFechaVencimiento] = useState<Dayjs | null>(null);
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [tipoCambio, setTipoCambio] = useState(3.75);
  const [afectaIgv, setAfectaIgv] = useState(true);
  const [total, setTotal] = useState<number>(0);
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoria(inicial?.categoria || 'otros');
    setTipoDocumento('factura');
    setSerie('');
    setNumero('');
    setRucEmisor(inicial?.proveedor?.ruc || '');
    setRazonSocialEmisor(inicial?.proveedor?.razon_social || '');
    setProveedor(inicial?.proveedor || null);
    setProveedorTexto(inicial?.proveedor?.razon_social || '');
    setCompraRelacionada(inicial?.compra || null);
    setCompraTexto(inicial?.compra?.label || '');
    setFechaEmision(dayjs());
    setCondicionPago('contado');
    setFechaVencimiento(null);
    setMoneda(inicial?.moneda || 'PEN');
    setTipoCambio(3.75);
    setAfectaIgv(true);
    setTotal(inicial?.monto || 0);
    setObservaciones('');
  }, [open, inicial]);

  const subtotal = afectaIgv ? redondear2(total / 1.18) : redondear2(total);
  const igv = afectaIgv ? redondear2(total - subtotal) : 0;

  const guardar = async () => {
    if (!tipoDocumento.trim()) { message.warning('Ingrese el tipo de documento'); return; }
    if (!razonSocialEmisor.trim()) { message.warning('Ingrese la razón social del emisor'); return; }
    if (!fechaEmision) { message.warning('Ingrese la fecha de emisión'); return; }
    if (condicionPago === 'credito' && !fechaVencimiento) { message.warning('Ingrese la fecha de vencimiento'); return; }
    if (!(total > 0)) { message.warning('Ingrese el total del comprobante'); return; }

    setGuardando(true);
    try {
      await gastosApi.crear({
        categoria,
        tipo_documento: tipoDocumento.trim(),
        serie: serie.trim() || undefined,
        numero: numero.trim() || undefined,
        ruc_emisor: rucEmisor.trim() || undefined,
        razon_social_emisor: razonSocialEmisor.trim(),
        id_proveedor: proveedor?.id,
        id_compra_relacionada: compraRelacionada?.id,
        fecha_emision: fechaEmision.format('YYYY-MM-DD'),
        condicion_pago: condicionPago,
        fecha_vencimiento: fechaVencimiento ? fechaVencimiento.format('YYYY-MM-DD') : undefined,
        moneda,
        tipo_cambio: moneda === 'USD' ? tipoCambio : undefined,
        afecta_igv: afectaIgv,
        subtotal,
        igv,
        total,
        observaciones: observaciones.trim() || undefined,
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
    <Modal
      title="Nuevo Gasto"
      open={open}
      onCancel={onClose}
      onOk={guardar}
      confirmLoading={guardando}
      okText="Registrar Gasto"
      cancelText="Cancelar"
      width={720}
      destroyOnHidden
    >
      <Form layout="vertical">
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
            <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="F001" />
          </Form.Item>
          <Form.Item label="Número">
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="00001234" />
          </Form.Item>
          <Form.Item label="Fecha de emisión *">
            <DatePicker value={fechaEmision} onChange={(v) => v && setFechaEmision(v)} format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Form.Item label="RUC emisor">
            <Input value={rucEmisor} onChange={(e) => setRucEmisor(e.target.value)} placeholder="Opcional" maxLength={11} />
          </Form.Item>
          <Form.Item label="Razón social / Nombre del emisor *">
            <Input value={razonSocialEmisor} onChange={(e) => setRazonSocialEmisor(e.target.value)} placeholder="Ej: Restaurante El Buen Sabor" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Vincular a un proveedor registrado (opcional)">
            <Autocomplete<Proveedor>
              placeholder="Buscar proveedor..."
              value={proveedorTexto}
              buscar={async (q) => (await proveedoresApi.listar({ search: q, limit: 8 })).data}
              getLabel={(p) => p.razon_social}
              renderOpcion={(p) => <><strong>{p.ruc}</strong> — {p.razon_social}</>}
              onSelect={(p) => {
                setProveedor(p); setProveedorTexto(p.razon_social);
                if (!rucEmisor) setRucEmisor(p.ruc);
                if (!razonSocialEmisor) setRazonSocialEmisor(p.razon_social);
              }}
            />
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
        </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: moneda === 'USD' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
          <Form.Item label="Moneda">
            <Select value={moneda} onChange={setMoneda} options={[{ value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]} />
          </Form.Item>
          {moneda === 'USD' && (
            <Form.Item label="Tipo de cambio">
              <InputNumber value={tipoCambio} onChange={(v) => setTipoCambio(v ?? 3.75)} min={1} step={0.001} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item label="Total del comprobante *">
            <InputNumber value={total} onChange={(v) => setTotal(v ?? 0)} min={0} step={0.01} style={{ width: '100%' }} prefix={moneda === 'USD' ? 'US$' : 'S/'} />
          </Form.Item>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Switch checked={afectaIgv} onChange={setAfectaIgv} style={{ marginRight: 8 }} />
          <Typography.Text>Incluye IGV (18%)</Typography.Text>
          {total > 0 && (
            <Typography.Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
              Subtotal: {formatMoneda(subtotal, moneda)} — IGV: {formatMoneda(igv, moneda)}
            </Typography.Text>
          )}
        </div>

        <Form.Item label="Observaciones">
          <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
