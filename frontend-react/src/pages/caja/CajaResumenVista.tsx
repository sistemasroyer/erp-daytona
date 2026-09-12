import { useState } from 'react';
import { Card, Table, Typography, Tag, Empty, Row, Col, Modal, Descriptions } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { WalletOutlined, AuditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatMoneda } from '@/utils/format';
import type { MovimientoCaja, ResumenCaja, ArqueoCaja } from '@/types/caja';

const columns: ColumnsType<MovimientoCaja> = [
  { title: 'Hora', dataIndex: 'fecha', render: (v) => dayjs(v).format('HH:mm:ss') },
  { title: 'Tipo', dataIndex: 'tipo', render: (v) => <Tag color={v === 'ingreso' ? 'success' : 'error'}>{v}</Tag> },
  { title: 'Concepto', dataIndex: 'concepto' },
  { title: 'Comprobante', render: (_, m) => m.numero_comprobante || '-' },
  { title: 'Método', render: (_, m) => m.metodo_pago?.nombre || '-' },
  {
    title: 'Monto', align: 'right',
    render: (_, m) => (
      <Typography.Text strong type={m.tipo === 'ingreso' ? 'success' : 'danger'}>
        {m.tipo === 'ingreso' ? '+' : '-'}{formatMoneda(m.monto)}
      </Typography.Text>
    ),
  },
];

function ArqueoDetalleModal({ arqueo, onClose }: { arqueo: ArqueoCaja | null; onClose: () => void }) {
  return (
    <Modal title="Detalle del arqueo" open={!!arqueo} onCancel={onClose} footer={null} destroyOnHidden>
      {arqueo && (
        <>
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Hora">{dayjs(arqueo.fecha_arqueo).format('DD/MM/YYYY HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="Cajero">{arqueo.usuario ? `${arqueo.usuario.nombre} ${arqueo.usuario.apellido}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Saldo sistema">{formatMoneda(arqueo.monto_sistema)}</Descriptions.Item>
            <Descriptions.Item label="Monto contado">{formatMoneda(arqueo.monto_contado)}</Descriptions.Item>
            <Descriptions.Item label="Diferencia">
              <Typography.Text type={Number(arqueo.diferencia) >= 0 ? 'success' : 'danger'} strong>
                {Number(arqueo.diferencia) >= 0 ? '+' : ''}{formatMoneda(arqueo.diferencia)}
              </Typography.Text>
            </Descriptions.Item>
            {arqueo.observaciones && <Descriptions.Item label="Observaciones">{arqueo.observaciones}</Descriptions.Item>}
          </Descriptions>
          {arqueo.detalle_denominaciones.map((d) => (
            <div key={`${d.tipo}-${d.denominacion}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>S/ {d.denominacion.toFixed(2)} × {d.cantidad}</span>
              <strong>{formatMoneda(d.subtotal)}</strong>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

export function CajaResumenVista({ resumen, arqueos }: { resumen: ResumenCaja; arqueos?: ArqueoCaja[] }) {
  const [arqueoSeleccionado, setArqueoSeleccionado] = useState<ArqueoCaja | null>(null);

  const columnsArqueos: ColumnsType<ArqueoCaja> = [
    { title: 'Hora', dataIndex: 'fecha_arqueo', render: (v) => dayjs(v).format('HH:mm:ss') },
    { title: 'Cajero', render: (_, a) => a.usuario ? `${a.usuario.nombre} ${a.usuario.apellido}` : '-' },
    { title: 'Sistema', align: 'right', render: (_, a) => formatMoneda(a.monto_sistema) },
    { title: 'Contado', align: 'right', render: (_, a) => formatMoneda(a.monto_contado) },
    {
      title: 'Diferencia', align: 'right',
      render: (_, a) => (
        <Typography.Text strong type={Number(a.diferencia) >= 0 ? 'success' : 'danger'}>
          {Number(a.diferencia) >= 0 ? '+' : ''}{formatMoneda(a.diferencia)}
        </Typography.Text>
      ),
    },
    {
      title: '', render: (_, a) => (
        <a onClick={() => setArqueoSeleccionado(a)}>Ver detalle</a>
      ),
    },
  ];

  return (
    <>
      {arqueos !== undefined && (
        <Card title={<><AuditOutlined style={{ marginRight: 8 }} />Arqueos de caja</>} style={{ marginBottom: 16 }}>
          {arqueos.length
            ? <Table<ArqueoCaja> rowKey="id" columns={columnsArqueos} dataSource={arqueos} pagination={false} scroll={{ x: 'max-content' }} />
            : <Empty description="Sin arqueos registrados" />}
        </Card>
      )}
      <ArqueoDetalleModal arqueo={arqueoSeleccionado} onClose={() => setArqueoSeleccionado(null)} />
      {!!resumen.resumen.por_metodo_pago.length && (
        <Card title="Resumen por método de pago" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {resumen.resumen.por_metodo_pago.map((m) => (
              <Col span={6} key={m.id_metodo_pago}>
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{m.nombre}</Typography.Text>
                  <Typography.Title level={5} style={{ margin: '4px 0' }}>{formatMoneda(m.ingresos - m.egresos)}</Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {m.ingresos > 0 && <>+{formatMoneda(m.ingresos)} </>}
                    {m.egresos > 0 && <>-{formatMoneda(m.egresos)}</>}
                  </Typography.Text>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card title={<><WalletOutlined style={{ marginRight: 8 }} />Movimientos de caja</>}>
        {resumen.movimientos.length
          ? <Table<MovimientoCaja> rowKey="id" columns={columns} dataSource={resumen.movimientos} pagination={false} scroll={{ x: 'max-content' }} />
          : <Empty description="Sin movimientos" />}
      </Card>
    </>
  );
}
