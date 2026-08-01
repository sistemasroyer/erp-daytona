import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Typography, Input, Modal, Form, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { unidadesMedidaApi } from '@/api/unidades-medida';
import { ApiError } from '@/api/types';
import type { UnidadMedida } from '@/types/unidad-medida';

export function UnidadesMedidaPage() {
  const [modal, setModal] = useState<{ open: boolean; unidad: UnidadMedida | null }>({ open: false, unidad: null });
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [simbolo, setSimbolo] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data, isFetching } = useQuery({ queryKey: ['unidades-medida'], queryFn: () => unidadesMedidaApi.listar() });

  const abrir = (u: UnidadMedida | null) => {
    setModal({ open: true, unidad: u });
    setCodigo(u?.codigo_sunat || '');
    setDescripcion(u?.descripcion || '');
    setSimbolo(u?.simbolo || '');
  };

  const guardar = async () => {
    if (!codigo.trim() || !descripcion.trim() || !simbolo.trim()) { message.warning('Todos los campos son requeridos'); return; }
    setSaving(true);
    try {
      const dto = { codigo_sunat: codigo.trim().toUpperCase(), descripcion: descripcion.trim(), simbolo: simbolo.trim() };
      if (modal.unidad) await unidadesMedidaApi.actualizar(modal.unidad.id, dto);
      else await unidadesMedidaApi.crear(dto);
      message.success(modal.unidad ? 'Unidad actualizada' : 'Unidad creada');
      setModal({ open: false, unidad: null });
      queryClient.invalidateQueries({ queryKey: ['unidades-medida'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<UnidadMedida> = [
    { title: 'Código SUNAT', dataIndex: 'codigo_sunat', render: (v) => <code>{v}</code> },
    { title: 'Descripción', dataIndex: 'descripcion' },
    { title: 'Símbolo', dataIndex: 'simbolo', render: (v) => <Tag>{v}</Tag> },
    { title: '', align: 'right', width: 60, render: (_, u) => <Button size="small" icon={<EditOutlined />} onClick={() => abrir(u)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Unidades de Medida</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Nueva Unidad</Button>
      </div>

      <Table<UnidadMedida> rowKey="id" columns={columns} dataSource={data?.data} loading={isFetching} pagination={false} style={{ maxWidth: 700 }} />

      <Modal
        title={modal.unidad ? 'Editar Unidad de Medida' : 'Nueva Unidad de Medida'}
        open={modal.open}
        onCancel={() => setModal({ open: false, unidad: null })}
        onOk={guardar}
        confirmLoading={saving}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form layout="vertical">
          <Form.Item label="Código SUNAT" required help="Usar códigos del catálogo SUNAT (tabla 6)">
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: NIU, KGM, MTR..." autoFocus />
          </Form.Item>
          <Form.Item label="Descripción" required>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Unidad, Kilogramo, Metro..." />
          </Form.Item>
          <Form.Item label="Símbolo" required>
            <Input value={simbolo} onChange={(e) => setSimbolo(e.target.value)} placeholder="Ej: und, kg, m..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
