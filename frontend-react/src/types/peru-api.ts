/** Respuesta del backend al consultar RUC/DNI en SUNAT/RENIEC (vía PeruApiService). */
export interface ConsultaDocumento {
  razon_social?: string;
  nombre_completo?: string;
  direccion?: string;
}
