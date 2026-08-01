import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Button, Typography, Input, Modal, Form, Empty } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { marcasApi } from '@/api/marcas';
import { ApiError } from '@/api/types';
import type { Marca } from '@/types/marca';

export function MarcasPage() {
  const [modal, setModal] = useState<{ open: boolean; marca: Marca | null }>({ open: false, marca: null });
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data } = useQuery({ queryKey: ['marcas'], queryFn: () => marcasApi.listar() });
  const marcas = (data?.data || []).filter((m) => m.nombre.toLowerCase().includes(search.toLowerCase()));

  const abrir = (m: Marca | null) => {
    setModal({ open: true, marca: m });
    setNombre(m?.nombre || '');
    setDescripcion(m?.descripcion || '');
  };

  const guardar = async () => {
    if (!nombre.trim()) { message.warning('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const dto = { nombre: nombre.trim(), descripcion: descripcion.trim() || undefined };
      if (modal.marca) await marcasApi.actualizar(modal.marca.id, dto);
      else await marcasApi.crear(dto);
      message.success(modal.marca ? 'Marca actualizada' : 'Marca creada');
      setModal({ open: false, marca: null });
      queryClient.invalidateQueries({ queryKey: ['marcas'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Marcas</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>Nueva Marca</Button>
      </div>

      <Card style={{ maxWidth: 600 }} title={`Listado de Marcas (${marcas.length})`}>
        <Input.Search placeholder="Buscar marca..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
        {marcas.length ? (
          <div>
            {marcas.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div>{m.nombre}</div>
                  {m.descripcion && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{m.descripcion}</Typography.Text>}
                </div>
                <Button size="small" icon={<EditOutlined />} onClick={() => abrir(m)} />
              </div>
            ))}
          </div>
        ) : <Empty description="Sin marcas registradas" />}
      </Card>

      <Modal
        title={modal.marca ? 'Editar Marca' : 'Nueva Marca'}
        open={modal.open}
        onCancel={() => setModal({ open: false, marca: null })}
        onOk={guardar}
        confirmLoading={saving}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form layout="vertical">
          <Form.Item label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Toyota, Bosch, NGK..." autoFocus />
          </Form.Item>
          <Form.Item label="Descripción">
            <Input.TextArea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
