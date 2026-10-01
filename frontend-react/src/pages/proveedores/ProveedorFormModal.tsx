import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { App, Modal, Form, Input, InputNumber, Button, Switch } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { proveedoresApi } from '@/api/proveedores';
import { ApiError } from '@/api/types';
import type { Proveedor, CreateProveedorDto } from '@/types/proveedor';
import { useBorradorConLista } from '@/hooks/useBorrador';
import { BorradorBanner } from '@/components/BorradorBanner';

const schema = z.object({
  ruc: z.string().length(11, 'El RUC debe tener 11 dígitos'),
  razon_social: z.string().min(1, 'Ingrese la razón social'),
  nombre_comercial: z.string().optional(),
  contacto: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  cuenta_detraccion: z.string().optional(),
  direccion: z.string().optional(),
  dias_credito: z.number().min(0).optional(),
  letras_pago_unico: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

const VACIO: FormValues = {
  ruc: '', razon_social: '', nombre_comercial: '', contacto: '',
  email: '', telefono: '', cuenta_detraccion: '', direccion: '', dias_credito: 0, letras_pago_unico: false,
};

interface Props {
  open: boolean;
  proveedor: Proveedor | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProveedorFormModal({ open, proveedor, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const { message } = App.useApp();
  const { control, handleSubmit, reset, setValue, getValues, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VACIO,
  });

  useEffect(() => {
    if (!open) return;
    reset(proveedor ? {
      ruc: proveedor.ruc,
      razon_social: proveedor.razon_social,
      nombre_comercial: proveedor.nombre_comercial || '',
      contacto: proveedor.contacto || '',
      email: proveedor.email || '',
      telefono: proveedor.telefono || '',
      cuenta_detraccion: proveedor.cuenta_detraccion || '',
      direccion: proveedor.direccion || '',
      dias_credito: proveedor.dias_credito || 0,
      letras_pago_unico: proveedor.letras_pago_unico ?? false,
    } : VACIO);
  }, [open, proveedor, reset]);

  // Borrador local solo al crear (recuperación ante corte de luz/internet o cierre accidental)
  const borrador = useBorradorConLista<FormValues>('proveedor', watch(), {
    vacio: (d) => !d.ruc.trim() && !d.razon_social.trim(),
    onRestaurar: (d) => reset({ ...VACIO, ...d }),
    habilitado: !proveedor,
    abierto: open,
  });

  const consultarRuc = async () => {
    const ruc = getValues('ruc').trim();
    if (ruc.length !== 11) { message.warning('El RUC debe tener 11 dígitos'); return; }
    setConsultando(true);
    try {
      const { data } = await proveedoresApi.consultarRuc(ruc);
      setValue('razon_social', data.razon_social || '');
      if (data.direccion) setValue('direccion', data.direccion);
      message.success('Datos obtenidos de SUNAT');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo consultar el RUC');
    } finally {
      setConsultando(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const dto: CreateProveedorDto = {
      ...values,
      nombre_comercial: values.nombre_comercial || undefined,
      contacto: values.contacto || undefined,
      email: values.email || undefined,
      telefono: values.telefono || undefined,
      cuenta_detraccion: values.cuenta_detraccion || undefined,
      direccion: values.direccion || undefined,
    };
    setSaving(true);
    try {
      if (proveedor) await proveedoresApi.actualizar(proveedor.id, dto);
      else await proveedoresApi.crear(dto);
      borrador.limpiar();
      message.success(proveedor ? 'Proveedor actualizado' : 'Proveedor creado');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el proveedor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      confirmLoading={saving}
      okText="Guardar"
      cancelText="Cancelar"
      width={640}
      destroyOnHidden
    >
      <BorradorBanner
        borradores={borrador.borradores}
        resumen={(d) => `RUC ${d.ruc || 's/n'} — ${d.razon_social || 'Sin razón social'}`}
        onRestaurar={borrador.restaurar}
        onDescartar={borrador.descartar}
      />
      <Form layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Form.Item label="RUC" validateStatus={errors.ruc ? 'error' : ''} help={errors.ruc?.message}>
            <Controller name="ruc" control={control} render={({ field }) => (
              <Input {...field} maxLength={11} suffix={
                <Button type="text" size="small" icon={<SearchOutlined />} loading={consultando} onClick={consultarRuc} title="Consultar SUNAT" />
              } />
            )} />
          </Form.Item>
          <Form.Item label="Razón Social" validateStatus={errors.razon_social ? 'error' : ''} help={errors.razon_social?.message}>
            <Controller name="razon_social" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Form.Item label="Nombre Comercial">
            <Controller name="nombre_comercial" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Contacto">
            <Controller name="contacto" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <Form.Item label="Teléfono">
            <Controller name="telefono" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email?.message}>
            <Controller name="email" control={control} render={({ field }) => <Input {...field} type="email" />} />
          </Form.Item>
          <Form.Item label="Días de crédito">
            <Controller name="dias_credito" control={control} render={({ field }) => (
              <InputNumber {...field} min={0} style={{ width: '100%' }} />
            )} />
          </Form.Item>
          <Form.Item label="Letras: pago único" help="Exige pagar sus paquetes en una sola cuota">
            <Controller name="letras_pago_unico" control={control} render={({ field }) => (
              <Switch checked={!!field.value} onChange={field.onChange} />
            )} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Form.Item label="Cuenta detracción">
            <Controller name="cuenta_detraccion" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Dirección">
            <Controller name="direccion" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
