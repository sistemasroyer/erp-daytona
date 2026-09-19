import { VentasAgrupadoVista } from './VentasAgrupadoVista';

export function VentasPorProductoPage() {
  return (
    <VentasAgrupadoVista
      agrupacion="producto"
      titulo="Ventas por Producto"
      columnaEtiqueta="Producto"
      etiquetaTop="Producto más vendido"
    />
  );
}
