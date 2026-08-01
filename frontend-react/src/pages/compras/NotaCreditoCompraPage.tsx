import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { App, Card, Table, Button, Input, Select, Switch, InputNumber, Typography, Space, DatePicker } from 'antd';
import { SearchOutlined, ArrowLeftOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { comprasApi } from '@/api/compras';
import { ApiError } from '@/api/types';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import { CODIGOS_MOTIVO_NOTA_CREDITO, MOTIVOS_NC, MOTIVOS_NC_SUGIERE_STOCK } from '@/types/nota-credito';
import type { Compra, DetalleCompra } from '@/types/compra';

function redondear2(v: number) {
  return Math.round(v * 100) / 100;
}

interface ItemNc {
  detalle: DetalleCompra;
  marcado: boolean;
  cantidad: number;
  importe: number;
}

export function NotaCreditoCompraPage() {
  const { message } = App.useApp();
  const [params] = useSearchParams();

  const [buscando, setBuscando] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Compra[] | null>(null);

  const [compra, setCompra] = useState<Compra | null>(null);
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState<Dayjs>(dayjs());
  const [codigoMotivo, setCodigoMotivo] = useState('01');
  const [motivoTexto, setMotivoTexto] = useState(MOTIVOS_NC['01']);
  const [afectaStock, setAfectaStock] = useState(true);
  const [items, setItems] = useState<ItemNc[]>([]);
  const [enviando, setEnviando] = useState(false);

  const esAnulacionTotal = codigoMotivo === '01';

  const buscar = async () => {
    setBuscando(true);
    try {
      const { data } = await comprasApi.listar({ search: query.trim() || undefined, limit: 20 });
      const acreditables = data.filter((c) => c.tipo_documento !== 'nota_credito' && c.estado === 'registrada');
      setResultados(acreditables);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al buscar');
    } finally {
      setBuscando(false);
    }
  };

  const importeProporcional = (detalle: DetalleCompra, cantidad: number) => {
    const cantidadOriginal = Number(detalle.cantidad);
    const importeOriginal = Number(detalle.importe_linea);
    const proporcion = cantidadOriginal > 0 ? cantidad / cantidadOriginal : 0;
    return redondear2(importeOriginal * proporcion);
  };

  const seleccionar = async (id: string) => {
    try {
      const { data } = await comprasApi.obtener(id);
      setCompra(data);
      setCodigoMotivo('01');
      setMotivoTexto(MOTIVOS_NC['01']);
      setAfectaStock(true);
      setSerie('');
      setNumero('');
      setFecha(dayjs());
      setItems((data.detalle || []).map((d) => ({ detalle: d, marcado: true, cantidad: Number(d.cantidad), importe: Number(d.importe_linea) })));
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cargar la compra');
    }
  };

  useEffect(() => {
    const idCompra = params.get('compra');
    if (idCompra) seleccionar(idCompra);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarMotivo = (cod: string) => {
    setCodigoMotivo(cod);
    setMotivoTexto(MOTIVOS_NC[cod] || '');
    setAfectaStock(MOTIVOS_NC_SUGIERE_STOCK.includes(cod));
    if (cod === '01') {
      setItems((prev) => prev.map((it) => ({ ...it, marcado: true, cantidad: Number(it.detalle.cantidad), importe: Number(it.detalle.importe_linea) })));
    }
  };

  const actualizarCantidad = (id: string, cantidad: number) => {
    setItems((prev) => prev.map((it) => (it.detalle.id === id ? { ...it, cantidad, importe: importeProporcional(it.detalle, Math.min(cantidad, Number(it.detalle.cantidad))) } : it)));
  };

  const actualizarImporte = (id: string, importe: number) => {
    setItems((prev) => prev.map((it) => (it.detalle.id === id ? { ...it, importe } : it)));
  };

  const actualizarMarcado = (id: string, marcado: boolean) => {
    setItems((prev) => prev.map((it) => {
      if (it.detalle.id !== id) return it;
      if (!marcado) return { ...it, marcado, cantidad: 0, importe: 0 };
      return { ...it, marcado, cantidad: Number(it.detalle.cantidad), importe: Number(it.detalle.importe_linea) };
    }));
  };

  const total = redondear2(items.filter((it) => it.marcado).reduce((s, it) => s + (it.importe || 0), 0));

  const volverABuscar = () => {
    setCompra(null);
    setItems([]);
  };

  const confirmar = async () => {
    if (!compra) return;
    if (!numero.trim()) { message.warning('Ingrese el número de la Nota de Crédito del proveedor'); return; }
    if (!fecha) { message.warning('Ingrese la fecha de emisión'); return; }
    if (!motivoTexto.trim()) { message.warning('Ingrese el detalle del motivo'); return; }

    const detalle = items
      .filter((it) => it.marcado)
      .map((it) => ({
        id_detalle_original: it.detalle.id,
        cantidad: Math.min(it.cantidad || 0, Number(it.detalle.cantidad)),
        importe_linea: it.importe || 0,
      }))
      .filter((d) => d.cantidad > 0 && d.importe_linea > 0);
    if (detalle.length === 0) { message.warning('Seleccione al menos un ítem a acreditar'); return; }

    setEnviando(true);
    try {
      const { data: nc } = await comprasApi.crearNotaCredito(compra.id, {
        serie: serie.trim() || undefined,
        numero: numero.trim(),
        fecha_emision: fecha.format('YYYY-MM-DD'),
        codigo_motivo: codigoMotivo,
        motivo: motivoTexto.trim(),
        afecta_stock: afectaStock,
        detalle,
      });
      message.success(`Nota de Crédito ${nc.serie ? `${nc.serie}-${nc.numero}` : nc.numero || ''} registrada correctamente`);
      setCompra(null);
      setItems([]);
      setQuery('');
      setResultados(null);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al registrar la nota de crédito');
    } finally {
      setEnviando(false);
    }
  };

  const columnsBusqueda: ColumnsType<Compra> = [
    { title: 'Documento', render: (_, c) => c.serie ? `${c.serie}-${c.numero}` : c.numero || '-' },
    { title: 'Fecha', render: (_, c) => new Date(c.fecha_emision).toLocaleDateString('es-PE') },
    { title: 'Proveedor', render: (_, c) => c.proveedor?.razon_social || '-' },
    { title: 'Total', align: 'right', render: (_, c) => formatMoneda(c.total, c.moneda) },
    { title: 'Estado', align: 'center', render: (_, c) => <EstadoTag estado={c.estado} /> },
    { title: '', align: 'center', width: 100, render: (_, c) => <Button size="small" type="primary" danger icon={<FileExcelOutlined />} onClick={() => seleccionar(c.id)}>Elegir</Button> },
  ];

  if (!compra) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Nueva Nota de Crédito de Compra</Typography.Title>
          <Link to="/compras"><Button icon={<ArrowLeftOutlined />}>Volver al listado</Button></Link>
        </div>
        <Card size="small" title="1. Buscar la compra que el proveedor está acreditando">
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input placeholder="N° de documento o proveedor..." value={query} onChange={(e) => setQuery(e.target.value)} onPressEnter={buscar} />
            <Button type="primary" icon={<SearchOutlined />} loading={buscando} onClick={buscar}>Buscar</Button>
          </Space.Compact>
          <Table
            size="small" rowKey="id" columns={columnsBusqueda} dataSource={resultados || []}
            pagination={false}
            locale={{ emptyText: resultados === null ? 'Busque por número de documento o proveedor' : 'Sin resultados acreditables' }}
          />
        </Card>
      </div>
    );
  }

  const numeroCompra = compra.serie ? `${compra.serie}-${compra.numero}` : compra.numero;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Nueva Nota de Crédito de Compra</Typography.Title>
        <Link to="/compras"><Button icon={<ArrowLeftOutlined />}>Volver al listado</Button></Link>
      </div>

      <Card
        size="small"
        title="2. Datos de la Nota de Crédito"
        extra={<Button size="small" icon={<ArrowLeftOutlined />} onClick={volverABuscar}>Elegir otra compra</Button>}
      >
        <Typography.Paragraph type="secondary">
          Acreditando <strong>{numeroCompra}</strong> — Proveedor: {compra.proveedor?.razon_social || '-'} — Total original: {formatMoneda(compra.total, compra.moneda)}
        </Typography.Paragraph>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Serie (del proveedor)</Typography.Text>
            <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Opcional" maxLength={4} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Número (del proveedor) *</Typography.Text>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° de la NC del proveedor" maxLength={10} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Fecha de emisión *</Typography.Text>
            <DatePicker value={fecha} onChange={(v) => v && setFecha(v)} format="DD/MM/YYYY" style={{ width: '100%' }} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Motivo *</Typography.Text>
            <Select value={codigoMotivo} onChange={cambiarMotivo} style={{ width: '100%' }} options={CODIGOS_MOTIVO_NOTA_CREDITO} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Detalle del motivo *</Typography.Text>
          <Input value={motivoTexto} onChange={(e) => setMotivoTexto(e.target.value)} placeholder="Explique brevemente el motivo" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Switch checked={afectaStock} onChange={setAfectaStock} style={{ marginRight: 8 }} />
          <Typography.Text>Implica devolución física de mercadería al proveedor (descuenta stock)</Typography.Text>
        </div>

        <Typography.Title level={5}>Ítems a acreditar</Typography.Title>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
              <th style={{ width: 40, padding: 6 }}></th>
              <th style={{ padding: 6 }}>Producto</th>
              <th style={{ width: 110, padding: 6, textAlign: 'right' }}>Cant. original</th>
              <th style={{ width: 130, padding: 6, textAlign: 'right' }}>Cant. a acreditar</th>
              <th style={{ width: 150, padding: 6, textAlign: 'right' }}>Importe a acreditar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.detalle.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: 6 }}>
                  <input type="checkbox" checked={it.marcado} disabled={esAnulacionTotal} onChange={(e) => actualizarMarcado(it.detalle.id, e.target.checked)} />
                </td>
                <td style={{ padding: 6 }}>{it.detalle.producto?.nombre || it.detalle.id_producto}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{Number(it.detalle.cantidad).toFixed(4)}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>
                  <InputNumber
                    size="small" min={0.0001} max={Number(it.detalle.cantidad)} step={0.0001}
                    value={it.cantidad} disabled={!it.marcado || esAnulacionTotal}
                    onChange={(v) => actualizarCantidad(it.detalle.id, v ?? 0)}
                    style={{ width: '100%' }}
                  />
                </td>
                <td style={{ padding: 6, textAlign: 'right' }}>
                  <InputNumber
                    size="small" min={0} step={0.01}
                    value={it.importe} disabled={!it.marcado || esAnulacionTotal}
                    onChange={(v) => actualizarImporte(it.detalle.id, v ?? 0)}
                    style={{ width: '100%' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          El "Importe a acreditar" es el que figura en el documento del proveedor (incluye IGV si la línea lo afecta) — por defecto se calcula proporcional a la cantidad, pero puede corregirlo si el proveedor acreditó otro monto (por ejemplo, en bonificaciones). Si el motivo es "Anulación de la operación", debe acreditar todos los ítems por el total completo de la compra.
        </Typography.Paragraph>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            Total a acreditar: <span style={{ color: '#ff4d4f', marginLeft: 8 }}>{formatMoneda(total, compra.moneda)}</span>
          </Typography.Text>
          <Button type="primary" danger loading={enviando} onClick={confirmar}>Registrar Nota de Crédito</Button>
        </div>
      </Card>
    </div>
  );
}
