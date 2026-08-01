import { useState } from 'react';
import { App, Modal, DatePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { rrhhApi } from '@/api/rrhh';
import { ApiError } from '@/api/types';
import type { Personal } from '@/types/personal';

interface Props {
  personal: Personal | null;
  onClose: () => void;
  onSaved: () => void;
}

// Reemplaza el prompt() nativo que usaba la app vieja para pedir la fecha de cese.
export function CesarModal({ personal, onClose, onSaved }: Props) {
  const [fecha, setFecha] = useState<Dayjs | null>(dayjs());
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  const confirmar = async () => {
    if (!personal || !fecha) return;
    setSaving(true);
    try {
      await rrhhApi.cesar(personal.id, fecha.format('YYYY-MM-DD'));
      message.success('Personal cesado');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cesar al personal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Cese de Personal"
      open={!!personal}
      onCancel={onClose}
      onOk={confirmar}
      confirmLoading={saving}
      okText="Confirmar"
      okType="danger"
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Typography.Paragraph>
        Fecha de cese para <strong>{personal?.nombres} {personal?.apellidos}</strong>:
      </Typography.Paragraph>
      <DatePicker value={fecha} onChange={setFecha} style={{ width: '100%' }} format="DD/MM/YYYY" />
    </Modal>
  );
}
