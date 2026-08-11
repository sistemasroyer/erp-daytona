import { useQuery } from '@tanstack/react-query';
import { Modal, Descriptions, Tag } from 'antd';
import dayjs from 'dayjs';
import { cajaApi } from '@/api/caja';
import { formatMoneda } from '@/utils/format';
import { CajaResumenVista } from './CajaResumenVista';

export function CajaHistorialDetalleModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['caja-resumen', id],
    queryFn: () => cajaApi.resumen(id!),
    enabled: !!id,
  });
  const resumen = data?.data;
  const apertura = resumen?.apertura;

  return (
    <Modal title="Detalle de apertura de caja" open={!!id} onCancel={onClose} footer={null} width={800} destroyOnHidden>
      {apertura && (
        <>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Caja">{apertura.caja?.nombre || '-'}</Descriptions.Item>
            <Descriptions.Item label="Estado">
              <Tag color={apertura.estado === 'abierta' ? 'success' : 'default'}>{apertura.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Cajero">{apertura.usuario ? `${apertura.usuario.nombre} ${apertura.usuario.apellido}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Apertura">{dayjs(apertura.fecha_apertura).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="Cierre">{apertura.fecha_cierre ? dayjs(apertura.fecha_cierre).format('DD/MM/YYYY HH:mm') : '-'}</Descriptions.Item>
            <Descriptions.Item label="Monto apertura">{formatMoneda(apertura.monto_apertura)}</Descriptions.Item>
            <Descriptions.Item label="Monto cierre">{apertura.monto_cierre !== null ? formatMoneda(apertura.monto_cierre) : '-'}</Descriptions.Item>
            <Descriptions.Item label="Diferencia">{apertura.diferencia !== null ? formatMoneda(apertura.diferencia) : '-'}</Descriptions.Item>
          </Descriptions>
          <CajaResumenVista resumen={resumen!} />
        </>
      )}
    </Modal>
  );
}
