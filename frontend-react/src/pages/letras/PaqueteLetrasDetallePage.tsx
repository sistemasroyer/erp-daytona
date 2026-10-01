import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined, CheckOutlined, DeleteOutlined, EditOutlined, FileAddOutlined, PrinterOutlined, RollbackOutlined, SendOutlined,
  ShoppingCartOutlined, StopOutlined, ThunderboltOutlined, UndoOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCatalogosApi, letrasPaquetesApi } from '@/api/letras';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useConfirmar } from '@/components/ConfirmModal';
import { EstadoTag } from '@/components/EstadoTag';
import { HistorialDocumento } from '@/components/HistorialDocumento';
import { formatMoneda, nombreUsuario } from '@/utils/format';
import { AccionesLetra } from './AccionesLetra';
import {
  TIPO_DOCUMENTO_LETRA_LABEL, type CompraDisponible, type DocumentoLetra, type Letra, type PaqueteLetras, type TipoDocumentoLetra,
} from '@/types/letras';

const hoy = () => dayjs().format('YYYY-MM-DD');

/** Estado a mostrar de una letra: "vencida" = pendiente con fecha de pago ya pasada. */
export function estadoLetraVisible(l: Pick<Letra, 'estado' | 'fecha_pago'>) {
  return l.estado === 'pendiente' && l.fecha_pago < hoy() ? 'vencida' : l.estado;
}

