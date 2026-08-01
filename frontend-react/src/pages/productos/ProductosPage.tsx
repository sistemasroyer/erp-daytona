import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Table, Button, Input, Select, Tag, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { productosApi } from '@/api/productos';
import { categoriasApi } from '@/api/categorias';
import { ApiError } from '@/api/types';
import { usePagination } from '@/hooks/usePagination';
import { formatMoneda } from '@/utils/format';
import { useConfirmar } from '@/components/ConfirmModal';
import { ProductoFormModal } from './ProductoFormModal';
import type { Producto } from '@/types/producto';

export function ProductosPage() {
  const { page, setPage, search, buscar, limit } = usePagination(25);
  const [searchInput, setSearchInput] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();

  const { data: categoriasData } = useQuery({ queryKey: ['categorias'], queryFn: () => categoriasApi.listar() });
  const { data, isFetching } = useQuery({
    queryKey: ['productos', page, search, categoriaFiltro],
    queryFn: () => productosApi.listar({ page, limit, search: search || undefined, id_categoria: categoriaFiltro }),
  });

  const recargar = () => queryClient.invalidateQueries({ queryKey: ['productos'] });

  const eliminar = async (p: Producto) => {
    const ok = await confirmar(`¿Eliminar el producto "${p.nombre}"?`, 'Eliminar Producto');
    if (!ok) return;
    try {
      await productosApi.eliminar(p.id);
      message.success('Producto eliminado');
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar el producto');
    }
  };

  const columns: ColumnsType<Producto> = [
    {
      title: 'Código', dataIndex: 'codigo', width: 130,
      render: (v, p) => <>{v}{p.codigo_barras && <><br /><Typography.Text type="secondary" style={{ fontSize: 11 }}>{p.codigo_barras}</Typography.Text></>}</>,
    },
    {
      title: 'Nombre',
      render: (_, p) => (
        <>
          {p.nombre}
          {p.codigos_proveedor?.length > 0 && (
            <><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {p.codigos_proveedor.map((c) => `${c.codigo_alterno} (${c.proveedor?.razon_social || '—'})`).join(', ')}
            </Typography.Text></>
          )}
        </>
      ),
    },
    {
      title: 'Categoría / Marca',
      render: (_, p) => (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {p.categoria?.nombre || '—'}{p.subcategoria ? ` / ${p.subcategoria.nombre}` : ''}
          {p.marca && <><br />{p.marca.nombre}</>}
        </Typography.Text>
      ),
    },
    { title: 'Unidad', align: 'center', render: (_, p) => p.unidad_medida?.simbolo || '—' },
    {
      title: 'Stock', align: 'right',
      render: (_, p) => {
        const stock = Number(p.stock_actual || 0);
        const min = Number(p.stock_minimo || 0);
        const color = stock > 0 && stock <= min ? '#faad14' : stock <= 0 ? '#8c8c8c' : undefined;
        return <span style={{ color, fontWeight: stock > 0 && stock <= min ? 600 : undefined }}>{stock.toFixed(2)}</span>;
      },
    },
    { title: 'Costo Prom.', align: 'right', render: (_, p) => Number(p.costo_promedio) > 0 ? formatMoneda(p.costo_promedio) : <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Precio Venta', align: 'right',
      render: (_, p) => {
        const otros = [p.precio_venta_2, p.precio_venta_3, p.precio_venta_4, p.precio_venta_5].filter((v) => Number(v) > 0);
        return (
          <>
            {Number(p.precio_venta_1) > 0 ? <strong>{formatMoneda(p.precio_venta_1)}</strong> : <Typography.Text type="secondary">—</Typography.Text>}
            {otros.length > 0 && <><br /><Typography.Text type="secondary" style={{ fontSize: 11 }}>otros: {otros.map((v) => formatMoneda(v)).join(' / ')}</Typography.Text></>}
          </>
        );
      },
    },
    { title: 'IGV', align: 'center', render: (_, p) => p.afecta_igv ? <Tag color="gold">IGV</Tag> : <Tag>Exon.</Tag> },
    { title: 'Estado', align: 'center', render: (_, p) => p.estado ? <Tag color="success">Activo</Tag> : <Tag>Inactivo</Tag> },
    {
      title: 'Acciones', align: 'center', width: 100,
      render: (_, p) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditando(p); setModalOpen(true); }} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(p)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Catálogo de Repuestos</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditando(null); setModalOpen(true); }}>Nuevo Producto</Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Buscar por código, nombre o código de barras..."
          allowClear
          enterButton={<SearchOutlined />}
          style={{ width: 360 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={buscar}
        />
        <Select
          allowClear placeholder="Todas las categorías" style={{ width: 200 }}
          value={categoriaFiltro} onChange={(v) => { setCategoriaFiltro(v); setPage(1); }}
          options={(categoriasData?.data || []).map((c) => ({ value: c.id, label: c.nombre }))}
        />
      </Space>

      <Table<Producto>
        rowKey="id"
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
        pagination={{
          current: page, pageSize: limit, total: data?.meta?.total,
          showTotal: (total) => `${total} producto${total !== 1 ? 's' : ''}`,
          onChange: setPage,
        }}
        scroll={{ x: 1200 }}
      />

      <ProductoFormModal
        open={modalOpen}
        producto={editando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recargar(); }}
      />
    </div>
  );
}
