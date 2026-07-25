export function toast(mensaje, tipo = 'success', duracion = 3500) {
  const container = document.getElementById('toast-container') || crearContainer();
  const t = document.createElement('div');
  const iconos = { success: 'check-circle', danger: 'x-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  t.className = `toast align-items-center text-bg-${tipo} border-0 show`;
  t.setAttribute('role', 'alert');
  t.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi bi-${iconos[tipo] || 'info-circle'} me-2"></i>${mensaje}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), duracion);
}

function crearContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
  c.style.zIndex = '9999';
  document.body.appendChild(c);
  return c;
}

export function toastError(err) {
  const msg = err?.data?.message || err?.message || 'Error inesperado';
  toast(Array.isArray(msg) ? msg.join(', ') : msg, 'danger');
}
