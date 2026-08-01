import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Alert, Row, Col, Input, InputNumber, Switch, Button, Typography, Tag, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { configMargenesApi } from '@/api/config-margenes';
import { ApiError } from '@/api/types';
import { formatMoneda } from '@/utils/format';
import type { ConfigMargen } from '@/types/config-margen';

interface FilaEstado {
  nombre: string;
  margen: number;
  descripcion: string;
  activo: boolean;
  saving: boolean;
}

export function MargenesPage() {
  const { message } = App.useApp();
  const { data } = useQuery({ queryKey: ['config-margenes'], queryFn: () => configMargenesApi.listar() });
  const margenes = data?.data || [];
  const [filas, setFilas] = useState<Record<number, FilaEstado>>({});
  const [costoEjemplo, setCostoEjemplo] = useState(100);
  const queryClient = useQueryClient();

  useEffect(() => {
    const iniciales: Record<number, FilaEstado> = {};
    margenes.forEach((m) => {
      iniciales[m.numero] = { nombre: m.nombre, margen: Number(m.margen), descripcion: m.descripcion || '', activo: m.activo, saving: false };
    });
    setFilas(iniciales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const actualizarFila = (numero: number, cambios: Partial<FilaEstado>) => {
    setFilas((prev) => ({ ...prev, [numero]: { ...prev[numero], ...cambios } }));
  };

  const guardar = async (m: ConfigMargen) => {
    const fila = filas[m.numero];
    if (!fila.nombre.trim() || isNaN(fila.margen)) { message.warning('Nombre y margen son requeridos'); return; }
    actualizarFila(m.numero, { saving: true });
    try {
      await configMargenesApi.actualizar(m.numero, {
        nombre: fila.nombre.trim(), margen: fila.margen, descripcion: fila.descripcion.trim(), activo: fila.activo,
      });
      message.success(`Precio ${m.numero} actualizado`);
      queryClient.invalidateQueries({ queryKey: ['config-margenes'] });
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
      actualizarFila(m.numero, { saving: false });
    }
  };

  const activos = margenes.filter((m) => filas[m.numero]?.activo);

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={<strong>¿Cómo funcionan los márgenes?</strong>}
        description={<>Al registrar una compra, el sistema calcula automáticamente los precios de venta de cada producto usando estas configuraciones:<br /><code>Precio de venta = Costo unitario sin IGV × (1 + Margen%)</code></>}
      />

      <Card title="Configuración de Listas de Precio" extra={<Tag>{margenes.length} listas</Tag>}>
        {margenes.map((m) => {
          const fila = filas[m.numero];
          if (!fila) return null;
          const precio = costoEjemplo * (1 + fila.margen / 100);
          return (
            <Card key={m.numero} size="small" style={{ marginBottom: 12, borderColor: fila.activo ? '#52c41a' : undefined, opacity: fila.activo ? 1 : 0.75 }}>
              <Row gutter={8} align="middle">
                <Col><Tag color="blue" style={{ fontSize: 14, padding: '2px 10px' }}>P{m.numero}</Tag></Col>
                <Col span={5}>
                  <Input size="small" value={fila.nombre} onChange={(e) => actualizarFila(m.numero, { nombre: e.target.value })} placeholder="Nombre del precio" />
                </Col>
                <Col span={4}>
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber size="small" value={fila.margen} onChange={(v) => actualizarFila(m.numero, { margen: v ?? 0 })} min={0} max={1000} step={0.5} style={{ width: '100%' }} />
                    <Button size="small" disabled>%</Button>
                  </Space.Compact>
                </Col>
                <Col span={6}>
                  <Input size="small" value={fila.descripcion} onChange={(e) => actualizarFila(m.numero, { descripcion: e.target.value })} placeholder="Descripción (opcional)" />
                </Col>
                <Col>
                  <Switch size="small" checked={fila.activo} onChange={(v) => actualizarFila(m.numero, { activo: v })} />
                </Col>
                <Col flex="auto" />
                <Col>
                  <Button size="small" type="primary" icon={<SaveOutlined />} loading={fila.saving} onClick={() => guardar(m)}>Guardar</Button>
                </Col>
              </Row>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Con costo S/ 100 → {formatMoneda(precio)} (+{fila.margen}%)
              </Typography.Text>
            </Card>
          );
        })}
      </Card>

      <Card title="Ejemplo de cálculo" style={{ marginTop: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text type="secondary">Costo de compra (sin IGV)</Typography.Text>
            <Space.Compact style={{ display: 'flex', width: 180, marginTop: 4 }}>
              <Button disabled>S/</Button>
              <InputNumber
                value={costoEjemplo} onChange={(v) => setCostoEjemplo(v ?? 0)}
                min={0} step={0.01} style={{ width: '100%' }}
              />
            </Space.Compact>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Precios de venta calculados:</Typography.Text>
            {activos.length
              ? activos.map((m) => (
                <Tag color="success" key={m.numero}>P{m.numero}: {formatMoneda(costoEjemplo * (1 + (filas[m.numero]?.margen ?? 0) / 100))}</Tag>
              ))
              : <Typography.Text type="secondary">Sin listas activas</Typography.Text>}
          </div>
        </Space>
      </Card>
    </div>
  );
}