export function PaqueteLetrasDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { confirmar } = useConfirmar();
  const { hasPermiso } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['letras-paquete', id], queryFn: () => letrasPaquetesApi.obtener(id!), enabled: !!id });
  const paquete = data?.data;

  const [editarAbierto, setEditarAbierto] = useState(false);
  const [comprasAbierto, setComprasAbierto] = useState(false);
  const [docEditando, setDocEditando] = useState<DocumentoLetra | 'nuevo' | null>(null);
  const [cancelarAbierto, setCancelarAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const recargar = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['letras-paquetes'] });
    queryClient.invalidateQueries({ queryKey: ['letras-paquetes-resumen'] });
  };

  const accion = async (fn: () => Promise<unknown>, exito: string, pregunta?: string) => {
    if (pregunta && !(await confirmar(pregunta))) return;
    setProcesando(true);
    try {
      await fn();
      message.success(exito);
      recargar();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setProcesando(false);
    }
  };

  if (isLoading) return <Card loading />;
  if (!paquete) return <Empty description="Paquete no encontrado" />;

  const m = paquete.moneda;
  const enBorrador = paquete.estado === 'borrador';
  const puedeEditarDocs = enBorrador && hasPermiso('letras:editar');
  const documentos = paquete.documentos || [];
  const letras = paquete.letras || [];
  const totalFacturas = documentos.filter((d) => Number(d.monto) > 0).reduce((s, d) => s + Number(d.monto), 0);
  const totalNc = documentos.filter((d) => Number(d.monto) < 0).reduce((s, d) => s + Number(d.monto), 0);

  const columnasDocs: ColumnsType<DocumentoLetra> = [
    { title: 'Tipo', render: (_, d) => <Tag color={d.tipo === 'nota_credito' ? 'red' : 'blue'}>{TIPO_DOCUMENTO_LETRA_LABEL[d.tipo]}</Tag> },
    { title: 'Documento', render: (_, d) => <strong>{d.serie}-{d.numero}</strong> },
    { title: 'Origen', render: (_, d) => d.compra ? <Typography.Text type="secondary">Compra {d.compra.numero_interno}</Typography.Text> : <Typography.Text type="secondary">Manual</Typography.Text> },
    { title: 'Emisión', render: (_, d) => dayjs(d.fecha_emision).format('DD/MM/YYYY') },
    { title: 'Vencimiento', render: (_, d) => d.fecha_vencimiento ? dayjs(d.fecha_vencimiento).format('DD/MM/YYYY') : '-' },
    { title: 'Días', align: 'center', dataIndex: 'dias_credito' },
    { title: 'Monto', align: 'right', render: (_, d) => <strong style={{ color: Number(d.monto) < 0 ? '#cf1322' : undefined }}>{formatMoneda(d.monto, m)}</strong> },
    ...(puedeEditarDocs ? [{
      title: '', width: 90, render: (_: unknown, d: DocumentoLetra) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setDocEditando(d)} />
          <Button
            size="small" danger icon={<DeleteOutlined />}
            onClick={() => accion(() => letrasPaquetesApi.eliminarDocumento(paquete.id, d.id), 'Documento quitado del paquete', `¿Quitar ${d.serie}-${d.numero} del paquete?`)}
          />
        </Space>
      ),
    }] : []),
  ];

  const columnasLetras: ColumnsType<Letra> = [
    { title: 'Cuota', align: 'center', dataIndex: 'numero_cuota' },
    { title: 'Fecha banco', render: (_, l) => dayjs(l.fecha_banco).format('DD/MM/YYYY') },
    { title: 'Fecha de pago', render: (_, l) => <strong>{dayjs(l.fecha_pago).format('ddd DD/MM/YYYY')}</strong> },
    { title: 'Monto', align: 'right', render: (_, l) => <strong>{formatMoneda(l.monto, l.moneda)}</strong> },
    { title: 'Código banco', render: (_, l) => l.codigo_banco || '-' },
    { title: 'Estado', align: 'center', render: (_, l) => <EstadoTag estado={estadoLetraVisible(l)} /> },
    { title: 'Pago', render: (_, l) => l.estado === 'pagada' ? <>{l.fecha_pago_efectivo && dayjs(l.fecha_pago_efectivo).format('DD/MM/YYYY')} · {l.metodo_pago} {l.numero_operacion && `#${l.numero_operacion}`}<br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{nombreUsuario(l.usuario_pago)}</Typography.Text></> : '-' },
    { title: '', width: 50, render: (_, l) => <AccionesLetra letra={l} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/letras/paquetes')} />
          <Typography.Title level={4} style={{ margin: 0 }}>Paquete {paquete.codigo}</Typography.Title>
          <EstadoTag estado={paquete.estado} />
        </Space>
        <Space wrap>
          {['borrador', 'pendiente_aprobacion'].includes(paquete.estado) && hasPermiso('letras:editar') && (
            <Button icon={<EditOutlined />} onClick={() => setEditarAbierto(true)}>Editar datos</Button>
          )}
          {enBorrador && hasPermiso('letras:editar') && (
            <Button icon={<SendOutlined />} loading={procesando} onClick={() => accion(() => letrasPaquetesApi.enviar(paquete.id), 'Paquete enviado a aprobación')}>Enviar a aprobación</Button>
          )}
          {paquete.estado === 'pendiente_aprobacion' && hasPermiso('letras:aprobar') && (
            <Button icon={<RollbackOutlined />} loading={procesando} onClick={() => accion(() => letrasPaquetesApi.devolver(paquete.id), 'Paquete devuelto a borrador')}>Devolver</Button>
          )}
          {['borrador', 'pendiente_aprobacion'].includes(paquete.estado) && hasPermiso('letras:aprobar') && (
            <Button type="primary" icon={<CheckOutlined />} loading={procesando}
              onClick={() => accion(() => letrasPaquetesApi.aprobar(paquete.id), 'Paquete aprobado', `¿Aprobar el paquete por ${formatMoneda(paquete.monto_total, m)}? Después ya no se podrán cambiar sus documentos.`)}>
              Aprobar
            </Button>
          )}
          {paquete.estado === 'aprobado' && hasPermiso('letras:aprobar') && (
            <Button icon={<UndoOutlined />} loading={procesando} onClick={() => accion(() => letrasPaquetesApi.reabrir(paquete.id), 'Paquete reabierto en borrador', '¿Reabrir el paquete para cambiar sus documentos?')}>Reabrir</Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={() => window.open(`/letras/imprimir/paquete/${paquete.id}`, '_blank')}>Imprimir</Button>
          {['aprobado', 'en_proceso'].includes(paquete.estado) && hasPermiso('letras:crear') && (
            <Link to={`/letras/paquetes/${paquete.id}/generar`}>
              <Button type="primary" icon={<ThunderboltOutlined />}>{letras.length ? 'Regenerar letras' : 'Generar letras'}</Button>
            </Link>
          )}
          {!['completado', 'cancelado'].includes(paquete.estado) && hasPermiso('letras:anular') && (
            <Button danger icon={<StopOutlined />} onClick={() => setCancelarAbierto(true)}>Cancelar paquete</Button>
          )}
          {enBorrador && letras.length === 0 && hasPermiso('letras:eliminar') && (
            <Button danger icon={<DeleteOutlined />} loading={procesando}
              onClick={() => accion(async () => { await letrasPaquetesApi.eliminar(paquete.id); navigate('/letras/paquetes'); }, 'Paquete eliminado', `¿Eliminar el paquete ${paquete.codigo}?`)} />
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Proveedor"><strong>{paquete.proveedor.razon_social}</strong>&nbsp;<Typography.Text type="secondary">{paquete.proveedor.ruc}</Typography.Text></Descriptions.Item>
              <Descriptions.Item label="Banco">{paquete.banco ? `${paquete.banco.siglas ? paquete.banco.siglas + ' — ' : ''}${paquete.banco.nombre}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="Moneda">{m === 'USD' ? 'Dólares (US$)' : 'Soles (S/)'}</Descriptions.Item>
              <Descriptions.Item label="Periodo de pago">{dayjs(paquete.fecha_inicio_pago).format('DD/MM/YYYY')} → {dayjs(paquete.fecha_fin_pago).format('DD/MM/YYYY')} ({paquete.dias_credito} días)</Descriptions.Item>
              <Descriptions.Item label={letras.length ? 'Cuotas' : 'Cuotas sugeridas'}>
                {paquete.numero_cuotas}{paquete.proveedor.letras_pago_unico && <Tag color="orange" style={{ marginLeft: 8 }}>Pago único</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por">{nombreUsuario(paquete.usuario)} · {dayjs(paquete.fecha_creacion).format('DD/MM/YYYY')}</Descriptions.Item>
              {paquete.aprobador && <Descriptions.Item label="Aprobado por">{nombreUsuario(paquete.aprobador)}{paquete.fecha_aprobacion && ` · ${dayjs(paquete.fecha_aprobacion).format('DD/MM/YYYY HH:mm')}`}</Descriptions.Item>}
              {paquete.comentarios && <Descriptions.Item label="Comentarios" span={2}>{paquete.comentarios}</Descriptions.Item>}
            </Descriptions>
            <HistorialDocumento anulacion={paquete.anulacion} historial={paquete.historial} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" style={{ marginBottom: 16, borderColor: '#1677ff' }}>
            <Typography.Text type="secondary">Monto total del paquete</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{formatMoneda(paquete.monto_total, m)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Facturas</span><span>{formatMoneda(totalFacturas, m)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cf1322' }}><span>Notas de crédito</span><span>{formatMoneda(totalNc, m)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Documentos</span><span>{documentos.length}</span></div>
          </Card>
        </Col>
      </Row>

      {!!paquete.nc_fuera_del_paquete?.length && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          title={`Hay ${paquete.nc_fuera_del_paquete.length} nota(s) de crédito de las facturas de este paquete que no están en ningún paquete: ${paquete.nc_fuera_del_paquete.map((n) => n.serie ? `${n.serie}-${n.numero}` : n.numero || n.numero_interno).join(', ')}.`}
          description={{
            borrador: 'Agréguelas con "Agregar desde Compras" para que su descuento se aplique.',
            pendiente_aprobacion: 'Su descuento no se aplicó. Devuelva el paquete a Borrador y agréguelas, o agréguelas al próximo paquete del proveedor.',
            aprobado: 'Su descuento no se aplicó. Reabra el paquete y agréguelas, o agréguelas al próximo paquete del proveedor.',
          }[paquete.estado as string] ?? 'Su descuento no se aplicó a este paquete (ya tiene letras): agréguelas al próximo paquete del proveedor.'}
        />
      )}

      <Card
        size="small" title="Documentos del paquete" style={{ marginBottom: 16 }}
        extra={puedeEditarDocs && (
          <Space>
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => setComprasAbierto(true)}>Agregar desde Compras</Button>
            <Button icon={<FileAddOutlined />} onClick={() => setDocEditando('nuevo')}>Documento manual</Button>
          </Space>
        )}
      >
        {!enBorrador && documentos.length > 0 && paquete.estado !== 'cancelado' && (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>Los documentos solo se modifican con el paquete en Borrador.</Typography.Paragraph>
        )}
        <Table size="small" rowKey="id" columns={columnasDocs} dataSource={documentos} pagination={false}
          locale={{ emptyText: <Empty description={puedeEditarDocs ? 'Agregue las facturas a crédito del proveedor desde Compras' : 'Sin documentos'} /> }} />
      </Card>

      <Card size="small" title={`Letras${letras.length ? ` (${letras.length})` : ''}`} extra={letras.length > 0 && <ResumenLetrasPaquete paquete={paquete} letras={letras} />}>
        {letras.length
          ? <Table size="small" rowKey="id" columns={columnasLetras} dataSource={letras} pagination={false} />
          : <Empty description={paquete.estado === 'aprobado' ? 'Paquete aprobado: ya puede generar sus letras' : 'Las letras se generan cuando el paquete está aprobado'} />}
      </Card>

      {editarAbierto && <EditarPaqueteModal open paquete={paquete} onClose={() => setEditarAbierto(false)} onGuardado={() => { setEditarAbierto(false); recargar(); }} />}
      <ComprasDisponiblesModal open={comprasAbierto} paquete={paquete} onClose={() => setComprasAbierto(false)} onImportado={() => { setComprasAbierto(false); recargar(); }} />
      {docEditando && (
        <DocumentoModal key={docEditando === 'nuevo' ? 'nuevo' : docEditando.id} documento={docEditando} paquete={paquete}
          onClose={() => setDocEditando(null)} onGuardado={() => { setDocEditando(null); recargar(); }} />
      )}
      <CancelarModal open={cancelarAbierto} paquete={paquete} onClose={() => setCancelarAbierto(false)} onCancelado={() => { setCancelarAbierto(false); recargar(); }} />
    </div>
  );
}

/** Pagado / pendiente de las letras, y aviso si ya no suman el monto del paquete (p. ej. tras eliminar una sin pasar su monto). */
function ResumenLetrasPaquete({ paquete, letras }: { paquete: PaqueteLetras; letras: Letra[] }) {
  const vigentes = letras.filter((l) => l.estado !== 'cancelada');
  const pagado = vigentes.filter((l) => l.estado === 'pagada').reduce((s, l) => s + Number(l.monto), 0);
  const total = vigentes.reduce((s, l) => s + Number(l.monto), 0);
  const descuadre = paquete.estado !== 'cancelado' && Math.abs(total - Number(paquete.monto_total)) > 0.01;
  return (
    <Space size="middle" wrap>
      <span>Pagado: <strong>{formatMoneda(pagado, paquete.moneda)}</strong></span>
      <span>Pendiente: <strong>{formatMoneda(total - pagado, paquete.moneda)}</strong></span>
      {descuadre && <Tag color="orange">Las letras suman {formatMoneda(total, paquete.moneda)}, no {formatMoneda(paquete.monto_total, paquete.moneda)}</Tag>}
    </Space>
  );
}

function EditarPaqueteModal({ open, paquete, onClose, onGuardado }: { open: boolean; paquete: PaqueteLetras; onClose: () => void; onGuardado: () => void }) {
  const { message } = App.useApp();
  const { data: bancosData } = useQuery({ queryKey: ['letras-bancos'], queryFn: () => letrasCatalogosApi.listarBancos(), enabled: open });
  const [idBanco, setIdBanco] = useState<string | undefined>(paquete.id_banco ?? undefined);
  const [inicio, setInicio] = useState<Dayjs>(dayjs(paquete.fecha_inicio_pago));
  const [dias, setDias] = useState(paquete.dias_credito);
  const [cuotas, setCuotas] = useState(paquete.numero_cuotas);
  const [comentarios, setComentarios] = useState(paquete.comentarios ?? '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await letrasPaquetesApi.actualizar(paquete.id, {
        id_banco: idBanco, fecha_inicio_pago: inicio.format('YYYY-MM-DD'), dias_credito: dias, numero_cuotas: cuotas, comentarios: comentarios.trim() || undefined,
      });
      message.success('Paquete actualizado');
      onGuardado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title={`Editar paquete ${paquete.codigo}`} open={open} onCancel={onClose} onOk={guardar} confirmLoading={guardando} okText="Guardar" destroyOnHidden>
      <Form layout="vertical">
        <Form.Item label="Banco">
          <Select allowClear value={idBanco} onChange={setIdBanco} options={(bancosData?.data || []).map((b) => ({ value: b.id, label: b.nombre }))} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={8}><Form.Item label="Inicio de pago"><DatePicker value={inicio} onChange={(v) => v && setInicio(v)} format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item label="Días de crédito" help={`Fin: ${inicio.add(dias, 'day').format('DD/MM/YYYY')}`}><InputNumber value={dias} onChange={(v) => setDias(v ?? 0)} min={0} max={365} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item label="Cuotas sugeridas"><InputNumber value={cuotas} onChange={(v) => setCuotas(v ?? 1)} min={1} max={36} disabled={paquete.proveedor.letras_pago_unico} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item label="Comentarios"><Input.TextArea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} maxLength={500} /></Form.Item>
      </Form>
    </Modal>
  );
}

function ComprasDisponiblesModal({ open, paquete, onClose, onImportado }: { open: boolean; paquete: PaqueteLetras; onClose: () => void; onImportado: () => void }) {
  const { message } = App.useApp();
  const { data, isFetching } = useQuery({
    queryKey: ['letras-compras-disponibles', paquete.id], queryFn: () => letrasPaquetesApi.comprasDisponibles(paquete.id), enabled: open,
  });
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);
  const compras = data?.data || [];
  const total = useMemo(() => compras.filter((c) => seleccion.includes(c.id)).reduce((s, c) => s + c.monto, 0), [compras, seleccion]);

  const importar = async () => {
    if (!seleccion.length) { message.warning('Seleccione al menos un documento'); return; }
    setImportando(true);
    try {
      const { data: r } = await letrasPaquetesApi.importarCompras(paquete.id, seleccion);
      message.success(`${r.importados} documento(s) agregados al paquete`);
      setSeleccion([]);
      onImportado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al agregar');
    } finally {
      setImportando(false);
    }
  };

  const columnas: ColumnsType<CompraDisponible> = [
    {
      title: <Checkbox checked={!!compras.length && seleccion.length === compras.length} indeterminate={seleccion.length > 0 && seleccion.length < compras.length}
        onChange={(e) => setSeleccion(e.target.checked ? compras.map((c) => c.id) : [])} />,
      width: 40, render: (_, c) => <Checkbox checked={seleccion.includes(c.id)} onChange={(e) => setSeleccion((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />,
    },
    { title: 'Tipo', render: (_, c) => <Tag color={c.tipo === 'nota_credito' ? 'red' : 'blue'}>{TIPO_DOCUMENTO_LETRA_LABEL[c.tipo]}</Tag> },
    { title: 'Documento', render: (_, c) => <><strong>{c.serie}-{c.numero}</strong><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.numero_interno}</Typography.Text></> },
    { title: 'Emisión', render: (_, c) => dayjs(c.fecha_emision).format('DD/MM/YYYY') },
    { title: 'Vence', render: (_, c) => dayjs(c.fecha_vencimiento).format('DD/MM/YYYY') },
    { title: 'Monto', align: 'right', render: (_, c) => <strong style={{ color: c.monto < 0 ? '#cf1322' : undefined }}>{formatMoneda(c.monto, paquete.moneda)}</strong> },
  ];

  return (
    <Modal
      title={`Compras a crédito de ${paquete.proveedor.razon_social} (${paquete.moneda})`} open={open} onCancel={onClose} width={820} destroyOnHidden
      footer={[
        <Typography.Text key="t" strong style={{ marginRight: 16 }}>Seleccionado: {formatMoneda(total, paquete.moneda)}</Typography.Text>,
        <Button key="c" onClick={onClose}>Cerrar</Button>,
        <Button key="o" type="primary" loading={importando} disabled={!seleccion.length} onClick={importar}>Agregar {seleccion.length || ''} al paquete</Button>,
      ]}
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="Aparecen las facturas registradas en Compras como CRÉDITO en esta moneda, y sus notas de crédito, que todavía no están en otro paquete." />
      <Table size="small" rowKey="id" loading={isFetching} columns={columnas} dataSource={compras} pagination={false}
        locale={{ emptyText: 'No hay compras a crédito pendientes de este proveedor en esta moneda' }} />
    </Modal>
  );
}

function DocumentoModal({ documento, paquete, onClose, onGuardado }: { documento: DocumentoLetra | 'nuevo'; paquete: PaqueteLetras; onClose: () => void; onGuardado: () => void }) {
  const { message } = App.useApp();
  const editando = documento !== 'nuevo' ? documento : null;
  const deCompra = !!editando?.id_compra;
  const [tipo, setTipo] = useState<TipoDocumentoLetra>(editando?.tipo ?? 'factura');
  const [serie, setSerie] = useState(editando?.serie ?? '');
  const [numero, setNumero] = useState(editando?.numero ?? '');
  const [monto, setMonto] = useState<number | null>(editando ? Math.abs(Number(editando.monto)) : null);
  const [emision, setEmision] = useState<Dayjs | null>(editando ? dayjs(editando.fecha_emision) : dayjs());
  const [vencimiento, setVencimiento] = useState<Dayjs | null>(editando?.fecha_vencimiento ? dayjs(editando.fecha_vencimiento) : null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!deCompra && (!serie.trim() || !numero.trim() || !monto || !emision)) { message.warning('Complete serie, número, monto y fecha de emisión'); return; }
    setGuardando(true);
    try {
      const fechas = { fecha_emision: emision!.format('YYYY-MM-DD'), fecha_vencimiento: vencimiento?.format('YYYY-MM-DD') };
      if (editando) {
        await letrasPaquetesApi.actualizarDocumento(paquete.id, editando.id, deCompra ? fechas : { tipo, serie: serie.trim(), numero: numero.trim(), monto: monto!, ...fechas });
      } else {
        await letrasPaquetesApi.agregarDocumento(paquete.id, { tipo, serie: serie.trim(), numero: numero.trim(), monto: monto!, ...fechas });
      }
      message.success('Documento guardado');
      onGuardado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar el documento');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title={editando ? `Editar ${editando.serie}-${editando.numero}` : 'Documento manual'} open onCancel={onClose} onOk={guardar} confirmLoading={guardando} okText="Guardar" destroyOnHidden>
      {deCompra && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Viene de una compra registrada: solo se pueden ajustar las fechas. El monto y el número se corrigen en Compras." />}
      <Form layout="vertical">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Tipo">
              <Select value={tipo} onChange={setTipo} disabled={deCompra}
                options={(Object.keys(TIPO_DOCUMENTO_LETRA_LABEL) as TipoDocumentoLetra[]).map((t) => ({ value: t, label: TIPO_DOCUMENTO_LETRA_LABEL[t] }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={`Monto (${paquete.moneda})`} help={tipo === 'nota_credito' ? 'Se resta del paquete' : undefined}>
              <InputNumber value={monto} onChange={setMonto} min={0.01} precision={2} style={{ width: '100%' }} disabled={deCompra} />
            </Form.Item>
          </Col>
          <Col span={12}><Form.Item label="Serie"><Input value={serie} onChange={(e) => setSerie(e.target.value)} maxLength={10} disabled={deCompra} /></Form.Item></Col>
          <Col span={12}><Form.Item label="Número"><Input value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={20} disabled={deCompra} /></Form.Item></Col>
          <Col span={12}><Form.Item label="Emisión"><DatePicker value={emision} onChange={setEmision} format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item label="Vencimiento"><DatePicker value={vencimiento} onChange={setVencimiento} format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
}

function CancelarModal({ open, paquete, onClose, onCancelado }: { open: boolean; paquete: PaqueteLetras; onClose: () => void; onCancelado: () => void }) {
  const { message } = App.useApp();
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cancelar = async () => {
    if (motivo.trim().length < 3) { message.warning('Indique el motivo'); return; }
    setGuardando(true);
    try {
      await letrasPaquetesApi.cancelar(paquete.id, motivo.trim());
      message.success('Paquete cancelado');
      setMotivo('');
      onCancelado();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al cancelar');
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal title={`Cancelar paquete ${paquete.codigo}`} open={open} onCancel={onClose} onOk={cancelar} confirmLoading={guardando} okText="Cancelar paquete" okButtonProps={{ danger: true }} cancelText="Volver" destroyOnHidden>
      <Typography.Paragraph>Las letras pendientes quedarán canceladas y sus documentos volverán a estar disponibles para otro paquete. No se puede deshacer.</Typography.Paragraph>
      <Input.TextArea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Motivo de la cancelación" maxLength={300} />
    </Modal>
  );
}
