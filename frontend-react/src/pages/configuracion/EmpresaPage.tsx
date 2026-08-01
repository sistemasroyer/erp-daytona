import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Card, Row, Col, Form, Input, Button, Typography, Upload, Empty } from 'antd';
import { UploadOutlined, DeleteOutlined, SaveOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { empresaApi } from '@/api/empresa';
import { ApiError } from '@/api/types';
import type { UpdateEmpresaDto } from '@/types/empresa';

export function EmpresaPage() {
  const { message } = App.useApp();
  const { data, refetch } = useQuery({ queryKey: ['empresa'], queryFn: () => empresaApi.obtener() });
  const [form] = Form.useForm<UpdateEmpresaDto>();
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const e = data.data;
    form.setFieldsValue({
      razon_social: e.razon_social,
      nombre_comercial: e.nombre_comercial || '',
      direccion: e.direccion || '',
      ubigeo: e.ubigeo || '',
      departamento: e.departamento || '',
      provincia: e.provincia || '',
      distrito: e.distrito || '',
      telefono: e.telefono || '',
      email: e.email || '',
      web: e.web || '',
      regimen_tributario: e.regimen_tributario || '',
    });
    setLogo(e.logo_base64 || null);
  }, [data, form]);

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (file.size > 1024 * 1024) {
      message.warning('El logo no debe superar 1 MB');
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
    return false;
  };

  const guardar = async (values: UpdateEmpresaDto) => {
    setSaving(true);
    try {
      await empresaApi.actualizar({
        ...values,
        nombre_comercial: values.nombre_comercial || undefined,
        direccion: values.direccion || undefined,
        ubigeo: values.ubigeo || undefined,
        departamento: values.departamento || undefined,
        provincia: values.provincia || undefined,
        distrito: values.distrito || undefined,
        telefono: values.telefono || undefined,
        email: values.email || undefined,
        web: values.web || undefined,
        regimen_tributario: values.regimen_tributario || undefined,
        logo_base64: logo !== null ? logo : undefined,
      });
      message.success('Datos de la empresa actualizados correctamente');
      refetch();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>Datos de la Empresa</Typography.Title>

      <Form form={form} layout="vertical" onFinish={guardar} style={{ maxWidth: 800 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8, textAlign: 'center' }}>
                Logo (para tickets y comprobantes)
              </Typography.Text>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                {logo
                  ? <img src={logo} alt="Logo" style={{ maxHeight: 140, maxWidth: '100%' }} />
                  : <Empty image={<PictureOutlined style={{ fontSize: 48 }} />} description="Sin logo" />}
              </div>
              <Upload beforeUpload={beforeUpload} showUploadList={false} accept="image/png,image/jpeg,image/svg+xml">
                <Button icon={<UploadOutlined />} block>Subir logo</Button>
              </Upload>
              {logo && (
                <Button danger type="text" icon={<DeleteOutlined />} block style={{ marginTop: 8 }} onClick={() => setLogo('')}>
                  Quitar logo
                </Button>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                PNG o JPG, recomendado fondo transparente o blanco.
              </Typography.Text>
            </Card>
          </Col>

          <Col span={16}>
            <Card>
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item label="RUC">
                    <Input value={data?.data.ruc} disabled />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item label="Régimen tributario" name="regimen_tributario">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Razón social" name="razon_social" rules={[{ required: true, message: 'Ingrese la razón social' }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Nombre comercial" name="nombre_comercial">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Dirección" name="direccion">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Ubigeo" name="ubigeo">
                    <Input maxLength={6} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Departamento" name="departamento">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Provincia" name="provincia">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Distrito" name="distrito">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Teléfono" name="telefono">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Email inválido' }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Sitio web" name="web">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                Guardar Cambios
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
