import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { App, Modal, Form, Input, Select, Tabs, Checkbox, Row, Col, Typography } from 'antd';
import { usuariosApi } from '@/api/usuarios';
import { seriesDocumentoApi } from '@/api/series-documento';
import { rolesApi } from '@/api/roles';
import { ApiError } from '@/api/types';
import type { Usuario } from '@/types/usuario';

const schemaDatos = z.object({
  nombre: z.string().min(1, 'Ingrese el nombre'),
  apellido: z.string().min(1, 'Ingrese el apellido'),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
  id_punto_venta: z.string().optional(),
  password: z.string().optional(),
});
type FormValues = z.infer<typeof schemaDatos>;

const passwordSchema = z.object({
  password_nuevo: z.string().min(8, 'Mínimo 8 caracteres'),
  password_confirmar: z.string(),
}).refine((v) => v.password_nuevo === v.password_confirmar, {
  message: 'Las contraseñas no coinciden', path: ['password_confirmar'],
});
type PasswordValues = z.infer<typeof passwordSchema>;

interface Props {
  open: boolean;
  usuario: Usuario | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UsuarioFormModal({ open, usuario, onClose, onSaved }: Props) {
  const [tab, setTab] = useState('datos');
  const [saving, setSaving] = useState(false);
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Set<string>>(new Set());
  const { message } = App.useApp();

  const { data: puntosVentaData } = useQuery({
    queryKey: ['puntos-venta'],
    queryFn: () => seriesDocumentoApi.puntosVenta(),
  });
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.listar({ limit: 100 }),
    enabled: !!usuario,
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schemaDatos),
    defaultValues: { nombre: '', apellido: '', email: '', telefono: '', id_punto_venta: undefined, password: '' },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password_nuevo: '', password_confirmar: '' },
  });

  useEffect(() => {
    if (!open) return;
    setTab('datos');
    reset(usuario ? {
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono || '',
      id_punto_venta: usuario.punto_venta?.id,
      password: '',
    } : { nombre: '', apellido: '', email: '', telefono: '', id_punto_venta: undefined, password: '' });
    setRolesSeleccionados(new Set(usuario?.roles.map((ur) => ur.id_rol) || []));
    passwordForm.reset({ password_nuevo: '', password_confirmar: '' });
  }, [open, usuario, reset, passwordForm]);

  const guardarDatos = async (values: FormValues) => {
    setSaving(true);
    try {
      const dto = { ...values, telefono: values.telefono || undefined, id_punto_venta: values.id_punto_venta || null };
      if (usuario) {
        await usuariosApi.actualizar(usuario.id, dto);
        message.success('Usuario actualizado');
      } else {
        if (!values.password) { message.warning('Ingrese una contraseña'); setSaving(false); return; }
        await usuariosApi.crear({ ...dto, password: values.password });
        message.success('Usuario creado');
      }
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const guardarRoles = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      await usuariosApi.actualizarRoles(usuario.id, [...rolesSeleccionados]);
      message.success('Roles actualizados');
      onSaved();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al actualizar los roles');
    } finally {
      setSaving(false);
    }
  };

  const guardarPassword = async (values: PasswordValues) => {
    if (!usuario) return;
    setSaving(true);
    try {
      await usuariosApi.cambiarPassword(usuario.id, values.password_nuevo);
      message.success('Contraseña actualizada');
      onClose();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const handleOk = () => {
    if (tab === 'datos') handleSubmit(guardarDatos)();
    else if (tab === 'roles') guardarRoles();
    else if (tab === 'password') passwordForm.handleSubmit(guardarPassword)();
  };

  const items = [
    {
      key: 'datos',
      label: 'Datos',
      children: (
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Nombre" validateStatus={errors.nombre ? 'error' : ''} help={errors.nombre?.message}>
                <Controller name="nombre" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Apellido" validateStatus={errors.apellido ? 'error' : ''} help={errors.apellido?.message}>
                <Controller name="apellido" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email?.message}>
                <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Teléfono">
                <Controller name="telefono" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Punto de venta" help="Define a qué caja, series de documentos y reportes de ventas tiene acceso.">
            <Controller name="id_punto_venta" control={control} render={({ field }) => (
              <Select
                {...field}
                allowClear
                placeholder="Sin asignar"
                options={(puntosVentaData?.data || []).map((pv) => ({ value: pv.id, label: pv.nombre }))}
              />
            )} />
          </Form.Item>
          {!usuario && (
            <Form.Item label="Contraseña">
              <Controller name="password" control={control} render={({ field }) => (
                <Input.Password {...field} placeholder="Mínimo 8 caracteres" />
              )} />
            </Form.Item>
          )}
        </Form>
      ),
    },
    ...(usuario ? [{
      key: 'roles',
      label: 'Roles',
      children: (
        <Row gutter={[8, 8]}>
          {(rolesData?.data || []).map((r) => (
            <Col span={12} key={r.id}>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8 }}>
                <Checkbox
                  checked={rolesSeleccionados.has(r.id)}
                  onChange={(e) => {
                    const next = new Set(rolesSeleccionados);
                    if (e.target.checked) next.add(r.id); else next.delete(r.id);
                    setRolesSeleccionados(next);
                  }}
                >
                  <Typography.Text strong>{r.nombre}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.descripcion}</Typography.Text>
                </Checkbox>
              </div>
            </Col>
          ))}
        </Row>
      ),
    }, {
      key: 'password',
      label: 'Contraseña',
      children: (
        <Form layout="vertical">
          <Form.Item label="Nueva contraseña" validateStatus={passwordForm.formState.errors.password_nuevo ? 'error' : ''} help={passwordForm.formState.errors.password_nuevo?.message}>
            <Controller name="password_nuevo" control={passwordForm.control} render={({ field }) => <Input.Password {...field} />} />
          </Form.Item>
          <Form.Item label="Confirmar contraseña" validateStatus={passwordForm.formState.errors.password_confirmar ? 'error' : ''} help={passwordForm.formState.errors.password_confirmar?.message}>
            <Controller name="password_confirmar" control={passwordForm.control} render={({ field }) => <Input.Password {...field} />} />
          </Form.Item>
        </Form>
      ),
    }] : []),
  ];

  return (
    <Modal
      title={usuario ? 'Editar Usuario' : 'Nuevo Usuario'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      okText="Guardar"
      cancelText="Cancelar"
      width={680}
      destroyOnHidden
    >
      <Tabs activeKey={tab} onChange={setTab} items={items} />
    </Modal>
  );
}
