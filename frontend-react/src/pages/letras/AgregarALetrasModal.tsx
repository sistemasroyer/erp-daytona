import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Col, DatePicker, Form, InputNumber, Modal, Radio, Row, Select, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { letrasCatalogosApi, letrasPaquetesApi } from '@/api/letras';
import { ApiError } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { SelectConCrear } from '@/components/SelectConCrear';
import { formatMoneda } from '@/utils/format';
import type { MonedaLetras } from '@/types/letras';

/** Compra (factura a crédito o NC) que se quiere pasar a letras. */
export interface CompraParaLetras {
  id: string;
  documento: string;
  fecha_vencimiento: string | null;
}

interface Props {
  compras: CompraParaLetras[];
  proveedor: { id: string; razon_social: string; dias_credito: number; letras_pago_unico: boolean };
  moneda: MonedaLetras;
  /** Texto del botón de cancelar: "Más tarde" al salir de registrar una compra. */
  textoCancelar?: string;
  onClose: () => void;
  onListo: (paquete: { id: string; codigo: string }) => void;
}

/**
 * Pasa compras a letras sin salir de Compras: las agrega a un paquete en borrador del mismo proveedor
 * y moneda, o crea un paquete nuevo que nace con ellas. Montarlo solo cuando se va a mostrar.
 */
export function AgregarALetrasModal({ compras, proveedor, moneda, textoCancelar = 'Cancelar', onClose, onListo }: Props) {
  const { message } = App.useApp();
  const { hasPermiso } = useAuth();
  const queryClient = useQueryClient();
  const { data: borradoresData, isLoading } = useQuery({
    queryKey: ['letras-paquetes', 'borradores', proveedor.id, moneda],
    queryFn: () => letrasPaquetesApi.listar({ id_proveedor: proveedor.id, moneda, estado: 'borrador', limit: 50 }),
  });
  const borradores = borradoresData?.data ?? [];
  const { data: bancosData } = useQuery({ queryKey: ['letras-bancos'], queryFn: () => letrasCatalogosApi.listarBancos() });

  // El pago empieza, por defecto, con el primer vencimiento de las facturas.
  const primerVencimiento = compras.map((c) => c.fecha_vencimiento).filter(Boolean).sort()[0];
  const [modo, setModo] = useState<'existente' | 'nuevo' | null>(null);
  const [idPaquete, setIdPaquete] = useState<string | undefined>();
  const [idBanco, setIdBanco] = useState<string | undefined>();
  const [inicio, setInicio] = useState<Dayjs>(primerVencimiento ? dayjs(primerVencimiento) : dayjs());
  const [diasCredito, setDiasCredito] = useState(proveedor.dias_credito || 30);
  const [cuotas, setCuotas] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const modoEfectivo = modo ?? (borradores.length ? 'existente' : 'nuevo');
  const destino = idPaquete ?? borradores[0]?.id;

  const guardar = async () => {
    setGuardando(true);
    try {
      const ids = compras.map((c) => c.id);
      let paquete: { id: string; codigo: string };
      if (modoEfectivo === 'existente') {
        if (!destino) return;
        await letrasPaquetesApi.importarCompras(destino, ids);
        paquete = borradores.find((b) => b.id === destino)!;
        message.success(`${ids.length > 1 ? `${ids.length} documentos agregados` : 'Agregada'} al paquete ${paquete.codigo}`);
      } else {
        const { data } = await letrasPaquetesApi.crear({
          id_proveedor: proveedor.id, moneda, id_banco: idBanco, fecha_inicio_pago: inicio.format('YYYY-MM-DD'),
          dias_credito: diasCredito, numero_cuotas: proveedor.letras_pago_unico ? 1 : cuotas, ids_compras: ids,
        });
        paquete = data;
        message.success(`Paquete ${data.codigo} creado por ${formatMoneda(data.monto_total, moneda)}. Queda en Borrador para enviarlo a aprobación.`);
      }
      for (const k of ['letras-paquetes', 'letras-paquetes-resumen', 'letras-paquete', 'compras', 'compra', 'letras-deuda']) {
        queryClient.invalidateQueries({ queryKey: [k] });
      }
      onListo(paquete);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'No se pudo pasar a letras');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open title="Pasar a letras" onCancel={onClose} onOk={guardar} confirmLoading={guardando} cancelText={textoCancelar}
      okText={modoEfectivo === 'existente' ? 'Agregar al paquete' : 'Crear paquete'} okButtonProps={{ disabled: isLoading || (modoEfectivo === 'existente' && !destino) }}
      width={600} destroyOnHidden
    >
      <Typography.Paragraph>
        <strong>{proveedor.razon_social}</strong> · {moneda === 'PEN' ? 'Soles' : 'Dólares'}
        <br />
        {compras.length === 1 ? `Documento ${compras[0].documento}` : `${compras.length} documentos: ${compras.map((c) => c.documento).join(', ')}`}
      </Typography.Paragraph>

      {borradores.length > 0 && (
        <Radio.Group value={modoEfectivo} onChange={(e) => setModo(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <Radio value="existente">Agregar a un paquete en borrador de este proveedor</Radio>
          <Radio value="nuevo">Crear un paquete nuevo</Radio>
        </Radio.Group>
      )}

      {modoEfectivo === 'existente' ? (
        <Select
          style={{ width: '100%' }} value={destino} onChange={setIdPaquete}
          options={borradores.map((b) => ({ value: b.id, label: `${b.codigo} — ${formatMoneda(b.monto_total, b.moneda)} — inicio ${dayjs(b.fecha_inicio_pago).format('DD/MM/YYYY')}` }))}
        />
      ) : (
        <Form layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Inicio de pago" help="Por defecto, el primer vencimiento">
                <DatePicker value={inicio} onChange={(v) => v && setInicio(v)} format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Días de crédito" help={`Fin: ${inicio.add(diasCredito, 'day').format('DD/MM/YYYY')}`}>
                <InputNumber value={diasCredito} onChange={(v) => setDiasCredito(v ?? 0)} min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Banco">
                <SelectConCrear
                  allowClear placeholder="Seleccione" value={idBanco} onChange={setIdBanco}
                  options={(bancosData?.data || []).filter((b) => b.estado).map((b) => ({ value: b.id, label: b.siglas ? `${b.siglas} — ${b.nombre}` : b.nombre }))}
                  textoNuevo="Nuevo banco (escriba el nombre)" puedeCrear={hasPermiso('letras:editar')}
                  crear={async (nombre) => {
                    const { data } = await letrasCatalogosApi.crearBanco({ nombre });
                    await queryClient.invalidateQueries({ queryKey: ['letras-bancos'] });
                    return data.id;
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cuotas sugeridas" help={proveedor.letras_pago_unico ? 'Proveedor de pago único' : 'Se ajusta al generar'}>
                <InputNumber value={proveedor.letras_pago_unico ? 1 : cuotas} onChange={(v) => setCuotas(v ?? 1)} min={1} max={36} disabled={proveedor.letras_pago_unico} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      )}
      <Alert type="info" showIcon style={{ marginTop: 8 }}
        title={<>El paquete queda en Borrador: luego se envía a aprobación y se generan sus letras desde <Link to="/letras/paquetes" onClick={onClose}>Paquetes de Letras</Link>.</>} />
    </Modal>
  );
}
