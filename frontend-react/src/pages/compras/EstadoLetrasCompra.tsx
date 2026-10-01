import { Link } from 'react-router-dom';
import { Tag, Typography } from 'antd';
import { ESTADO_PAQUETE_LABEL } from '@/types/letras';
import type { Compra } from '@/types/compra';

/** Dónde está una compra en Letras: su paquete (con avance de pagos), "Sin paquete" si es a crédito y falta pasarla, o "-". */
export function EstadoLetrasCompra({ compra: c }: { compra: Compra }) {
  const p = c.letras;
  if (p) {
    return (
      <span onClick={(e) => e.stopPropagation()}>
        <Link to={`/letras/paquetes/${p.id}`}>{p.codigo}</Link>
        <div style={{ fontSize: 12 }}>
          {p.estado === 'completado'
            ? <Tag color="green" style={{ margin: 0 }}>Pagada</Tag>
            : p.letras_total
              ? <Typography.Text type="secondary">{p.letras_pagadas}/{p.letras_total} letras pagadas</Typography.Text>
              : <Typography.Text type="secondary">{ESTADO_PAQUETE_LABEL[p.estado]}</Typography.Text>}
        </div>
      </span>
    );
  }
  if (c.condicion_pago === 'credito' && c.estado === 'registrada' && c.tipo_documento !== 'nota_credito') {
    return <Tag color="orange">Sin paquete</Tag>;
  }
  return <Typography.Text type="secondary">-</Typography.Text>;
}
