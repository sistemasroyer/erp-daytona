import { useQuery } from '@tanstack/react-query';
import { Modal, Descriptions, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { inventarioApi } from '@/api/inventario';
import { formatMoneda } from '@/utils/format';
import { MOTIVO_AJUSTE_LABEL } from '@/types/ajuste-inventario';

export function AjusteDetalleModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isFetching } = useQuery({
    queryKey: ['ajuste-inventario', id],
    queryFn: () => inventarioApi.obtenerAjuste(id!),
    enabled: !!id,
  });
  const detalle = data?.data;

  return (
    <Modal title="Detalle del Ajuste" open={!!id} onCancel={onClose} footer={null} width={700} destroyOnHidden>
      {isFetching || !detalle ? 'Cargando...' : (
        <>
          <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="N° Ajuste"><strong>{detalle.numero_interno}</strong></Descriptions.Item>
            <Descriptions.Item label="Fecha">{dayjs(detalle.fecha_ajuste).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Almacén">{detalle.almacen?.nombre || '-'}</Descriptions.Item>
            <Descriptions.Item label="Motivo">{MOTIVO_AJUSTE_LABEL[detalle.motivo] || detalle.motivo}</Descriptions.Item>
            {detalle.observaciones && <Descriptions.Item label="Observaciones" span={2}>{detalle.observaciones}</Descriptions.Item>}
          </Descriptions>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={detalle.detalle}
            columns={[
              { title: 'Producto', render: (_, d: (typeof detalle.detalle)[number]) => <>{d.producto?.nombre || d.id_producto} <Typography.Text type="secondary">{d.producto?.codigo}</Typography.Text></> },
              { title: 'Tipo', align: 'center', render: (_, d: (typeof detalle.detalle)[number]) => d.tipo === 'ajuste_positivo' ? <Tag color="success">Entrada (+)</Tag> : <Tag color="error">Salida (-)</Tag> },
              { title: 'Cantidad', align: 'right', render: (_, d: (typeof detalle.detalle)[number]) => Number(d.cantidad).toFixed(0) },
              { title: 'Costo Unit.', align: 'right', render: (_, d: (typeof detalle.detalle)[number]) => formatMoneda(d.costo_unitario) },
              { title: 'Costo Total', align: 'right', render: (_, d: (typeof detalle.detalle)[number]) => <strong>{formatMoneda(Number(d.cantidad) * Number(d.costo_unitario))}</strong> },
            ]}
          />
        </>
      )}
    </Modal>
  );
}
