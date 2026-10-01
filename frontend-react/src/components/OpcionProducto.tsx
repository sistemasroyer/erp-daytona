import { Button, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { formatMoneda } from '@/utils/format';
import type { Producto } from '@/types/producto';

interface Props {
  producto: Producto;
  /** Muestra el botón "+" a la derecha (pantallas donde elegir = agregar a una lista). */
  agregar?: boolean;
  /** Muestra el último costo de compra (sin IGV), útil en Compras/Órdenes. */
  mostrarCosto?: boolean;
  /** false en la Toma de Inventario: el conteo es a ciegas y no debe sugerir el stock del sistema. */
  mostrarStock?: boolean;
}

/** Fila de resultado para los buscadores de productos (`Autocomplete<Producto>`): nombre completo
 * (sin recortar, en varias líneas si hace falta), código, marca, stock y, opcional, el costo y un
 * botón "+". Hacer clic en cualquier parte de la fila también la elige. */
export function OpcionProducto({ producto: p, agregar = false, mostrarCosto = false, mostrarStock = true }: Props) {
  const stock = Number(p.stock_actual || 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, marginRight: 8 }}>{p.codigo}</Typography.Text>
          <span style={{ fontWeight: 600 }}>{p.nombre}</span>
        </div>
        <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 2 }}>
          {p.marca && <span>{p.marca.nombre}</span>}
          {mostrarStock && <span style={{ color: stock > 0 ? '#389e0d' : '#cf1322' }}>Stock: {stock.toFixed(0)}{p.unidad_medida ? ` ${p.unidad_medida.simbolo}` : ''}</span>}
          {p.ubicacion && <span>Ubicación: {p.ubicacion}</span>}
          {mostrarCosto && Number(p.precio_compra_sin_igv) > 0 && <span>Último costo s/IGV: {formatMoneda(p.precio_compra_sin_igv)}</span>}
        </div>
      </div>
      {agregar && (
        // Sin stopPropagation: el clic sube a la fila, que es la que agrega (una sola vez).
        <Button type="primary" shape="circle" size="small" icon={<PlusOutlined />} title="Agregar" aria-label={`Agregar ${p.nombre}`} />
      )}
    </div>
  );
}
