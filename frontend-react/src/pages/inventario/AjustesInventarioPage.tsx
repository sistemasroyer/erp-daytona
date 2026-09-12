import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Typography, Select, Tag, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { inventarioApi } from '@/api/inventario';
import { almacenesApi } from '@/api/almacenes';
import { usePagination } from '@/hooks/usePagination';
import { MOTIVO_AJUSTE_LABEL, type AjusteInventario } from '@/types/ajuste-inventario';
import { AjusteDetalleModal } from './AjusteDetalleModal';

export function AjustesInventarioPage() {
  const { page, setPage, limit } = usePagination(20);
  const [almacenFiltro, setAlmacenFiltro] = useState<string | undefined>(undefined);
  const [motivoFiltro, setMotivoFiltro] = useState<string | undefined>(undefined);
  const [filtrosAplicados, setFiltrosAplicados] = useState<{ id_almacen?: string; motivo?: string }>({});
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data: almacenesData } = useQuery({ queryKey: ['almacenes'], queryFn: () => almacenesApi.listar() });
  const { data, isFetching } = useQuery({
    queryKey: ['ajustes-inventario', page, filtrosAplicados],
    queryFn: () => inventarioApi.listarAjustes({ page, limit, ...filtrosAplicados }),
  });

  const columns: ColumnsType<AjusteInventario> = [
    { title: 'N° Ajuste', dataIndex: 'numero_interno' },
    { title: 'Fecha', dataIndex: 'fecha_ajuste', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Almacén', render: (_, a) => a.almacen?.nombre || '-' },
    { title: 'Motivo', align: 'center', render: (_, a) => <Tag color="gold">{MOTIVO_AJUSTE_LABEL[a.motivo] || a.motivo}</Tag> },
    { title: 'Ítems', align: 'center', render: (_, a) => a.detalle?.length ?? 0 },
    { title: '', align: 'center', width: 60, render: (_, a) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalleId(a.id)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Ajustes de Inventario</Typography.Title>
        <Link to="/inventario/ajustes/nuevo">
          <Button type="primary" icon={<PlusOutlined />}>Nuevo Ajuste</Button>
        </Link>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear placeholder="Todos los almacenes" style={{ width: 200 }}
          value={almacenFiltro} onChange={setAlmacenFiltro}
          options={(almacenesData?.data || []).map((a) => ({ value: a.id, label: a.nombre }))}
        />
        <Select
          allowClear placeholder="Todos los motivos" style={{ width: 220 }}
          value={motivoFiltro} onChange={setMotivoFiltro}
          options={Object.entries(MOTIVO_AJUSTE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Button icon={<FilterOutlined />} onClick={() => { setPage(1); setFiltrosAplicados({ id_almacen: almacenFiltro, motivo: motivoFiltro }); }}>
          Filtrar
        </Button>
      </Space>

      <Table<AjusteInventario>
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={data?.data}
        loading={isFetching}
        onRow={(a) => ({ onClick: () => setDetalleId(a.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} registros`, onChange: setPage }}
      />

      <AjusteDetalleModal id={detalleId} onClose={() => setDetalleId(null)} />
    </div>
  );
}
