import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Row, Col, Button, Typography, Input, Modal, Form, Checkbox, Tag, Empty } from 'antd';
import { PlusOutlined, EditOutlined, BankOutlined } from '@ant-design/icons';
import { almacenesApi } from '@/api/almacenes';
import { empresaApi } from '@/api/empresa';
import { ApiError } from '@/api/types';
import type { Almacen } from '@/types/almacen';

export function AlmacenesPage() {
  const [modal, setModal] = useState<{ open: boolean; almacen: Almacen | null }>({ open: false, almacen: null });
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data } = useQuery({ queryKey: ['almacenes'], queryFn: () => almacenesApi.listar() });
  // El backend exige id_empresa al crear un almacén; como es una sola empresa, lo resolvemos
  // automáticamente en vez de pedírselo al usuario (la app vieja no lo enviaba y por eso
  // el alta de almacenes le fallaba siempre con un 400).
  const { data: empresaData } = useQuery({ queryKey: ['empresa'], queryFn: () => empresaApi.obtener() });

  const abrir = (a: Almacen | null) => {
    setModal({ open: true, almacen: a });
    setNombre(a?.nombre || '');
    setDescripcion(a?.descripcion || '');
    setEsPrincipal(a?.es_principal || false);
  };

  const guardar = async () => {
    if (!nombre.trim()) { message.warning('El nombre es requerido'); return; }
    setSaving(true);
    try {
      if (modal.almacen) {
        await almacenesApi.actualizar(modal.almacen.id, {
          nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, es_principal: esPrincipal,
        });
      } else {
        const idEmpresa = modal.almacen ? undefined : empresaData?.data.id;
        if (!idEmpresa) { message.error('No se pudo determinar la empresa'); setSaving(false); return; }
        await almacenesApi.crear({
          id_empresa: idEmpresa, nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, es_principal: esPrincipal,
        });
      }
      message.success(modal.almacen ? 'Almacén actualizado' : 'Almacén creado');
      setModal({ open: false, almacen: null });
      queryClient.invalidateQueries({ queryKey: ['almacenes'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const almacenes = data?.data || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Almacenes</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Nuevo Almacén</Button>
      </div>

      {almacenes.length === 0 ? (
        <Empty description="Sin almacenes registrados" />
      ) : (
        <Row gutter={[16, 16]}>
          {almacenes.map((a) => (
            <Col span={6} key={a.id}>
              <Card
                title={<><BankOutlined style={{ marginRight: 8 }} />{a.nombre}</>}
                extra={a.es_principal && <Tag color="success">Principal</Tag>}
                actions={[<Button key="edit" type="text" icon={<EditOutlined />} onClick={() => abrir(a)}>Editar</Button>]}
              >
                {a.descripcion && <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>{a.descripcion}</Typography.Paragraph>}
                <Tag color={a.estado ? 'success' : 'error'}>{a.estado ? 'Activo' : 'Inactivo'}</Tag>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={modal.almacen ? 'Editar Almacén' : 'Nuevo Almacén'}
        open={modal.open}
        onCancel={() => setModal({ open: false, almacen: null })}
        onOk={guardar}
        confirmLoading={saving}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form layout="vertical">
          <Form.Item label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Almacén Principal, Depósito Sur..." autoFocus />
          </Form.Item>
          <Form.Item label="Descripción">
            <Input.TextArea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Ubicación, responsable, etc." />
          </Form.Item>
          <Form.Item>
            <Checkbox checked={esPrincipal} onChange={(e) => setEsPrincipal(e.target.checked)}>Es el almacén principal</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
