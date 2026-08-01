import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { App, Modal, Form, Input, InputNumber, Select, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { clientesApi } from '@/api/clientes';
import { ApiError } from '@/api/types';
import type { Cliente, CreateClienteDto } from '@/types/cliente';

const schema = z.object({
  tipo_documento: z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE']),
  numero_documento: z.string().min(1, 'Ingrese el número de documento'),
  razon_social: z.string().min(1, 'Ingrese la razón social / nombre'),
  nombre_comercial: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  limite_credito: z.number().min(0).optional(),
  dias_credito: z.number().min(0).optional(),
});
type FormValues = z.infer<typeof schema>;

const VACIO: FormValues = {
  tipo_documento: 'DNI',
  numero_documento: '',
  razon_social: '',
  nombre_comercial: '',
  email: '',
  telefono: '',
  direccion: '',
  limite_credito: 0,
  dias_credito: 0,
};

interface Props {
  open: boolean;
  cliente: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ClienteFormModal({ open, cliente, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const { message } = App.useApp();
  const { control, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VACIO,
  });

  useEffect(() => {
    if (!open) return;
    reset(cliente ? {
      tipo_documento: cliente.tipo_documento,
      numero_documento: cliente.numero_documento,
      razon_social: cliente.razon_social,
      nombre_comercial: cliente.nombre_comercial || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      limite_credito: Number(cliente.limite_credito || 0),
      dias_credito: cliente.dias_credito || 0,
    } : VACIO);
  }, [open, cliente, reset]);

  const consultarDocumento = async () => {
    const tipo = getValues('tipo_documento');
    const numero = getValues('numero_documento').trim();
    if (!numero) { message.warning('Ingrese el número de documento'); return; }
    if (tipo !== 'DNI' && tipo !== 'RUC') { message.warning('Solo se puede consultar DNI o RUC'); return; }
    setConsultando(true);
    try {
      const { data } = await clientesApi.consultarDocumento(tipo.toLowerCase() as 'dni' | 'ruc', numero);
      setValue('razon_social', data.razon_social || data.nombre_completo || '');
      if (data.direccion) setValue('direccion', data.direccion);
      message.success('Datos obtenidos correctamente');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo consultar el documento');
    } finally {
      setConsultando(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const dto: CreateClienteDto = {
      ...values,
      nombre_comercial: values.nombre_comercial || undefined,
      email: values.email || undefined,
      telefono: values.telefono || undefined,
      direccion: values.direccion || undefined,
    };
    setSaving(true);
    try {
      if (cliente) await clientesApi.actualizar(cliente.id, dto);
      else await clientesApi.crear(dto);
      message.success(cliente ? 'Cliente actualizado' : 'Cliente creado');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Form.Item label="Tipo documento">
            <Controller name="tipo_documento" control={control} render={({ field }) => (
              <Select {...field} options={[
                { value: 'RUC', label: 'RUC' },
                { value: 'DNI', label: 'DNI' },
                { value: 'CE', label: 'Carné extranjería' },
                { value: 'PASAPORTE', label: 'Pasaporte' },
              ]} />
            )} />
          </Form.Item>
          <Form.Item label="Número documento" validateStatus={errors.numero_documento ? 'error' : ''} help={errors.numero_documento?.message}>
            <Controller name="numero_documento" control={control} render={({ field }) => (
              <Input {...field} suffix={
                <Button type="text" size="small" icon={<SearchOutlined />} loading={consultando} onClick={consultarDocumento} title="Consultar SUNAT/RENIEC" />
              } />
            )} />
          </Form.Item>
        </div>

        <Form.Item label="Razón social / Nombre" validateStatus={errors.razon_social ? 'error' : ''} help={errors.razon_social?.message}>
          <Controller name="razon_social" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Nombre comercial">
            <Controller name="nombre_comercial" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email?.message}>
            <Controller name="email" control={control} render={({ field }) => <Input {...field} type="email" />} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Form.Item label="Teléfono">
            <Controller name="telefono" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Límite crédito (S/)">
            <Controller name="limite_credito" control={control} render={({ field }) => (
              <InputNumber {...field} min={0} step={0.01} style={{ width: '100%' }} />
            )} />
          </Form.Item>
          <Form.Item label="Días crédito">
            <Controller name="dias_credito" control={control} render={({ field }) => (
              <InputNumber {...field} min={0} style={{ width: '100%' }} />
            )} />
          </Form.Item>
        </div>

        <Form.Item label="Dirección">
          <Controller name="direccion" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
