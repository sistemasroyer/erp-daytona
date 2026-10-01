import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, InputNumber, Row, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, CalculatorOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { letrasPaquetesApi } from '@/api/letras';
import { ApiError } from '@/api/types';
import { useConfirmar } from '@/components/ConfirmModal';
import { formatMoneda } from '@/utils/format';
import type { AnalisisDistribucion, CapacidadDia, ConfigDistribucion } from '@/types/letras';

const DIAS_BANCO = 7;

interface FilaLetra {
  key: number;
  fecha_pago: string;
  monto: number;
}

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Generación de letras de un paquete aprobado: el sistema propone el número de cuotas y su reparto
 * (motor portado de letras-daytona); el usuario puede recalcular con otro número de cuotas o
 * tolerancia, ajustar fechas y montos a mano, y guardar.
 */
export function GenerarLetrasPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const { data: paqueteData } = useQuery({ queryKey: ['letras-paquete', id], queryFn: () => letrasPaquetesApi.obtener(id!), enabled: !!id });
  const paquete = paqueteData?.data;

  const [tolerancia, setTolerancia] = useState(20);
  const [montoMinimo, setMontoMinimo] = useState(100);
  const [cuotas, setCuotas] = useState<number | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisDistribucion | null>(null);
  const [filas, setFilas] = useState<FilaLetra[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const calcular = async (numeroCuotas?: number) => {
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      const config: ConfigDistribucion = { tolerancia, monto_minimo: montoMinimo, numero_cuotas: numeroCuotas };
      const { data } = await letrasPaquetesApi.analizar(id, config);
      setAnalisis(data);
      setFilas(data.letras.map((l, i) => ({ key: i, fecha_pago: l.fecha_pago, monto: l.monto })));
      setCuotas(data.letras.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo calcular la distribución');
      setAnalisis(null);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  };

  // Propuesta automática al entrar.
  useEffect(() => {
    if (paquete && ['aprobado', 'en_proceso'].includes(paquete.estado) && !analisis && !cargando && !error) calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paquete]);

  const capacidad = useMemo(() => new Map((analisis?.capacidad_dias || []).map((d) => [d.fecha, d])), [analisis]);
  const total = paquete ? Number(paquete.monto_total) : 0;
  const suma = r2(filas.reduce((s, f) => s + (f.monto || 0), 0));
  const diferencia = r2(total - suma);
  const fechasRepetidas = new Set(filas.map((f) => f.fecha_pago)).size !== filas.length;
  const yaTieneLetras = (paquete?.letras?.length ?? 0) > 0;
  const tolUsada = analisis?.tolerancia_utilizada ?? tolerancia;
  const m = paquete?.moneda ?? 'PEN';

  /** % del límite del día que ocuparía la letra (lo de otros paquetes + esta). */
  const ocupacion = (f: FilaLetra) => {
    const d = capacidad.get(f.fecha_pago);
    if (!d || d.limite_maximo <= 0) return null;
    return ((d.monto_programado + (f.monto || 0)) / d.limite_maximo) * 100;
  };

  const actualizar = (key: number, cambios: Partial<FilaLetra>) => setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambios } : f)));

  const ajustarDiferenciaEnUltima = () => {
    if (!filas.length) return;
    const ultima = filas[filas.length - 1];
    actualizar(ultima.key, { monto: r2(ultima.monto + diferencia) });
  };

  const guardar = async () => {
    if (!id || !paquete) return;
    if (Math.abs(diferencia) > 0.009) { message.warning('La suma de las letras debe ser igual al monto del paquete'); return; }
    if (fechasRepetidas) { message.warning('Hay dos letras con la misma fecha'); return; }
    const pregunta = yaTieneLetras
      ? `Se reemplazarán las ${paquete.letras!.length} letras actuales por ${filas.length} nuevas. ¿Continuar?`
      : `¿Generar ${filas.length} letra(s) por ${formatMoneda(total, m)}? El paquete pasará a En proceso.`;
    if (!(await confirmar(pregunta, yaTieneLetras ? 'Regenerar letras' : 'Generar letras'))) return;
    setGuardando(true);
    try {
      const { data } = await letrasPaquetesApi.generar(id, filas.map((f) => ({ fecha_pago: f.fecha_pago, monto: f.monto })), yaTieneLetras);
      message.success(`${data.letras} letras ${data.regenerado ? 'regeneradas' : 'generadas'}`);
      queryClient.invalidateQueries({ queryKey: ['letras-paquete', id] });
      queryClient.invalidateQueries({ queryKey: ['letras-paquetes'] });
      queryClient.invalidateQueries({ queryKey: ['letras-paquetes-resumen'] });
      navigate(`/letras/paquetes/${id}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar las letras');
    } finally {
      setGuardando(false);
    }
  };

  if (!paquete) return <Card loading />;
  if (!['aprobado', 'en_proceso'].includes(paquete.estado)) {
    return <Empty description="Las letras se generan con el paquete Aprobado (o En proceso para regenerar)" />;
  }

  const columnas: ColumnsType<FilaLetra> = [
    { title: 'Cuota', align: 'center', width: 70, render: (_, __, i) => i + 1 },
    {
      title: 'Fecha de pago', width: 190, render: (_, f) => (
        <DatePicker
          value={dayjs(f.fecha_pago)} format="ddd DD/MM/YYYY" allowClear={false} style={{ width: '100%' }}
          disabledDate={(d) => d.day() === 0 || capacidad.get(d.format('YYYY-MM-DD'))?.es_habil === false}
          onChange={(v) => v && actualizar(f.key, { fecha_pago: v.format('YYYY-MM-DD') })}
        />
      ),
    },
    { title: 'Fecha banco', render: (_, f) => dayjs(f.fecha_pago).subtract(DIAS_BANCO, 'day').format('DD/MM/YYYY') },
    {
      title: 'Monto', width: 170, render: (_, f) => (
        <InputNumber value={f.monto} min={0.01} precision={2} style={{ width: '100%' }} onChange={(v) => actualizar(f.key, { monto: v ?? 0 })} />
      ),
    },
    {
      title: 'Uso del límite del día', render: (_, f) => {
        const d = capacidad.get(f.fecha_pago);
        const pct = ocupacion(f);
        if (!d || pct === null) return <Typography.Text type="secondary">Fuera del rango analizado</Typography.Text>;
        const color = pct <= 100 ? 'green' : pct <= 100 + tolUsada ? 'orange' : 'red';
        return (
          <Tooltip title={`Otros pagos ese día: ${formatMoneda(d.monto_programado, m)} · Límite: ${formatMoneda(d.limite_maximo, m)}`}>
            <Tag color={color}>{pct.toFixed(0)}%</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatMoneda(d.monto_programado + (f.monto || 0), m)} / {formatMoneda(d.limite_maximo, m)}</Typography.Text>
            {d.tiene_letra_proveedor && <Tag color="red" style={{ marginLeft: 4 }}>Proveedor ya paga ese día</Tag>}
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/letras/paquetes/${id}`)} />
        <Typography.Title level={4} style={{ margin: 0 }}>{yaTieneLetras ? 'Regenerar' : 'Generar'} letras — {paquete.codigo}</Typography.Title>
      </Space>

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">{paquete.proveedor.razon_social}</Typography.Text>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{formatMoneda(total, m)}</div>
            <Typography.Text type="secondary">
              Banco: {dayjs(paquete.fecha_inicio_pago).format('DD/MM/YYYY')} → {dayjs(paquete.fecha_fin_pago).format('DD/MM/YYYY')} ({paquete.dias_credito} días)
            </Typography.Text>
            {paquete.proveedor.letras_pago_unico && <div><Tag color="orange">Proveedor de pago único: 1 letra</Tag></div>}
          </Card>
          <Card size="small" title="Parámetros" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <div>
                <Typography.Text>Tolerancia sobre el límite diario</Typography.Text>
                <InputNumber value={tolerancia} onChange={(v) => setTolerancia(v ?? 20)} min={0} max={50} suffix="%" style={{ width: '100%' }} />
              </div>
              <div>
                <Typography.Text>Monto mínimo por día</Typography.Text>
                <InputNumber value={montoMinimo} onChange={(v) => setMontoMinimo(v ?? 100)} min={0} step={50} style={{ width: '100%' }} />
              </div>
              <Button block icon={<ThunderboltOutlined />} loading={cargando} onClick={() => calcular()}>Proponer automáticamente</Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <InputNumber value={cuotas} onChange={setCuotas} min={1} max={36} placeholder="N° cuotas" style={{ flex: 1 }} disabled={paquete.proveedor.letras_pago_unico} />
                <Button icon={<CalculatorOutlined />} loading={cargando} disabled={!cuotas} onClick={() => cuotas && calcular(cuotas)}>Recalcular</Button>
              </div>
            </Space>
          </Card>
          {analisis && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={8}>
                <Col span={12}><Statistic title="Cuotas" value={filas.length} /></Col>
                <Col span={12}><Statistic title="Tolerancia usada" value={analisis.tolerancia_utilizada} suffix="%" /></Col>
                <Col span={24}><Typography.Text type="secondary" style={{ fontSize: 12 }}>Tipo de cambio usado para convertir límites y pagos en otra moneda: {analisis.tipo_cambio}</Typography.Text></Col>
              </Row>
              {analisis.analisis_cuotas && <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>{analisis.analisis_cuotas.explicacion}</Typography.Paragraph>}
            </Card>
          )}
        </Col>

        <Col xs={24} lg={16}>
          {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="No se pudo repartir el monto" description={error} />}
          {analisis?.mensaje_tolerancia && <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={analisis.mensaje_tolerancia} />}
          {yaTieneLetras && <Alert type="info" showIcon style={{ marginBottom: 16 }} title={`El paquete ya tiene ${paquete.letras!.length} letras: al guardar se reemplazarán.`} />}
          <Card
            size="small" title="Letras propuestas"
            extra={
              <Space>
                <Typography.Text strong style={{ color: Math.abs(diferencia) > 0.009 ? '#cf1322' : '#389e0d' }}>
                  Suma {formatMoneda(suma, m)} {Math.abs(diferencia) > 0.009 && `(falta ${formatMoneda(diferencia, m)})`}
                </Typography.Text>
                {Math.abs(diferencia) > 0.009 && <Button size="small" onClick={ajustarDiferenciaEnUltima}>Ajustar en la última</Button>}
              </Space>
            }
          >
            <Table size="small" rowKey="key" loading={cargando} columns={columnas} dataSource={filas} pagination={false}
              locale={{ emptyText: cargando ? 'Calculando...' : 'Sin propuesta' }} />
            {fechasRepetidas && <Alert type="error" showIcon style={{ marginTop: 8 }} title="Hay dos letras con la misma fecha" />}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <Button type="primary" size="large" icon={<SaveOutlined />} loading={guardando} disabled={!filas.length || Math.abs(diferencia) > 0.009 || fechasRepetidas} onClick={guardar}>
                {yaTieneLetras ? 'Regenerar letras' : 'Guardar letras'}
              </Button>
            </div>
          </Card>
          {analisis && <CalendarioCapacidad dias={analisis.capacidad_dias} elegidas={new Map(filas.map((f) => [f.fecha_pago, f.monto]))} moneda={m} />}
        </Col>
      </Row>
    </div>
  );
}

