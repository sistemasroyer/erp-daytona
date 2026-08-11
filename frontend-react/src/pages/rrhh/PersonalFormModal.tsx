import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { App, Modal, Form, Input, InputNumber, Select, DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { rrhhApi } from '@/api/rrhh';
import { ApiError } from '@/api/types';
import { TIPOS_CONTRATO, type Personal, type CreatePersonalDto } from '@/types/personal';

const BANCOS = ['BCP', 'BBVA', 'Interbank', 'Scotiabank', 'BanBif', 'Otro'];

const schema = z.object({
  dni: z.string().min(1, 'Ingrese el DNI'),
  nombres: z.string().min(1, 'Ingrese los nombres'),
  apellidos: z.string().min(1, 'Ingrese los apellidos'),
  cargo: z.string().optional(),
  area: z.string().optional(),
  tipo_contrato: z.enum(['indefinido', 'plazo_fijo', 'services', 'practicas', 'locacion_servicios']),
  fecha_ingreso: z.custom<Dayjs>((v) => dayjs.isDayjs(v), 'Ingrese la fecha de ingreso'),
  sueldo: z.number().min(0, 'Ingrese el sueldo'),
  banco: z.string().optional(),
  cuenta_bancaria: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const vacio = (): FormValues => ({
  dni: '', nombres: '', apellidos: '', cargo: '', area: '',
  tipo_contrato: 'indefinido', fecha_ingreso: dayjs(), sueldo: 0, banco: '', cuenta_bancaria: '',
});

interface Props {
  open: boolean;
  personal: Personal | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PersonalFormModal({ open, personal, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: vacio(),
  });

  useEffect(() => {
    if (!open) return;
    reset(personal ? {
      dni: personal.dni,
      nombres: personal.nombres,
      apellidos: personal.apellidos,
      cargo: personal.cargo || '',
      area: personal.area || '',
      tipo_contrato: personal.tipo_contrato,
      fecha_ingreso: dayjs(personal.fecha_ingreso),
      sueldo: Number(personal.sueldo),
      banco: personal.banco || '',
      cuenta_bancaria: personal.cuenta_bancaria || '',
    } : vacio());
  }, [open, personal, reset]);

  const onSubmit = async (values: FormValues) => {
    const dto: CreatePersonalDto = {
      ...values,
      fecha_ingreso: values.fecha_ingreso.format('YYYY-MM-DD'),
      cargo: values.cargo || undefined,
      area: values.area || undefined,
      banco: values.banco || undefined,
      cuenta_bancaria: values.cuenta_bancaria || undefined,
    };
    setSaving(true);
    try {
      if (personal) await rrhhApi.actualizar(personal.id, dto);
      else await rrhhApi.crear(dto);
      message.success(personal ? 'Personal actualizado' : 'Personal registrado');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el personal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={personal ? 'Editar Personal' : 'Nuevo Personal'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      confirmLoading={saving}
      okText="Guardar"
      cancelText="Cancelar"
      width={640}
      destroyOnHidden
    >
      <Form layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <Form.Item label="DNI" validateStatus={errors.dni ? 'error' : ''} help={errors.dni?.message}>
            <Controller name="dni" control={control} render={({ field }) => <Input {...field} maxLength={8} />} />
          </Form.Item>
          <Form.Item label="Nombres" validateStatus={errors.nombres ? 'error' : ''} help={errors.nombres?.message}>
            <Controller name="nombres" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Apellidos" validateStatus={errors.apellidos ? 'error' : ''} help={errors.apellidos?.message}>
            <Controller name="apellidos" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <Form.Item label="Cargo">
            <Controller name="cargo" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Área">
            <Controller name="area" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Tipo contrato">
            <Controller name="tipo_contrato" control={control} render={({ field }) => (
              <Select {...field} options={TIPOS_CONTRATO} />
            )} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Form.Item label="Fecha ingreso" validateStatus={errors.fecha_ingreso ? 'error' : ''} help={errors.fecha_ingreso?.message}>
            <Controller name="fecha_ingreso" control={control} render={({ field }) => (
              <DatePicker {...field} style={{ width: '100%' }} format="DD/MM/YYYY" />
            )} />
          </Form.Item>
          <Form.Item label="Sueldo (S/)" validateStatus={errors.sueldo ? 'error' : ''} help={errors.sueldo?.message}>
            <Controller name="sueldo" control={control} render={({ field }) => (
              <InputNumber {...field} min={0} step={0.01} style={{ width: '100%' }} />
            )} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Form.Item label="Banco">
            <Controller name="banco" control={control} render={({ field }) => (
              <Select {...field} allowClear placeholder="Sin cuenta" options={BANCOS.map((b) => ({ value: b, label: b }))} />
            )} />
          </Form.Item>
          <Form.Item label="Cuenta bancaria">
            <Controller name="cuenta_bancaria" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
