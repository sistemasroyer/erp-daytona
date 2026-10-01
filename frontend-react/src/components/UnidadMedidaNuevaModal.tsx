import { useEffect, useState } from 'react';
import { App, AutoComplete, Form, Input, Modal } from 'antd';
import { unidadesMedidaApi } from '@/api/unidades-medida';
import { ApiError } from '@/api/types';
import type { UnidadMedida } from '@/types/unidad-medida';

/** Códigos frecuentes del catálogo SUNAT N° 6 (unidades de medida comercial) para repuestos. */
const CODIGOS_SUNAT: { codigo: string; nombre: string }[] = [
  { codigo: 'NIU', nombre: 'Unidad' }, { codigo: 'SET', nombre: 'Juego' }, { codigo: 'PR', nombre: 'Par' },
  { codigo: 'KT', nombre: 'Kit' }, { codigo: 'BX', nombre: 'Caja' }, { codigo: 'PK', nombre: 'Paquete' },
  { codigo: 'DZN', nombre: 'Docena' }, { codigo: 'BG', nombre: 'Bolsa' }, { codigo: 'RO', nombre: 'Rollo' },
  { codigo: 'KGM', nombre: 'Kilogramo' }, { codigo: 'GRM', nombre: 'Gramo' }, { codigo: 'LTR', nombre: 'Litro' },
  { codigo: 'MLT', nombre: 'Mililitro' }, { codigo: 'GLL', nombre: 'Galón' }, { codigo: 'MTR', nombre: 'Metro' },
  { codigo: 'CMT', nombre: 'Centímetro' }, { codigo: 'MTK', nombre: 'Metro cuadrado' }, { codigo: 'BO', nombre: 'Botella' },
  { codigo: 'CA', nombre: 'Lata' }, { codigo: 'BJ', nombre: 'Balde' }, { codigo: 'ZZ', nombre: 'Unidad (servicios)' },
];

interface Props {
  open: boolean;
  /** Códigos SUNAT ya usados por otras unidades (el código es único): no se ofrecen. */
  codigosUsados?: string[];
  /** Lo que el usuario escribió en el buscador, para pre-rellenar la descripción. */
  descripcionInicial?: string;
  onClose: () => void;
  onCreada: (unidad: UnidadMedida) => void;
}

/** Alta rápida de unidad de medida desde otro formulario (ej. Nuevo Producto). Mismos campos
 * que Configuración → Unidades de medida. */
export function UnidadMedidaNuevaModal({ open, codigosUsados = [], descripcionInicial, onClose, onCreada }: Props) {
  const { message } = App.useApp();
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [simbolo, setSimbolo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCodigo('');
    setDescripcion(descripcionInicial || '');
    setSimbolo('');
  }, [open, descripcionInicial]);

  const guardar = async () => {
    if (!codigo.trim() || !descripcion.trim() || !simbolo.trim()) {
      message.warning('Complete código SUNAT, descripción y símbolo');
      return;
    }
    setSaving(true);
    try {
      const { data } = await unidadesMedidaApi.crear({
        codigo_sunat: codigo.trim().toUpperCase(), descripcion: descripcion.trim(), simbolo: simbolo.trim(),
      });
      message.success('Unidad de medida creada y seleccionada');
      onCreada(data);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al crear la unidad de medida');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nueva unidad de medida" open={open} onCancel={onClose} onOk={guardar} confirmLoading={saving} okText="Crear" cancelText="Cancelar" destroyOnHidden>
      <Form layout="vertical">
        <Form.Item label="Descripción" required>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Juego, Par, Caja" autoFocus />
        </Form.Item>
        <Form.Item label="Símbolo" required>
          <Input value={simbolo} onChange={(e) => setSimbolo(e.target.value)} placeholder="Ej: JGO, PAR, CJA" />
        </Form.Item>
        <Form.Item label="Código SUNAT" required help="Catálogo SUNAT (tabla 6). Cada código se usa en una sola unidad; elija de la lista o escriba otro.">
          <AutoComplete
            value={codigo}
            onChange={setCodigo}
            placeholder="Ej: SET (juego), PR (par), KT (kit)"
            options={CODIGOS_SUNAT
              .filter((c) => !codigosUsados.includes(c.codigo))
              .map((c) => ({ value: c.codigo, label: `${c.codigo} — ${c.nombre}` }))}
            showSearch={{ filterOption: (input, opcion) => String(opcion?.label ?? '').toUpperCase().includes(input.toUpperCase()) }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
