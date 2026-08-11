import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { App, Table, Button, Typography, Select, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tomaInventarioApi } from '@/api/toma-inventario';
import { usePagination } from '@/hooks/usePagination';
import { EstadoTag } from '@/components/EstadoTag';
import { ApiError } from '@/api/types';
import type { TomaInventario } from '@/types/toma-inventario';

export function TomasInventarioPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { page, setPage, limit } = usePagination(20);
  const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>(undefined);
  const [filtros, setFiltros] = useState<{ estado?: string }>({});
  const [creando, setCreando] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['tomas-inventario', page, filtros],
    queryFn: () => tomaInventarioApi.listar({ page, limit, ...filtros }),
  });

  const crearToma = async () => {
    setCreando(true);
    try {
      const { data: toma } = await tomaInventarioApi.crear();
      navigate(`/inventario/tomas/${toma.id}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al crear la toma de inventario');
    } finally {
      setCreando(false);
    }
  };

  const columns: ColumnsType<TomaInventario> = [
    { title: 'N° Toma', dataIndex: 'numero_interno' },
    { title: 'Inicio', render: (_, t) => dayjs(t.fecha_inicio).format('DD/MM/YYYY HH:mm') },
    { title: 'Finalización', render: (_, t) => t.fecha_finalizacion ? dayjs(t.fecha_finalizacion).format('DD/MM/YYYY HH:mm') : '-' },
    { title: 'Responsable', render: (_, t) => t.usuario ? `${t.usuario.nombre} ${t.usuario.apellido}` : '-' },
    { title: 'Productos contados', align: 'center', render: (_, t) => t.detalle?.length ?? 0 },
    { title: 'Estado', align: 'center', render: (_, t) => <EstadoTag estado={t.estado} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Toma de Inventario</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} loading={creando} onClick={crearToma}>Nueva Toma de Inventario</Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear placeholder="Todos los estados" style={{ width: 200 }}
          value={estadoFiltro} onChange={setEstadoFiltro}
          options={[
            { value: 'en_proceso', label: 'En proceso' },
            { value: 'finalizada', label: 'Finalizada' },
            { value: 'anulada', label: 'Anulada' },
          ]}
        />
        <Button icon={<FilterOutlined />} onClick={() => { setPage(1); setFiltros({ estado: estadoFiltro }); }}>Filtrar</Button>
      </Space>

      <div style={{ overflowX: 'auto' }}>
        <Table<TomaInventario>
          rowKey="id"
          columns={columns}
          dataSource={data?.data}
          loading={isFetching}
          scroll={{ x: 'max-content' }}
          onRow={(t) => ({ onClick: () => navigate(`/inventario/tomas/${t.id}`), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (n) => `${n} registros`, onChange: setPage }}
        />
      </div>
    </div>
  );
}
