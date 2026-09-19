import { VentasAgrupadoVista } from './VentasAgrupadoVista';

export function VentasPorPuntoVentaPage() {
  return (
    <VentasAgrupadoVista
      agrupacion="punto_venta"
      titulo="Ventas por Punto de Venta"
      columnaEtiqueta="Punto de Venta"
      etiquetaTop="Tienda líder"
      ocultarFiltroPuntoVenta
    />
  );
}
