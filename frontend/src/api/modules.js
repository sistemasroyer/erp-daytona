import { api } from './client.js';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  perfil: () => api.get('/auth/perfil'),
};

export const productosApi = {
  listar: (p) => api.get('/productos', p),
  obtener: (id) => api.get(`/productos/${id}`),
  crear: (d) => api.post('/productos', d),
  actualizar: (id, d) => api.patch(`/productos/${id}`, d),
  eliminar: (id) => api.delete(`/productos/${id}`),
  alertasStock: () => api.get('/productos/alertas/stock'),
};

export const categoriasApi = {
  listar: () => api.get('/categorias'),
  crear: (d) => api.post('/categorias', d),
  actualizar: (id, d) => api.patch(`/categorias/${id}`, d),
  eliminar: (id) => api.delete(`/categorias/${id}`),
};

export const subcategoriasApi = {
  porCategoria: (idCategoria) => api.get(`/categorias/${idCategoria}/subcategorias`),
  crear: (d) => api.post('/categorias/subcategorias', d),
  actualizar: (id, d) => api.patch(`/categorias/subcategorias/${id}`, d),
  eliminar: (id) => api.delete(`/categorias/subcategorias/${id}`),
};

export const marcasApi = {
  listar: () => api.get('/marcas'),
  crear: (d) => api.post('/marcas', d),
  actualizar: (id, d) => api.patch(`/marcas/${id}`, d),
  eliminar: (id) => api.delete(`/marcas/${id}`),
};

export const unidadesApi = {
  listar: () => api.get('/unidades-medida'),
  crear: (d) => api.post('/unidades-medida', d),
  actualizar: (id, d) => api.patch(`/unidades-medida/${id}`, d),
};

export const almacenesApi = {
  listar: () => api.get('/almacenes'),
  crear: (d) => api.post('/almacenes', d),
  actualizar: (id, d) => api.patch(`/almacenes/${id}`, d),
};

export const clientesApi = {
  listar: (p) => api.get('/clientes', p),
  obtener: (id) => api.get(`/clientes/${id}`),
  crear: (d) => api.post('/clientes', d),
  actualizar: (id, d) => api.patch(`/clientes/${id}`, d),
  eliminar: (id) => api.delete(`/clientes/${id}`),
  consultarDocumento: (tipo, numero) => api.get(`/clientes/consultar/${tipo}/${numero}`),
};

export const proveedoresApi = {
  listar: (p) => api.get('/proveedores', p),
  obtener: (id) => api.get(`/proveedores/${id}`),
  crear: (d) => api.post('/proveedores', d),
  actualizar: (id, d) => api.patch(`/proveedores/${id}`, d),
  eliminar: (id) => api.delete(`/proveedores/${id}`),
  consultarRuc: (ruc) => api.get(`/proveedores/consultar-ruc/${ruc}`),
};

export const inventarioApi = {
  listar: (p) => api.get('/inventario', p),
  transferir: (d) => api.post('/inventario/transferencia', d),
  stockProducto: (id, almacen) => api.get(`/inventario/producto/${id}`, { id_almacen: almacen }),
  crearAjuste: (d) => api.post('/inventario/ajustes', d),
  listarAjustes: (p) => api.get('/inventario/ajustes', p),
  obtenerAjuste: (id) => api.get(`/inventario/ajustes/${id}`),
};

export const metodosPagoApi = {
  listar: () => api.get('/metodos-pago'),
};

export const empresaApi = {
  obtener: () => api.get('/empresa'),
  actualizar: (d) => api.patch('/empresa', d),
};

export const ventasApi = {
  listar: (p) => api.get('/ventas', p),
  obtener: (id) => api.get(`/ventas/${id}`),
  crear: (d) => api.post('/ventas', d),
  anular: (id, motivo) => api.patch(`/ventas/${id}/anular`, { motivo }),
  canjear: (id, d) => api.post(`/ventas/${id}/canjear`, d),
  reenviarSunat: (id) => api.post(`/ventas/${id}/reenviar-sunat`),
  crearNotaCredito: (id, d) => api.post(`/ventas/${id}/nota-credito`, d),
};

export const comprasApi = {
  listar: (p) => api.get('/compras', p),
  obtener: (id) => api.get(`/compras/${id}`),
  crear: (d) => api.post('/compras', d),
  anular: (id, motivo) => api.patch(`/compras/${id}/anular`, { motivo }),
  pagarFlete: (id, d) => api.patch(`/compras/${id}/flete/pagar`, d),
  importarXml: (xml) => api.post('/compras/importar-xml', { xml }),
  crearNotaCredito: (id, d) => api.post(`/compras/${id}/nota-credito`, d),
};

export const ordenesApi = {
  listar: (p) => api.get('/ordenes-compra', p),
  obtener: (id) => api.get(`/ordenes-compra/${id}`),
  crear: (d) => api.post('/ordenes-compra', d),
  aprobar: (id) => api.patch(`/ordenes-compra/${id}/aprobar`),
  convertir: (id, d) => api.post(`/ordenes-compra/${id}/convertir`, d),
  anular: (id) => api.patch(`/ordenes-compra/${id}/anular`),
};

