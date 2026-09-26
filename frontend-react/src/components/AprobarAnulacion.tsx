import { createRef } from 'react';
import { App, Form, Input, Select, Typography } from 'antd';
import type { FormInstance } from 'antd';
import { aprobacionesApi } from '@/api/aprobaciones';
import type { AnulacionAprobada, RecursoAnulacion } from '@/api/aprobaciones';
import { ApiError } from '@/api/types';

export function useAprobarAnulacion() {
  const { modal, message } = App.useApp();
  const solicitar = async (recurso: RecursoAnulacion, id: string, documento: string): Promise<AnulacionAprobada | null> => {
    let supervisores: { id: string; nombre: string }[];
    try { supervisores = (await aprobacionesApi.supervisores(recurso, id)).data; }
    catch (error) { message.error(error instanceof ApiError ? error.message : 'No se pudieron cargar los supervisores'); return null; }
    if (!supervisores.length) {
      modal.info({ title: 'Falta configurar un supervisor', content: 'Un usuario con permiso Seguridad → Aprobar y permiso de anulación debe activar su PIN en Administración → Aprobaciones.' });
      return null;
    }
    return new Promise((resolve) => {
      const form = createRef<FormInstance>();
      modal.confirm({
        title: 'Autorizar anulación', icon: null, okText: 'Autorizar y anular', okType: 'danger', cancelText: 'Cancelar',
        closable: false, maskClosable: false, keyboard: false,
        content: <>
          <Typography.Paragraph strong>{documento}</Typography.Paragraph>
          <Form ref={form} layout="vertical" preserve={false} autoComplete="off">
            <Form.Item name="motivo" label="Motivo" rules={[{ required: true, whitespace: true, min: 3, max: 500, message: 'Ingrese el motivo (3 a 500 caracteres)' }]}>
              <Input.TextArea autoFocus rows={2} maxLength={500} />
            </Form.Item>
            <Form.Item name="id_aprobador" label="Supervisor" rules={[{ required: true, message: 'Seleccione un supervisor' }]}>
              <Select options={supervisores.map((s) => ({ value: s.id, label: s.nombre }))} />
            </Form.Item>
            <Form.Item name="pin" label="PIN del supervisor" rules={[{ required: true, pattern: /^\d{6,8}$/, message: 'Ingrese el PIN de 6 a 8 dígitos' }]}>
              <Input.Password inputMode="numeric" maxLength={8} autoComplete="new-password" />
            </Form.Item>
          </Form>
        </>,
        onOk: async () => {
          const values = await form.current!.validateFields();
          try {
            const motivo = values.motivo.trim();
            const { data } = await aprobacionesApi.aprobar({ ...values, motivo, recurso, id_documento: id });
            form.current?.resetFields();
            resolve({ motivo, autorizacion: data.autorizacion });
          } catch (error) {
            form.current?.setFieldValue('pin', '');
            message.error(error instanceof ApiError ? error.message : 'No se pudo autorizar');
            throw error;
          }
        },
        onCancel: () => { form.current?.resetFields(); resolve(null); },
      });
    });
  };
  return { solicitar };
}