/** Capacidad de pago de cada día del rango analizado (semanas de lunes a domingo), marcando los días elegidos. */
function CalendarioCapacidad({ dias, elegidas, moneda }: { dias: CapacidadDia[]; elegidas: Map<string, number>; moneda: 'PEN' | 'USD' }) {
  if (!dias.length) return null;
  const relleno = dias[0].num_dia_semana - 1;
  const celdas: (CapacidadDia | null)[] = [...Array(relleno).fill(null), ...dias];
  const COLOR: Record<CapacidadDia['estado'], string> = { disponible: '#f6ffed', limitado: '#fffbe6', sin_capacidad: '#fff1f0', no_habil: '#f5f5f5' };
  return (
    <Card size="small" title="Capacidad de pago por día" style={{ marginTop: 16 }}
      extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Verde: libre · Amarillo: poco espacio · Rojo: lleno · Gris: no hábil · Azul: letra propuesta</Typography.Text>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={`v${i}`} />;
          const monto = elegidas.get(d.fecha);
          return (
            <Tooltip key={d.fecha} title={`${dayjs(d.fecha).format('DD/MM/YYYY')} — programado ${formatMoneda(d.monto_programado, moneda)} de ${formatMoneda(d.limite_maximo, moneda)}${d.tiene_letra_proveedor ? ' · el proveedor ya tiene letra' : ''}`}>
              <div style={{
                background: monto !== undefined ? '#e6f4ff' : COLOR[d.estado], border: monto !== undefined ? '2px solid #1677ff' : '1px solid #f0f0f0',
                borderRadius: 6, padding: '4px 6px', minHeight: 48, fontSize: 11,
              }}>
                <div style={{ fontWeight: 600 }}>{dayjs(d.fecha).format('DD/MM')}</div>
                {d.es_habil
                  ? <div style={{ color: '#595959' }}>{monto !== undefined ? <strong style={{ color: '#1677ff' }}>{formatMoneda(monto, moneda)}</strong> : `libre ${formatMoneda(d.capacidad_disponible, moneda)}`}</div>
                  : <div style={{ color: '#8c8c8c' }}>No hábil</div>}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </Card>
  );
}
