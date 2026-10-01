import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Table, Button, Select, Typography, Space, DatePicker, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, FilterOutlined, EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { comprasApi } from '@/api/compras';
import { usePagination } from '@/hooks/usePagination';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda, penAMonedaOriginal, nombreUsuario } from '@/utils/format';
import { TIPOS_DOC_COMPRA_LABEL, type Compra, type ListarComprasParams } from '@/types/compra';
import { EstadoLetrasCompra } from './EstadoLetrasCompra';
import { CompraDetalleModal } from './CompraDetalleModal';
import { useAuth } from '@/auth/AuthContext';
import { AgregarALetrasModal } from '@/pages/letras/AgregarALetrasModal';

export function ComprasPage() {
  const { page, setPage, limit } = usePagination(20);
  const [desde, setDesde] = useState<Dayjs>(dayjs().startOf('month'));
  const [hasta, setHasta] = useState<Dayjs>(dayjs());
  const [estado, setEstado] = useState<string | undefined>(undefined);
  const [letras, setLetras] = useState<ListarComprasParams['letras']>(undefined);
  const [filtros, setFiltros] = useState({});
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const { hasPermiso } = useAuth();
  const [seleccion, setSeleccion] = useState<Compra[]>([]);
  const [pasarALetras, setPasarALetras] = useState(false);
  // Solo se pueden juntar en un paquete facturas a crédito sin paquete, del mismo proveedor y moneda.
  const seleccionable = (c: Compra) => !c.letras && c.condicion_pago === 'credito' && c.estado === 'registrada' && c.tipo_documento !== 'nota_credito';
  const mezclada = seleccion.some((c) => c.id_proveedor !== seleccion[0].id_proveedor || c.moneda !== seleccion[0].moneda);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['compras', page, filtros],
    queryFn: () => comprasApi.listar({ page, limit, ...filtros }),
  });

  const filtrar = () => {
    setPage(1);
    setFiltros({
      fecha_desde: desde.format('YYYY-MM-DD'),
      fecha_hasta: hasta.format('YYYY-MM-DD'),
      estado,
      letras,
    });
  };

  const columns: ColumnsType<Compra> = [
    { title: 'N° Documento', render: (_, c) => c.serie ? `${c.serie}-${c.numero}` : c.numero || '-' },
    { title: 'Tipo', align: 'center', render: (_, c) => <Tag>{TIPOS_DOC_COMPRA_LABEL[c.tipo_documento] || c.tipo_documento}</Tag> },
    { title: 'Fecha', dataIndex: 'fecha_emision', render: (v) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Proveedor', render: (_, c) => c.proveedor?.razon_social || '-' },
    { title: 'Almacén', render: (_, c) => c.almacen?.nombre || '-' },
    { title: 'Condición', align: 'center', render: (_, c) => c.condicion_pago === 'credito' ? <Tag color="warning">Crédito</Tag> : <Tag color="success">Contado</Tag> },
    { title: 'Letras', render: (_, c) => <EstadoLetrasCompra compra={c} /> },
    { title: 'Total', align: 'right', render: (_, c) => <strong>{formatMoneda(penAMonedaOriginal(c.total, c.moneda, c.tipo_cambio), c.moneda)}</strong> },
    { title: 'Moneda', align: 'center', render: (_, c) => <Tag>{c.moneda}</Tag> },
    { title: 'Estado', align: 'center', render: (_, c) => <EstadoTag estado={c.estado} /> },
    { title: 'Registrado por', render: (_, x) => nombreUsuario(x.usuario) },
    { title: '', align: 'center', width: 60, render: (_, c) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetalleId(c.id)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Registro de Compras</Typography.Title>
        <Link to="/compras/nueva"><Button type="primary" icon={<PlusOutlined />}>Nueva Compra</Button></Link>
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <Space wrap>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Desde</Typography.Text>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} format="DD/MM/YYYY" />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Hasta</Typography.Text>
            <DatePicker value={hasta} onChange={(v) => v && setHasta(v)} format="DD/MM/YYYY" />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Estado</Typography.Text>
            <Select allowClear placeholder="Todos" value={estado} onChange={setEstado} style={{ width: 160 }} options={[
              { value: 'borrador', label: 'Borrador' }, { value: 'registrada', label: 'Registrada' }, { value: 'anulada', label: 'Anulada' },
            ]} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Letras</Typography.Text>
            <Select allowClear placeholder="Todas" value={letras} onChange={setLetras} style={{ width: 210 }} options={[
              { value: 'sin_paquete', label: 'A crédito sin paquete' }, { value: 'en_paquete', label: 'A crédito en paquete' },
            ]} />
          </div>
          <Button type="primary" icon={<FilterOutlined />} onClick={filtrar} style={{ marginTop: 20 }}>Filtrar</Button>
        </Space>
      </div>

      {hasPermiso('letras:crear') && seleccion.length > 0 && (
        <Alert
          type={mezclada ? 'warning' : 'info'} showIcon style={{ marginBottom: 12 }}
          title={mezclada
            ? 'Para armar un paquete de letras, elija facturas del mismo proveedor y la misma moneda.'
            : `${seleccion.length} factura(s) de ${seleccion[0].proveedor?.razon_social} por ${formatMoneda(seleccion.reduce((t, c) => t + penAMonedaOriginal(c.total, c.moneda, c.tipo_cambio), 0), seleccion[0].moneda)}`}
          action={(
            <Space>
              <Button size="small" onClick={() => setSeleccion([])}>Quitar selección</Button>
              <Button size="small" type="primary" disabled={mezclada} onClick={() => setPasarALetras(true)}>Pasar a letras</Button>
            </Space>
          )}
        />
      )}

      <Table<Compra>
        rowKey="id"
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
        rowSelection={hasPermiso('letras:crear') ? {
          selectedRowKeys: seleccion.map((c) => c.id),
          onChange: (_, filas) => setSeleccion(filas),
          getCheckboxProps: (c) => ({ disabled: !seleccionable(c), title: seleccionable(c) ? 'Elegir para pasar a letras' : undefined }),
          preserveSelectedRowKeys: true,
        } : undefined}
        onRow={(c) => ({ onClick: () => setDetalleId(c.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: limit, total: data?.meta?.total, showTotal: (t) => `${t} registros`, onChange: setPage }}
        scroll={{ x: 1450 }}
      />

      {pasarALetras && seleccion.length > 0 && (
        <AgregarALetrasModal
          compras={seleccion.map((c) => ({ id: c.id, documento: c.serie ? `${c.serie}-${c.numero}` : c.numero || c.numero_interno, fecha_vencimiento: c.fecha_vencimiento?.slice(0, 10) ?? null }))}
          proveedor={{ id: seleccion[0].id_proveedor, razon_social: seleccion[0].proveedor?.razon_social ?? '', dias_credito: seleccion[0].proveedor?.dias_credito ?? 0, letras_pago_unico: !!seleccion[0].proveedor?.letras_pago_unico }}
          moneda={seleccion[0].moneda}
          onClose={() => setPasarALetras(false)}
          onListo={() => { setPasarALetras(false); setSeleccion([]); refetch(); }}
        />
      )}
      <CompraDetalleModal id={detalleId} onClose={() => setDetalleId(null)} onCambiado={refetch} />
    </div>
  );
}
