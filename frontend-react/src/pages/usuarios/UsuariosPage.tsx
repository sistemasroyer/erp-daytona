import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Tag, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { usuariosApi } from '@/api/usuarios';
import { usePagination } from '@/hooks/usePagination';
import { UsuarioFormModal } from './UsuarioFormModal';
import type { Usuario } from '@/types/usuario';
import dayjs from 'dayjs';

export function UsuariosPage() {
  const { page, setPage, limit } = usePagination(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['usuarios', page],
    queryFn: () => usuariosApi.listar({ page, limit }),
  });

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] });

  const columns: ColumnsType<Usuario> = [
    { title: 'Nombre', render: (_, u) => `${u.nombre} ${u.apellido}` },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Punto de venta', render: (_, u) => u.punto_venta?.nombre || <Typography.Text type="secondary">Sin asignar</Typography.Text> },
    {
      title: 'Roles',
      render: (_, u) => u.roles.length
        ? u.roles.map((ur) => <Tag key={ur.id} color="blue">{ur.rol.nombre}</Tag>)
        : '-',
    },
    { title: 'Último acceso', dataIndex: 'ultimo_acceso', render: (v) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : 'Nunca' },
    { title: 'Estado', dataIndex: 'estado', align: 'center', render: (v) => v ? <Tag color="success">Activo</Tag> : <Tag>Inactivo</Tag> },
    {
      title: 'Acciones', align: 'center', width: 90,
      render: (_, u) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditando(u); setModalOpen(true); }} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Usuarios</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditando(null); setModalOpen(true); }}>
          Nuevo Usuario
        </Button>
      </div>

      <Table<Usuario>
        rowKey="id"
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} usuarios`, onChange: setPage }}
      />

      <UsuarioFormModal
        open={modalOpen}
        usuario={editando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recargar(); }}
      />
    </div>
  );
}
