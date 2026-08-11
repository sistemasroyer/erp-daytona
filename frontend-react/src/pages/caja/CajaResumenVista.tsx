import { Card, Table, Typography, Tag, Empty, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatMoneda } from '@/utils/format';
import type { MovimientoCaja, ResumenCaja } from '@/types/caja';

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

export function CajaResumenVista({ resumen }: { resumen: ResumenCaja }) {
  return (
    <>
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