export const cajaApi = {
  cajas: () => api.get('/caja/cajas'),
  aperturaActiva: (idCaja) => api.get(`/caja/cajas/${idCaja}/apertura-activa`),
  aperturas: (idCaja, p) => api.get(`/caja/cajas/${idCaja}/aperturas`, p),
  abrir: (d) => api.post('/caja/abrir', d),
  cerrar: (idApertura, d) => api.patch(`/caja/aperturas/${idApertura}/cerrar`, d),
  resumen: (idApertura) => api.get(`/caja/aperturas/${idApertura}/resumen`),
  movimiento: (idApertura, d) => api.post(`/caja/aperturas/${idApertura}/movimientos`, d),
  // No existe un endpoint único "mi sesión activa": se listan las cajas visibles para el
  // usuario (ya filtradas por punto de venta en el backend) y se busca cuál tiene apertura abierta.
  async miAperturaActiva() {
    const resCajas = await this.cajas();
    const cajas = Array.isArray(resCajas.data) ? resCajas.data : resCajas.data?.data || [];
    for (const c of cajas) {
      try {
        const res = await this.aperturaActiva(c.id);
        if (res.data) return res.data;
      } catch (_) { /* sin acceso o sin apertura para esta caja */ }
    }
    return null;
  },
};

export const reportesApi = {
  ventas: (f) => api.get('/reportes/ventas', f),
  compras: (f) => api.get('/reportes/compras', f),
  inventario: (f) => api.get('/reportes/inventario', f),
  kardex: (id, f) => api.get(`/reportes/kardex/${id}`, f),
  auditoria: (f) => api.get('/reportes/auditoria', f),
  exportarVentasExcel: async (f) => {
    const blob = await api.getBlob('/reportes/ventas/export/excel', f);
    descargarBlob(blob, `ventas_${hoy()}.xlsx`);
  },
  exportarInventarioExcel: async (f) => {
    const blob = await api.getBlob('/reportes/inventario/export/excel', f);
    descargarBlob(blob, `inventario_${hoy()}.xlsx`);
  },
};

export const rrhhApi = {
  listar: (p) => api.get('/rrhh', p),
  obtener: (id) => api.get(`/rrhh/${id}`),
  crear: (d) => api.post('/rrhh', d),
  actualizar: (id, d) => api.patch(`/rrhh/${id}`, d),
  cesar: (id, fecha) => api.patch(`/rrhh/${id}/cesar`, { fecha_cese: fecha }),
};

export const usuariosApi = {
  listar: (p) => api.get('/usuarios', p),
  obtener: (id) => api.get(`/usuarios/${id}`),
  crear: (d) => api.post('/usuarios', d),
  actualizar: (id, d) => api.patch(`/usuarios/${id}`, d),
  // El backend reemplaza roles/password como parte del PATCH general (no hay rutas dedicadas).
  cambiarPassword: (id, password) => api.patch(`/usuarios/${id}`, { password }),
  actualizarRoles: (id, idsRoles) => api.patch(`/usuarios/${id}`, { roles: idsRoles }),
};

export const rolesApi = {
  listar: () => api.get('/roles'),
  obtener: (id) => api.get(`/roles/${id}`),
  crear: (d) => api.post('/roles', d),
  actualizar: (id, d) => api.patch(`/roles/${id}`, d),
  // El backend reemplaza los permisos como parte del PATCH general (no hay ruta dedicada).
  asignarPermisos: (id, ids) => api.patch(`/roles/${id}`, { permisos: ids }),
};

export const permisosApi = {
  listar: () => api.get('/permisos'),
};

export const configMargenesApi = {
  listar: () => api.get('/config/margenes'),
  actualizar: (numero, d) => api.patch(`/config/margenes/${numero}`, d),
};

export const tiposCambioApi = {
  listar: (limit) => api.get('/tipos-cambio', limit ? { limit } : undefined),
  hoy: () => api.get('/tipos-cambio/hoy'),
  crear: (d) => api.post('/tipos-cambio', d),
  actualizar: (id, d) => api.patch(`/tipos-cambio/${id}`, d),
  eliminar: (id) => api.delete(`/tipos-cambio/${id}`),
};

export const seriesApi = {
  listar: (idPv) => api.get('/series-documento', idPv ? { id_punto_venta: idPv } : undefined),
  puntosVenta: () => api.get('/series-documento/puntos-venta'),
  crear: (d) => api.post('/series-documento', d),
  actualizar: (id, d) => api.patch(`/series-documento/${id}`, d),
  resetCorrelativo: (id, correlativo) => api.patch(`/series-documento/${id}/reset-correlativo`, { correlativo }),
  eliminar: (id) => api.delete(`/series-documento/${id}`),
};

// Helpers
function hoy() {
  return new Date().toISOString().split('T')[0];
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
