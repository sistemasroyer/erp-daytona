import { VentasAgrupadoVista } from './VentasAgrupadoVista';

export function VentasPorMarcaPage() {
  return (
    <VentasAgrupadoVista
      agrupacion="marca"
      titulo="Ventas por Marca"
      columnaEtiqueta="Marca"
      etiquetaTop="Marca líder"
    />
  );
}
