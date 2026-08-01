import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { App, Modal, Form, Input } from 'antd';
import { rolesApi } from '@/api/roles';
import { ApiError } from '@/api/types';
import type { Rol } from '@/types/rol';

const schema = z.object({
  nombre: z.string().min(1, 'Ingrese el nombre del rol'),
  descripcion: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  rol: Rol | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RolFormModal({ open, rol, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', descripcion: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset(rol ? { nombre: rol.nombre, descripcion: rol.descripcion || '' } : { nombre: '', descripcion: '' });
  }, [open, rol, reset]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const dto = { nombre: values.nombre, descripcion: values.descripcion || undefined };
      if (rol) await rolesApi.actualizar(rol.id, dto);
      else await rolesApi.crear(dto);
      message.success(rol ? 'Rol actualizado' : 'Rol creado');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el rol');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={rol ? 'Editar Rol' : 'Nuevo Rol'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      confirmLoading={saving}
      okText="Guardar"
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label="Nombre" validateStatus={errors.nombre ? 'error' : ''} help={errors.nombre?.message}>
          <Controller name="nombre" control={control} render={({ field }) => <Input {...field} autoFocus />} />
        </Form.Item>
        <Form.Item label="Descripción">
          <Controller name="descripcion" control={control} render={({ field }) => <Input.TextArea {...field} rows={2} />} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
