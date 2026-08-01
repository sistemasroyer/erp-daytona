import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Input, Select, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, SwapOutlined, SlidersOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { inventarioApi } from '@/api/inventario';
import { almacenesApi } from '@/api/almacenes';
import { formatMoneda } from '@/utils/format';
import { TransferenciaModal } from './TransferenciaModal';
import type { ItemInventario } from '@/types/inventario';

export function InventarioPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [almacenFiltro, setAlmacenFiltro] = useState<string | undefined>(undefined);
  const [soloAlertaCritica, setSoloAlertaCritica] = useState<string | undefined>(undefined);
  const [modalTransfer, setModalTransfer] = useState(false);

  const { data: almacenesData } = useQuery({ queryKey: ['almacenes'], queryFn: () => almacenesApi.listar() });
  const almacenes = almacenesData?.data || [];

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['inventario', search, almacenFiltro],
    queryFn: () => inventarioApi.listar({ limit: 500, search: search || undefined, id_almacen: almacenFiltro }),
  });

  let items = data?.data || [];
  if (soloAlertaCritica === 'critico') {
    items = items.filter((i) => Number(i.stock_actual) <= Number(i.producto?.stock_minimo || 0));
  }

  const columns: ColumnsType<ItemInventario> = [
    { title: 'Código', dataIndex: ['producto', 'codigo'], width: 110 },
    { title: 'Producto', dataIndex: ['producto', 'nombre'] },
    { title: 'Categoría', render: (_, i) => <Typography.Text type="secondary">{i.producto?.categoria?.nombre || '-'}</Typography.Text> },
    { title: 'Almacén', render: (_, i) => i.almacen?.nombre || '-' },
    {
      title: 'Stock', align: 'right',
      render: (_, i) => {
        const stock = Number(i.stock_actual);
        const min = Number(i.producto?.stock_minimo || 0);
        const color = stock <= 0 ? '#8c8c8c' : stock <= min ? '#faad14' : undefined;
        return <span style={{ color, fontWeight: stock > 0 && stock <= min ? 600 : undefined }}>{stock.toFixed(4)}</span>;
      },
    },
    { title: 'Mín.', align: 'right', render: (_, i) => <Typography.Text type="secondary">{Number(i.producto?.stock_minimo || 0).toFixed(2)}</Typography.Text> },
    { title: 'Máx.', align: 'right', render: (_, i) => <Typography.Text type="secondary">{Number(i.producto?.stock_maximo || 0).toFixed(2)}</Typography.Text> },
    { title: 'Unidad', align: 'center', render: (_, i) => i.producto?.unidad_medida?.simbolo || '-' },
    { title: 'Costo Prom.', align: 'right', render: (_, i) => formatMoneda(i.producto?.costo_promedio) },
    { title: 'Valor Stock', align: 'right', render: (_, i) => <strong>{formatMoneda(Number(i.stock_actual) * Number(i.producto?.costo_promedio || 0))}</strong> },
    {
      title: 'Acciones', align: 'center', width: 70,
      render: (_, i) => (
        <Link to={`/inventario/kardex?id=${i.producto.id}`}>
          <Button size="small" icon={<ClockCircleOutlined />} title="Ver Kardex" />
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Inventario</Typography.Title>
        <Space>
          <Link to="/inventario/ajustes">
            <Button icon={<SlidersOutlined />}>Ajustes de Inventario</Button>
          </Link>
          <Button icon={<SwapOutlined />} onClick={() => setModalTransfer(true)}>Transferencia</Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Buscar producto..."
          allowClear
          enterButton={<SearchOutlined />}
          style={{ width: 300 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={setSearch}
        />
        <Select
          allowClear placeholder="Todos los almacenes" style={{ width: 200 }}
          value={almacenFiltro} onChange={setAlmacenFiltro}
          options={almacenes.map((a) => ({ value: a.id, label: a.nombre }))}
        />
        <Select
          allowClear placeholder="Todos" style={{ width: 160 }}
          value={soloAlertaCritica} onChange={setSoloAlertaCritica}
          options={[{ value: 'critico', label: 'Stock crítico' }]}
        />
      </Space>

      <Table<ItemInventario>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={isFetching}
        pagination={{ showTotal: (t) => `${t} registros` }}
        scroll={{ x: 1300 }}
      />

      <TransferenciaModal
        open={modalTransfer}
        almacenes={almacenes}
        onClose={() => setModalTransfer(false)}
        onSaved={() => { setModalTransfer(false); refetch(); }}
      />
    </div>
  );
}
