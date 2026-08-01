import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Button, Typography, Empty, Row, Col, Modal, Form, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { categoriasApi, subcategoriasApi } from '@/api/categorias';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import type { Categoria, Subcategoria } from '@/types/categoria';

function NombreDescripcionModal({
  open, titulo, nombreInicial, descripcionInicial, onClose, onGuardar,
}: {
  open: boolean; titulo: string; nombreInicial: string; descripcionInicial: string;
  onClose: () => void; onGuardar: (nombre: string, descripcion: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  const handleOk = async () => {
    if (!nombre.trim()) { message.warning('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await onGuardar(nombre.trim(), descripcion.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={titulo} open={open} onCancel={onClose} onOk={handleOk} confirmLoading={saving} okText="Guardar" cancelText="Cancelar" destroyOnHidden afterOpenChange={(o) => { if (o) { setNombre(nombreInicial); setDescripcion(descripcionInicial); } }}>
      <Form layout="vertical">
        <Form.Item label="Nombre" required>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Form.Item>
        <Form.Item label="Descripción">
          <Input.TextArea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function CategoriasPage() {
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [modalCat, setModalCat] = useState<{ open: boolean; cat: Categoria | null }>({ open: false, cat: null });
  const [modalSub, setModalSub] = useState<{ open: boolean; sub: Subcategoria | null }>({ open: false, sub: null });
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();

  const { data } = useQuery({ queryKey: ['categorias'], queryFn: () => categoriasApi.listar() });
  const categorias = data?.data || [];
  const seleccionada = categorias.find((c) => c.id === seleccionadaId) || null;

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['categorias'] });

  const eliminarCategoria = async (c: Categoria) => {
    const ok = await confirmar('¿Eliminar esta categoría? Se eliminarán sus subcategorías asociadas.', 'Eliminar Categoría');
    if (!ok) return;
    try {
      await categoriasApi.eliminar(c.id);
      if (seleccionadaId === c.id) setSeleccionadaId(null);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Categorías y Subcategorías</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalCat({ open: true, cat: null })}>
          Nueva Categoría
        </Button>
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card title={`Categorías (${categorias.length})`}>
            <div>
              {categorias.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSeleccionadaId(c.id)}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: c.id === seleccionadaId ? '#e6f4ff' : undefined, borderRadius: 4, borderBottom: '1px solid #f0f0f0' }}
                >
                  <Typography.Text strong>{c.nombre}</Typography.Text>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setModalCat({ open: true, cat: c }); }} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); eliminarCategoria(c); }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={14}>
          <Card
            title={<>Subcategorías de: <Typography.Text type="secondary">{seleccionada?.nombre || '—'}</Typography.Text></>}
            extra={<Button size="small" icon={<PlusOutlined />} disabled={!seleccionada} onClick={() => setModalSub({ open: true, sub: null })}>Nueva Subcategoría</Button>}
          >
            {seleccionada
              ? (
                seleccionada.subcategorias.length
                  ? (
                    <div>
                      {seleccionada.subcategorias.map((s) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                          <span>{s.nombre}</span>
                          <Button size="small" icon={<EditOutlined />} onClick={() => setModalSub({ open: true, sub: s })} />
                        </div>
                      ))}
                    </div>
                  )
                  : <Empty description="Sin subcategorías" />
              )
              : <Empty description="Selecciona una categoría para ver sus subcategorías" />}
          </Card>
        </Col>
      </Row>

      <NombreDescripcionModal
        open={modalCat.open}
        titulo={modalCat.cat ? 'Editar Categoría' : 'Nueva Categoría'}
        nombreInicial={modalCat.cat?.nombre || ''}
        descripcionInicial={modalCat.cat?.descripcion || ''}
        onClose={() => setModalCat({ open: false, cat: null })}
        onGuardar={async (nombre, descripcion) => {
          try {
            const dto = { nombre, descripcion: descripcion || undefined };
            if (modalCat.cat) await categoriasApi.actualizar(modalCat.cat.id, dto);
            else await categoriasApi.crear(dto);
            message.success(modalCat.cat ? 'Categoría actualizada' : 'Categoría creada');
            setModalCat({ open: false, cat: null });
            recargar();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : 'Error al guardar');
          }
        }}
      />

      <NombreDescripcionModal
        open={modalSub.open}
        titulo={modalSub.sub ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
        nombreInicial={modalSub.sub?.nombre || ''}
        descripcionInicial={modalSub.sub?.descripcion || ''}
        onClose={() => setModalSub({ open: false, sub: null })}
        onGuardar={async (nombre, descripcion) => {
          if (!seleccionadaId) return;
          try {
            const dto = { id_categoria: seleccionadaId, nombre, descripcion: descripcion || undefined };
            if (modalSub.sub) await subcategoriasApi.actualizar(modalSub.sub.id, dto);
            else await subcategoriasApi.crear(dto);
            message.success(modalSub.sub ? 'Subcategoría actualizada' : 'Subcategoría creada');
            setModalSub({ open: false, sub: null });
            recargar();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : 'Error al guardar');
          }
        }}
      />
    </div>
  );
}
