export function renderPaginacion(container, paginacion, onCambio) {
  const { page, total, limit } = paginacion;
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '<nav><ul class="pagination pagination-sm mb-0">';
  html += `<li class="page-item ${page === 1 ? 'disabled' : ''}">
    <a class="page-link" data-page="${page - 1}" href="#">«</a></li>`;

  const inicio = Math.max(1, page - 2);
  const fin = Math.min(totalPages, page + 2);
  for (let i = inicio; i <= fin; i++) {
    html += `<li class="page-item ${i === page ? 'active' : ''}">
      <a class="page-link" data-page="${i}" href="#">${i}</a></li>`;
  }

  html += `<li class="page-item ${page === totalPages ? 'disabled' : ''}">
    <a class="page-link" data-page="${page + 1}" href="#">»</a></li>`;
  html += '</ul></nav>';

  container.innerHTML = html;
  container.querySelectorAll('[data-page]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const p = parseInt(el.dataset.page);
      if (p >= 1 && p <= totalPages) onCambio(p);
    });
  });
}

export function formatMoneda(valor, moneda = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(valor ?? 0);
}

export function formatFecha(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatFechaHora(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function badgeEstado(estado, mapa = {}) {
  const defaults = {
    true: '<span class="badge bg-success">Activo</span>',
    false: '<span class="badge bg-secondary">Inactivo</span>',
    vigente: '<span class="badge bg-success">Vigente</span>',
    anulada: '<span class="badge bg-danger">Anulada</span>',
    canjeada: '<span class="badge bg-info text-dark">Canjeada</span>',
    no_aplica: '<span class="badge bg-light text-dark border">No aplica</span>',
    pendiente: '<span class="badge bg-warning text-dark">Pendiente</span>',
    aceptado: '<span class="badge bg-success">Aceptado</span>',
    rechazado: '<span class="badge bg-danger">Rechazado</span>',
    enviado: '<span class="badge bg-info">Enviado</span>',
    borrador: '<span class="badge bg-secondary">Borrador</span>',
    aprobado: '<span class="badge bg-primary">Aprobado</span>',
    convertido: '<span class="badge bg-success">Convertido</span>',
    abierta: '<span class="badge bg-success">Abierta</span>',
    cerrada: '<span class="badge bg-secondary">Cerrada</span>',
  };
  const lookup = { ...defaults, ...mapa };
  return lookup[String(estado)] || `<span class="badge bg-secondary">${estado}</span>`;
}
