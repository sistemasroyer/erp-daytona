import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Input, Tag, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { clientesApi } from '@/api/clientes';
import { ApiError } from '@/api/types';
import { usePagination } from '@/hooks/usePagination';
import { formatMoneda } from '@/utils/format';
import { useConfirmar } from '@/components/ConfirmModal';
import { ClienteFormModal } from './ClienteFormModal';
import type { Cliente } from '@/types/cliente';

export function ClientesPage() {
  const { page, setPage, search, buscar, limit } = usePagination(20);
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();

  const { data, isFetching } = useQuery({
    queryKey: ['clientes', page, search],
    queryFn: () => clientesApi.listar({ page, limit, search: search || undefined }),
  });

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['clientes'] });

  const abrirNuevo = () => { setClienteEditando(null); setModalOpen(true); };
  const abrirEditar = (c: Cliente) => { setClienteEditando(c); setModalOpen(true); };

  const eliminar = async (c: Cliente) => {
    const ok = await confirmar(`¿Eliminar el cliente "${c.razon_social}"?`, 'Eliminar Cliente');
    if (!ok) return;
    try {
      await clientesApi.eliminar(c.id);
      message.success('Cliente eliminado');
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar el cliente');
    }
  };

  const columns: ColumnsType<Cliente> = [
    { title: 'Tipo', dataIndex: 'tipo_documento', render: (v) => <Tag>{v}</Tag>, width: 100 },
    { title: 'Documento', dataIndex: 'numero_documento', width: 130 },
    { title: 'Razón Social / Nombre', dataIndex: 'razon_social' },
    { title: 'Teléfono', dataIndex: 'telefono', render: (v) => v || '-' },
    { title: 'Email', dataIndex: 'email', render: (v) => v || '-' },
    { title: 'Límite crédito', dataIndex: 'limite_credito', align: 'right', render: (v) => formatMoneda(v) },
    { title: 'Estado', dataIndex: 'estado', align: 'center', render: (v) => v ? <Tag color="success">Activo</Tag> : <Tag>Inactivo</Tag> },
    {
      title: 'Acciones', align: 'center', width: 110,
      render: (_, c) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(c)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(c)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Clientes</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={abrirNuevo}>Nuevo Cliente</Button>
      </div>

      <Input.Search
        placeholder="Buscar por nombre, RUC o DNI..."
        allowClear
        enterButton={<SearchOutlined />}
        style={{ maxWidth: 420, marginBottom: 16 }}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onSearch={buscar}
      />

      <Table<Cliente>
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={data?.data}
        loading={isFetching}
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.meta?.total,
          showTotal: (total) => `${total} clientes`,
          onChange: setPage,
        }}
      />

      <ClienteFormModal
        open={modalOpen}
        cliente={clienteEditando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recargar(); }}
      />
    </div>
  );
}
