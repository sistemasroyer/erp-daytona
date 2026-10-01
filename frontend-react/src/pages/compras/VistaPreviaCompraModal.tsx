import { Alert, Descriptions, Modal, Table, Tag, Typography } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { formatMoneda } from '@/utils/format';

export interface LineaVistaPrevia {
  key: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  afecta_igv: boolean;
  /** Montos en la moneda de la factura. */
  precio_unit_sin_igv: number;
  subtotal: number;
  igv: number;
  total: number;
}

interface Props {
  open: boolean;
  guardando: boolean;
  tipoDocumento: string;
  serie: string;
  numero: string;
  fechaEmision: Dayjs;
  proveedor: { ruc: string; razon_social: string };
  condicionPago: 'contado' | 'credito';
  fechaVencimiento: Dayjs | null;
  almacen: string;
  moneda: 'PEN' | 'USD';
  tipoCambio: number;
  observaciones: string;
  flete: { monto: number; moneda: 'PEN' | 'USD'; prorrateo: 'precio' | 'cantidad'; transportista?: string; gasto?: string } | null;
  lineas: LineaVistaPrevia[];
  totales: { subtotal: number; igvTotal: number; total: number };
  porcentajeIgv: number;
  /** Total de la factura escrito para verificar (si se ingresó). */
  totalVerificacion?: number;
  onCancelar: () => void;
  onConfirmar: () => void;
}

const TIPO_DOC: Record<string, string> = { factura: 'FACTURA', boleta: 'BOLETA', nota: 'NOTA', otros: 'OTROS' };

/** Vista previa de la factura de compra antes de guardarla: se revisa todo y se confirma. */
export function VistaPreviaCompraModal(p: Props) {
  const m = p.moneda;
  const avisos: string[] = [];
  if (p.totalVerificacion !== undefined && Math.abs(p.totalVerificacion - p.totales.total) >= 0.05) {
    avisos.push(`El total calculado (${formatMoneda(p.totales.total, m)}) no cuadra con el total de la factura que escribió (${formatMoneda(p.totalVerificacion, m)}).`);
  }
  if (p.fechaEmision.isAfter(new Date(), 'day')) avisos.push('La fecha de emisión es futura.');
  if (p.condicionPago === 'credito' && p.fechaVencimiento && p.fechaVencimiento.isBefore(p.fechaEmision, 'day')) {
    avisos.push('La fecha de vencimiento es anterior a la de emisión.');
  }
  if (p.flete && !p.flete.transportista && !p.flete.gasto) avisos.push('El flete no tiene transportista ni factura de flete vinculada.');

  return (
    <Modal
      open={p.open}
      title="Revise la compra antes de guardarla"
      width={900}
      onCancel={p.onCancelar}
      onOk={p.onConfirmar}
      okText="Sí, guardar compra"
      cancelText="Volver a editar"
      confirmLoading={p.guardando}
      maskClosable={false}
      destroyOnHidden
    >
      <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <Typography.Text type="secondary">Proveedor</Typography.Text>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{p.proveedor.razon_social}</div>
            <div>RUC {p.proveedor.ruc}</div>
          </div>
          <div style={{ border: '2px solid #1677ff', borderRadius: 6, padding: '6px 16px', textAlign: 'center', minWidth: 200 }}>
            <div style={{ fontWeight: 600 }}>{TIPO_DOC[p.tipoDocumento] ?? p.tipoDocumento.toUpperCase()}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{p.serie ? `${p.serie.toUpperCase()}-` : ''}{p.numero.toUpperCase()}</div>
          </div>
        </div>

        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="Emisión">{p.fechaEmision.format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Condición">
            {p.condicionPago === 'credito'
              ? <><Tag color="warning">Crédito</Tag>vence {p.fechaVencimiento?.format('DD/MM/YYYY')}</>
              : <Tag color="success">Contado</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Moneda">{m === 'USD' ? `Dólares (T.C. ${p.tipoCambio.toFixed(3)})` : 'Soles'}</Descriptions.Item>
          <Descriptions.Item label="Almacén destino">{p.almacen}</Descriptions.Item>
          {p.observaciones.trim() && <Descriptions.Item label="Observaciones" span={2}>{p.observaciones.toUpperCase()}</Descriptions.Item>}
        </Descriptions>

        <Table<LineaVistaPrevia>
          size="small" rowKey="key" pagination={false} dataSource={p.lineas} scroll={{ x: 'max-content', y: 320 }}
          columns={[
            { title: '#', width: 40, render: (_, __, i) => i + 1 },
            { title: 'Producto', render: (_, l) => <>{l.nombre} <Typography.Text type="secondary">{l.codigo}</Typography.Text>{!l.afecta_igv && <Tag style={{ marginLeft: 6 }}>Sin IGV</Tag>}</> },
            { title: 'Cant.', align: 'right', render: (_, l) => l.cantidad },
            { title: 'P. unit. s/IGV', align: 'right', render: (_, l) => formatMoneda(l.precio_unit_sin_igv, m) },
            { title: 'Subtotal', align: 'right', render: (_, l) => formatMoneda(l.subtotal, m) },
            { title: 'Total', align: 'right', render: (_, l) => <strong>{formatMoneda(l.total, m)}</strong> },
          ]}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatMoneda(p.totales.subtotal, m)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IGV {p.porcentajeIgv}%</span><span>{formatMoneda(p.totales.igvTotal, m)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, borderTop: '1px solid #d9d9d9', marginTop: 4, paddingTop: 4 }}>
              <span>TOTAL</span><span style={{ color: '#389e0d' }}>{formatMoneda(p.totales.total, m)}</span>
            </div>
            {m === 'USD' && <Typography.Text type="secondary" style={{ fontSize: 12 }}>≈ {formatMoneda(p.totales.total * p.tipoCambio, 'PEN')} al T.C. {p.tipoCambio.toFixed(3)}</Typography.Text>}
          </div>
        </div>

        {p.flete && (
          <div style={{ background: '#fafafa', borderRadius: 6, padding: 8, marginTop: 12 }}>
            <CarOutlined /> <strong>Flete aparte:</strong> {formatMoneda(p.flete.monto, p.flete.moneda)}, prorrateado por {p.flete.prorrateo === 'precio' ? 'valor' : 'cantidad'} al costo de los productos
            {p.flete.transportista && ` · Transportista: ${p.flete.transportista}`}
            {p.flete.gasto && ` · Factura de flete: ${p.flete.gasto}`}
          </div>
        )}
      </div>

      <Typography.Paragraph style={{ marginTop: 12, marginBottom: avisos.length ? 8 : 0 }}>
        {p.lineas.length} producto(s), {p.lineas.reduce((s, l) => s + l.cantidad, 0)} unidad(es) entrarán al almacén <strong>{p.almacen}</strong>.
      </Typography.Paragraph>
      {avisos.map((a) => <Alert key={a} type="warning" showIcon title={a} style={{ marginTop: 6 }} />)}
    </Modal>
  );
}
