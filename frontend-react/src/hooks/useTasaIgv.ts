import { useQuery } from '@tanstack/react-query';
import { empresaApi } from '@/api/empresa';

/** Porcentaje de IGV por defecto (Perú) mientras carga la configuración de la empresa. */
export const PORCENTAJE_IGV_DEFAULT = 18;

/** Tasa de IGV vigente configurada en Configuración → Empresa. Devuelve el
 * porcentaje (ej. 18) y el factor para precios con IGV (ej. 1.18). Solo para
 * calcular documentos NUEVOS: un documento ya emitido guarda su propio
 * `porcentaje_igv` y debe mostrarse con ese. */
export function useTasaIgv() {
  const { data } = useQuery({ queryKey: ['empresa'], queryFn: () => empresaApi.obtener(), staleTime: 5 * 60 * 1000 });
  const porcentaje = data ? Number(data.data.porcentaje_igv) : PORCENTAJE_IGV_DEFAULT;
  return { porcentaje, factor: 1 + porcentaje / 100 };
}

/** "18%" / "10.5%" — sin decimales innecesarios. */
export function formatPorcentajeIgv(porcentaje: number | string) {
  return `${Number(porcentaje)}%`;
}
