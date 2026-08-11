import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Input, Tag, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SearchOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { rrhhApi } from '@/api/rrhh';
import { usePagination } from '@/hooks/usePagination';
import { formatMoneda } from '@/utils/format';
import { PersonalFormModal } from './PersonalFormModal';
import { CesarModal } from './CesarModal';
import { TIPOS_CONTRATO, type Personal } from '@/types/personal';
import dayjs from 'dayjs';

export function RrhhPage() {
  const { page, setPage, search, buscar, limit } = usePagination(20);
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Personal | null>(null);
  const [cesando, setCesando] = useState<Personal | null>(null);
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['rrhh', page, search],
    queryFn: () => rrhhApi.listar({ page, limit, search: search || undefined }),
  });

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['rrhh'] });

  const columns: ColumnsType<Personal> = [
    { title: 'DNI', dataIndex: 'dni', width: 100 },
    { title: 'Apellidos y Nombres', render: (_, p) => `${p.apellidos}, ${p.nombres}` },
    { title: 'Cargo', dataIndex: 'cargo', render: (v) => v || '-' },
    { title: 'Área', dataIndex: 'area', render: (v) => v || '-' },
    {
      title: 'Tipo contrato', dataIndex: 'tipo_contrato',
      render: (v) => <Tag>{TIPOS_CONTRATO.find((t) => t.value === v)?.label || v}</Tag>,
    },
    { title: 'Sueldo', dataIndex: 'sueldo', align: 'right', render: (v) => formatMoneda(v) },
    { title: 'Ingreso', dataIndex: 'fecha_ingreso', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Estado', align: 'center',
      render: (_, p) => p.fecha_cese
        ? <Tag>Cesado</Tag>
        : <Tag color="success">Activo</Tag>,
    },
    {
      title: 'Acciones', align: 'center', width: 110,
      render: (_, p) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditando(p); setModalOpen(true); }} />
          {!p.fecha_cese && (
            <Button size="small" icon={<CalendarOutlined />} onClick={() => setCesando(p)} title="Cesar" />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Personal</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditando(null); setModalOpen(true); }}>
          Nuevo Personal
        </Button>
      </div>

      <Input.Search
        placeholder="Buscar por DNI, nombres o área..."
        allowClear
        enterButton={<SearchOutlined />}
        style={{ maxWidth: 420, marginBottom: 16 }}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onSearch={buscar}
      />

      <Table<Personal>
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={data?.data}
        loading={isFetching}
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.meta?.total,
          showTotal: (total) => `${total} registros`,
          onChange: setPage,
        }}
      />

      <PersonalFormModal
        open={modalOpen}
        personal={editando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recargar(); }}
      />

      <CesarModal
        personal={cesando}
        onClose={() => setCesando(null)}
        onSaved={() => { setCesando(null); recargar(); }}
      />
    </div>
  );
}
