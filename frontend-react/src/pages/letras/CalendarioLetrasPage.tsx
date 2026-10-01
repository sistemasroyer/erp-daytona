import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Card, Drawer, Empty, Progress, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, RightOutlined, UnorderedListOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCuotasApi } from '@/api/letras';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useConfirmar } from '@/components/ConfirmModal';
import { EstadoTag } from '@/components/EstadoTag';
import { formatMoneda } from '@/utils/format';
import type { DiaCalendarioLetras, MonedaLetras } from '@/types/letras';
import { AccionesLetra, CANCELADO, moverLetra, useRefrescarLetras } from './AccionesLetra';
import { estadoLetraVisible } from './PaqueteLetrasDetallePage';

type LetraDia = DiaCalendarioLetras['letras'][number];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const colorLetra = (l: LetraDia) => (l.estado === 'pagada' ? '#389e0d' : l.vencida ? '#cf1322' : '#1677ff');
const colorUso = (pct: number) => (pct > 100 ? '#cf1322' : pct > 80 ? '#fa8c16' : '#52c41a');

/**
 * Calendario mensual de pagos de letras: total de cada día contra su límite (todo convertido a la
 * moneda elegida) y las letras del día. Las letras pendientes se pueden arrastrar a otro día.
 */
export function CalendarioLetrasPage() {
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const { hasPermiso } = useAuth();
  const refrescar = useRefrescarLetras();
  const [mes, setMes] = useState<Dayjs>(dayjs().startOf('month'));
  const [moneda, setMoneda] = useState<MonedaLetras>('PEN');
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<LetraDia | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const puedeMover = hasPermiso('letras:editar');

  // La grilla empieza el lunes de la semana del día 1 y termina el domingo de la semana del último día.
  const inicio = mes.subtract((mes.day() + 6) % 7, 'day');
  const finMes = mes.endOf('month');
  const fin = finMes.add((7 - finMes.day()) % 7, 'day');
  const desde = inicio.format('YYYY-MM-DD');
  const hasta = fin.format('YYYY-MM-DD');

  const { data, isFetching } = useQuery({
    queryKey: ['letras-calendario', desde, hasta, moneda],
    queryFn: () => letrasCuotasApi.calendario(desde, hasta, moneda),
  });
  const dias = data?.data.dias ?? [];
  const delMes = dias.filter((d) => d.fecha.startsWith(mes.format('YYYY-MM')));
  const totalMes = delMes.reduce((s, d) => s + d.total, 0);
  const pendienteMes = delMes.reduce((s, d) => s + d.letras.filter((l) => l.estado === 'pendiente').reduce((a, l) => a + l.monto_vista, 0), 0);
  const hoy = dayjs().format('YYYY-MM-DD');
  const dia = dias.find((d) => d.fecha === diaAbierto);

  const soltar = async (fecha: string) => {
    const letra = arrastrando;
    setArrastrando(null);
    setDestino(null);
    if (!letra || letra.fecha_pago === fecha) return;
    const ok = await confirmar(
      `¿Mover la cuota ${letra.numero_cuota} de ${letra.paquete.proveedor.razon_social} (${formatMoneda(letra.monto, letra.moneda)}) del ${dayjs(letra.fecha_pago).format('DD/MM')} al ${dayjs(fecha).format('dddd DD/MM/YYYY')}?`,
      'Mover letra',
    );
    if (!ok) return;
    try {
      await moverLetra(letra.id, fecha, confirmar);
      message.success('Letra movida');
      refrescar();
    } catch (err) {
      if (err !== CANCELADO) message.error(err instanceof ApiError ? err.message : 'No se pudo mover la letra');
    }
  };

  const columnasDia: ColumnsType<LetraDia> = [
    { title: 'Proveedor', render: (_, l) => <><div>{l.paquete.proveedor.razon_social}</div><Link to={`/letras/paquetes/${l.paquete.id}`} style={{ fontSize: 12 }}>{l.paquete.codigo} · cuota {l.numero_cuota}</Link></> },
    { title: 'Monto', align: 'right', render: (_, l) => <strong>{formatMoneda(l.monto, l.moneda)}</strong> },
    { title: 'Estado', align: 'center', render: (_, l) => <EstadoTag estado={estadoLetraVisible(l)} /> },
    { title: '', width: 50, render: (_, l) => <AccionesLetra letra={l} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Calendario de Letras</Typography.Title>
        <Space wrap>
          <Segmented value={moneda} onChange={(v) => setMoneda(v as MonedaLetras)} options={[{ value: 'PEN', label: 'Ver en soles' }, { value: 'USD', label: 'Ver en dólares' }]} />
          <Link to="/letras"><Button icon={<UnorderedListOutlined />}>Listado de letras</Button></Link>
        </Space>
      </div>

      <Card loading={isFetching && !data}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => setMes(mes.subtract(1, 'month'))} aria-label="Mes anterior" />
            <Typography.Title level={5} style={{ margin: 0, minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>{mes.format('MMMM YYYY')}</Typography.Title>
            <Button icon={<RightOutlined />} onClick={() => setMes(mes.add(1, 'month'))} aria-label="Mes siguiente" />
            <Button onClick={() => setMes(dayjs().startOf('month'))}>Hoy</Button>
          </Space>
          <Space size="large" wrap>
            <span>Total del mes: <strong>{formatMoneda(totalMes, moneda)}</strong></span>
            <span>Por pagar: <strong>{formatMoneda(pendienteMes, moneda)}</strong></span>
            {data && dias.some((d) => d.letras.some((l) => l.moneda !== moneda)) && (
              <Tooltip title="Las letras en la otra moneda se convierten con este tipo de cambio para sumar el día">
                <Typography.Text type="secondary">T.C. {data.data.tipo_cambio.toFixed(3)}</Typography.Text>
              </Tooltip>
            )}
          </Space>
        </div>
        {puedeMover && <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>Arrastre una letra pendiente a otro día para moverla. Haga clic en un día para ver el detalle.</Typography.Paragraph>}

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 4, minWidth: 860 }}>
            {DIAS.map((d) => <div key={d} style={{ textAlign: 'center', fontWeight: 600, padding: 4 }}>{d}</div>)}
            {dias.map((d) => {
              const fueraMes = !d.fecha.startsWith(mes.format('YYYY-MM'));
              const noHabil = d.domingo || !!d.no_pago;
              const pct = d.limite > 0 ? (d.total / d.limite) * 100 : 0;
              const resaltado = destino === d.fecha && arrastrando && !noHabil;
              return (
                <div
                  key={d.fecha}
                  onClick={() => d.letras.length && setDiaAbierto(d.fecha)}
                  onDragOver={(e) => { if (arrastrando && !noHabil) { e.preventDefault(); setDestino(d.fecha); } }}
                  onDragLeave={() => setDestino((x) => (x === d.fecha ? null : x))}
                  onDrop={(e) => { e.preventDefault(); soltar(d.fecha); }}
                  style={{
                    minHeight: 110, padding: 6, borderRadius: 6, cursor: d.letras.length ? 'pointer' : 'default',
                    border: `1px solid ${resaltado ? '#1677ff' : d.fecha === hoy ? '#1677ff' : '#f0f0f0'}`,
                    background: resaltado ? '#e6f4ff' : noHabil ? '#fafafa' : '#fff', opacity: fueraMes ? 0.45 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: d.fecha === hoy ? '#1677ff' : undefined }}>{dayjs(d.fecha).date()}</strong>
                    {d.no_pago && <Tooltip title={d.no_pago}><Tag color="default" style={{ margin: 0, fontSize: 10 }}>No pago</Tag></Tooltip>}
                  </div>
                  {d.total > 0 && (
                    <Tooltip title={`${formatMoneda(d.total, moneda)} de ${formatMoneda(d.limite, moneda)} (${pct.toFixed(0)}% del límite)`}>
                      <div style={{ fontSize: 12, marginTop: 2 }}><strong>{formatMoneda(d.total, moneda)}</strong></div>
                      <Progress percent={Math.min(100, pct)} showInfo={false} size="small" strokeColor={colorUso(pct)} style={{ margin: 0 }} />
                    </Tooltip>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {d.letras.slice(0, 4).map((l) => (
                      <div
                        key={l.id}
                        draggable={puedeMover && l.estado === 'pendiente'}
                        onDragStart={(e) => { e.stopPropagation(); setArrastrando(l); }}
                        onDragEnd={() => { setArrastrando(null); setDestino(null); }}
                        title={`${l.paquete.proveedor.razon_social} — ${formatMoneda(l.monto, l.moneda)}`}
                        style={{
                          fontSize: 11, padding: '1px 4px', borderRadius: 3, borderLeft: `3px solid ${colorLetra(l)}`, background: '#f5f5f5',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: puedeMover && l.estado === 'pendiente' ? 'grab' : 'pointer',
                          textDecoration: l.estado === 'pagada' ? 'line-through' : undefined,
                        }}
                      >
                        {formatMoneda(l.monto, l.moneda)} {l.paquete.proveedor.razon_social}
                      </div>
                    ))}
                    {d.letras.length > 4 && <Typography.Text type="secondary" style={{ fontSize: 11 }}>+{d.letras.length - 4} más</Typography.Text>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Space size="middle" wrap style={{ marginTop: 12, fontSize: 12 }}>
          <span><Tag color="blue">■</Tag>Pendiente</span>
          <span><Tag color="red">■</Tag>Vencida</span>
          <span><Tag color="green">■</Tag>Pagada</span>
          <span>Barra: uso del límite del día (verde &lt; 80%, naranja &lt; 100%, rojo = excedido)</span>
        </Space>
      </Card>

      <Drawer open={!!dia} onClose={() => setDiaAbierto(null)} size="large" title={dia && <span style={{ textTransform: 'capitalize' }}>{dayjs(dia.fecha).format('dddd DD/MM/YYYY')}</span>}>
        {dia && (
          <>
            <Space size="large" style={{ marginBottom: 12 }} wrap>
              <span>Total: <strong>{formatMoneda(dia.total, moneda)}</strong></span>
              <span>Límite: <strong>{formatMoneda(dia.limite, moneda)}</strong></span>
              {dia.total > dia.limite && <Tag color="red">Excede el límite</Tag>}
            </Space>
            {dia.letras.length
              ? <Table size="small" rowKey="id" columns={columnasDia} dataSource={dia.letras} pagination={false} />
              : <Empty description="Sin letras este día" />}
          </>
        )}
      </Drawer>
    </div>
  );
}
