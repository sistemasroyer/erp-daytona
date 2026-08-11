import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Input, Tag, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { proveedoresApi } from '@/api/proveedores';
import { ApiError } from '@/api/types';
import { usePagination } from '@/hooks/usePagination';
import { useConfirmar } from '@/components/ConfirmModal';
import { ProveedorFormModal } from './ProveedorFormModal';
import type { Proveedor } from '@/types/proveedor';

export function ProveedoresPage() {
  const { page, setPage, search, buscar, limit } = usePagination(20);
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();

  const { data, isFetching } = useQuery({
    queryKey: ['proveedores', page, search],
    queryFn: () => proveedoresApi.listar({ page, limit, search: search || undefined }),
  });

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['proveedores'] });

  const abrirNuevo = () => { setProveedorEditando(null); setModalOpen(true); };
  const abrirEditar = (p: Proveedor) => { setProveedorEditando(p); setModalOpen(true); };

  const eliminar = async (p: Proveedor) => {
    const ok = await confirmar(`¿Eliminar el proveedor "${p.razon_social}"?`, 'Eliminar Proveedor');
    if (!ok) return;
    try {
      await proveedoresApi.eliminar(p.id);
      message.success('Proveedor eliminado');
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar el proveedor');
    }
  };

  const columns: ColumnsType<Proveedor> = [
    { title: 'RUC', dataIndex: 'ruc', width: 120 },
    { title: 'Razón Social', dataIndex: 'razon_social' },
    { title: 'Contacto', dataIndex: 'contacto', render: (v) => v || '-' },
    { title: 'Teléfono', dataIndex: 'telefono', render: (v) => v || '-' },
    { title: 'Email', dataIndex: 'email', render: (v) => v || '-' },
    { title: 'Días Crédito', dataIndex: 'dias_credito', align: 'center', render: (v) => <Tag color="blue">{v || 0} días</Tag> },
    { title: 'Estado', dataIndex: 'estado', align: 'center', render: (v) => v ? <Tag color="success">Activo</Tag> : <Tag>Inactivo</Tag> },
    {
      title: 'Acciones', align: 'center', width: 110,
      render: (_, p) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(p)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(p)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Proveedores</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={abrirNuevo}>Nuevo Proveedor</Button>
      </div>

      <Input.Search
        placeholder="Buscar por RUC o razón social..."
        allowClear
        enterButton={<SearchOutlined />}
        style={{ maxWidth: 420, marginBottom: 16 }}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onSearch={buscar}
      />

      <Table<Proveedor>
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={data?.data}
        loading={isFetching}
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.meta?.total,
          showTotal: (total) => `${total} proveedores`,
          onChange: setPage,
        }}
      />

      <ProveedorFormModal
        open={modalOpen}
        proveedor={proveedorEditando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recargar(); }}
      />
    </div>
  );
}
