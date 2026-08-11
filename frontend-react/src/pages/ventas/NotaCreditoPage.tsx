import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { App, Card, Table, Button, Input, Select, Switch, InputNumber, Typography, Space } from 'antd';
import { SearchOutlined, ArrowLeftOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ventasApi } from '@/api/ventas';
import { seriesDocumentoApi } from '@/api/series-documento';
import { ApiError } from '@/api/types';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import { useAuth } from '@/auth/AuthContext';
import { CODIGOS_MOTIVO_NOTA_CREDITO, MOTIVOS_NC, MOTIVOS_NC_SUGIERE_STOCK } from '@/types/nota-credito';
import type { Venta, DetalleVenta } from '@/types/venta';
import type { SerieDocumento } from '@/types/serie-documento';

function redondear2(v: number) {
  return Math.round(v * 100) / 100;
}

interface ItemNc {
  detalle: DetalleVenta;
  marcado: boolean;
  cantidad: number;
}

export function NotaCreditoPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [buscando, setBuscando] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Venta[] | null>(null);

  const [venta, setVenta] = useState<Venta | null>(null);
  const [series, setSeries] = useState<SerieDocumento[]>([]);
  const [idSerie, setIdSerie] = useState<string | undefined>(undefined);
  const [codigoMotivo, setCodigoMotivo] = useState('01');
  const [motivoTexto, setMotivoTexto] = useState(MOTIVOS_NC['01']);
  const [afectaStock, setAfectaStock] = useState(true);
  const [items, setItems] = useState<ItemNc[]>([]);
  const [enviando, setEnviando] = useState(false);

  const esAnulacionTotal = codigoMotivo === '01';

  const buscar = async () => {
    setBuscando(true);
    try {
      const { data } = await ventasApi.listar({ search: query.trim() || undefined, limit: 20 });
      const acreditables = data.filter((v) => (v.tipo_documento === 'FACTURA' || v.tipo_documento === 'BOLETA') && v.estado_venta === 'vigente');
      setResultados(acreditables);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al buscar');
    } finally {
      setBuscando(false);
    }
  };

  const seleccionar = async (id: string) => {
    try {
      const { data } = await ventasApi.obtener(id);
      setVenta(data);
      setCodigoMotivo('01');
      setMotivoTexto(MOTIVOS_NC['01']);
      setAfectaStock(true);
      setItems((data.detalle || []).map((d) => ({ detalle: d, marcado: true, cantidad: Number(d.cantidad) })));

      const idPuntoVenta = user?.idPuntoVenta || undefined;
      const { data: seriesData } = await seriesDocumentoApi.listar(idPuntoVenta);
      const prefijo = data.tipo_documento === 'FACTURA' ? 'F' : 'B';
      setSeries(seriesData.filter((s) => s.activo && s.tipo_documento === 'NOTA_CREDITO' && s.serie.startsWith(prefijo)));
      setIdSerie(undefined);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cargar el comprobante');
    }
  };

  useEffect(() => {
    const idVenta = params.get('venta');
    if (idVenta) seleccionar(idVenta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (series.length) setIdSerie(series[0].id);
  }, [series]);

  const cambiarMotivo = (cod: string) => {
    setCodigoMotivo(cod);
    setMotivoTexto(MOTIVOS_NC[cod] || '');
    setAfectaStock(MOTIVOS_NC_SUGIERE_STOCK.includes(cod));
    if (cod === '01') {
      setItems((prev) => prev.map((it) => ({ ...it, marcado: true, cantidad: Number(it.detalle.cantidad) })));
    }
  };

  const actualizarItem = (id: string, cambios: Partial<ItemNc>) => {
    setItems((prev) => prev.map((it) => (it.detalle.id === id ? { ...it, ...cambios } : it)));
  };

  const total = redondear2(items.filter((it) => it.marcado).reduce((s, it) => {
    const cantidad = Math.min(it.cantidad || 0, Number(it.detalle.cantidad));
    return s + Number(it.detalle.precio_unitario) * cantidad;
  }, 0));

  const volverABuscar = () => {
    setVenta(null);
    setItems([]);
  };

  const confirmar = async () => {
    if (!venta) return;
    if (!idSerie) { message.warning('No hay una serie de Nota de Crédito disponible para este tipo de documento'); return; }
    if (!motivoTexto.trim()) { message.warning('Ingrese el detalle del motivo'); return; }

    const detalle = items
      .filter((it) => it.marcado)
      .map((it) => ({ id_detalle_original: it.detalle.id, cantidad: Math.min(it.cantidad || 0, Number(it.detalle.cantidad)) }))
      .filter((d) => d.cantidad > 0);
    if (detalle.length === 0) { message.warning('Seleccione al menos un ítem a acreditar'); return; }

    setEnviando(true);
    try {
      const { data: nc } = await ventasApi.crearNotaCredito(venta.id, {
        id_serie_documento: idSerie,
        codigo_motivo: codigoMotivo,
        motivo: motivoTexto.trim(),
        afecta_stock: afectaStock,
        detalle,
      });
      message.success(`Nota de Crédito ${nc.numero_comprobante || ''} emitida correctamente`);
      setVenta(null);
      setItems([]);
      setQuery('');
      setResultados(null);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al emitir la nota de crédito');
    } finally {
      setEnviando(false);
    }
  };

  const columnsBusqueda: ColumnsType<Venta> = [
    { title: 'Comprobante', render: (_, v) => v.numero_comprobante || `${v.serie}-${String(v.correlativo).padStart(8, '0')}` },
    { title: 'Fecha', render: (_, v) => new Date(v.fecha_emision).toLocaleDateString('es-PE') },
    { title: 'Cliente', render: (_, v) => v.cliente?.razon_social || '-' },
    { title: 'Total', align: 'right', render: (_, v) => formatMoneda(v.total, v.moneda) },
    { title: 'SUNAT', align: 'center', render: (_, v) => <EstadoTag estado={v.estado_sunat} /> },
    { title: '', align: 'center', width: 100, render: (_, v) => <Button size="small" type="primary" danger icon={<FileExcelOutlined />} onClick={() => seleccionar(v.id)}>Elegir</Button> },
  ];

  if (!venta) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Nueva Nota de Crédito</Typography.Title>
          <Link to="/ventas"><Button icon={<ArrowLeftOutlined />}>Volver al listado</Button></Link>
        </div>
        <Card size="small" title="1. Buscar el comprobante (Factura o Boleta) a acreditar">
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input placeholder="N° de comprobante o cliente..." value={query} onChange={(e) => setQuery(e.target.value)} onPressEnter={buscar} />
            <Button type="primary" icon={<SearchOutlined />} loading={buscando} onClick={buscar}>Buscar</Button>
          </Space.Compact>
          <Table
            size="small" rowKey="id" columns={columnsBusqueda} dataSource={resultados || []}
            pagination={false}
            locale={{ emptyText: resultados === null ? 'Busque por número de comprobante o cliente' : 'Sin resultados acreditables' }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Nueva Nota de Crédito</Typography.Title>
        <Link to="/ventas"><Button icon={<ArrowLeftOutlined />}>Volver al listado</Button></Link>
      </div>

      <Card
        size="small"
        title="2. Datos de la Nota de Crédito"
        extra={<Button size="small" icon={<ArrowLeftOutlined />} onClick={volverABuscar}>Elegir otro comprobante</Button>}
      >
        <Typography.Paragraph type="secondary">
          Acreditando <strong>{venta.numero_comprobante}</strong> — Cliente: {venta.cliente?.razon_social || '-'} — Total original: {formatMoneda(venta.total, venta.moneda)}
        </Typography.Paragraph>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Motivo *</Typography.Text>
            <Select value={codigoMotivo} onChange={cambiarMotivo} style={{ width: '100%' }} options={CODIGOS_MOTIVO_NOTA_CREDITO} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Serie *</Typography.Text>
            <Select
              value={idSerie} onChange={setIdSerie} style={{ width: '100%' }}
              placeholder={series.length ? 'Seleccione' : 'Sin serie configurada'}
              options={series.map((s) => ({ value: s.id, label: s.serie }))}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Detalle del motivo *</Typography.Text>
          <Input value={motivoTexto} onChange={(e) => setMotivoTexto(e.target.value)} placeholder="Explique brevemente el motivo" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Switch checked={afectaStock} onChange={setAfectaStock} style={{ marginRight: 8 }} />
          <Typography.Text>Implica devolución física de mercadería (repone stock)</Typography.Text>
        </div>

        <Typography.Title level={5}>Ítems a acreditar</Typography.Title>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, minWidth: 520 }}>
          <thead>
            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
              <th style={{ width: 40, padding: 6 }}></th>
              <th style={{ padding: 6 }}>Producto</th>
              <th style={{ width: 110, padding: 6, textAlign: 'right' }}>Cant. original</th>
              <th style={{ width: 130, padding: 6, textAlign: 'right' }}>Cant. a acreditar</th>
              <th style={{ width: 110, padding: 6, textAlign: 'right' }}>Total línea</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.detalle.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: 6 }}>
                  <input
                    type="checkbox" checked={it.marcado} disabled={esAnulacionTotal}
                    onChange={(e) => actualizarItem(it.detalle.id, { marcado: e.target.checked, cantidad: e.target.checked ? Number(it.detalle.cantidad) : 0 })}
                  />
                </td>
                <td style={{ padding: 6 }}>{it.detalle.producto?.nombre || it.detalle.id_producto}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{Number(it.detalle.cantidad).toFixed(2)}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>
                  <InputNumber
                    size="small" min={0.01} max={Number(it.detalle.cantidad)} step={0.01}
                    value={it.cantidad} disabled={!it.marcado || esAnulacionTotal}
                    onChange={(v) => actualizarItem(it.detalle.id, { cantidad: v ?? 0 })}
                    style={{ width: '100%' }}
                  />
                </td>
                <td style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>
                  {formatMoneda(redondear2(Number(it.detalle.precio_unitario) * Math.min(it.cantidad || 0, Number(it.detalle.cantidad))), venta.moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          Si el motivo es "Anulación de la operación", debe incluir todos los ítems por su cantidad completa — el sistema marcará la venta original como anulada automáticamente.
        </Typography.Paragraph>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            Total a acreditar: <span style={{ color: '#ff4d4f', marginLeft: 8 }}>{formatMoneda(total, venta.moneda)}</span>
          </Typography.Text>
          <Button type="primary" danger loading={enviando} onClick={confirmar}>Emitir Nota de Crédito</Button>
        </div>
      </Card>
    </div>
  );
}
