export function confirmar(mensaje, titulo = 'Confirmar acción') {
  return new Promise((resolve) => {
    let modal = document.getElementById('modal-confirmar');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-confirmar';
      modal.className = 'modal fade';
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-confirmar-titulo"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="modal-confirmar-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-danger" id="modal-confirmar-ok">Confirmar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    document.getElementById('modal-confirmar-titulo').textContent = titulo;
    document.getElementById('modal-confirmar-body').textContent = mensaje;

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    const btnOk = document.getElementById('modal-confirmar-ok');
    const handler = () => {
      bsModal.hide();
      btnOk.removeEventListener('click', handler);
      resolve(true);
    };
    btnOk.addEventListener('click', handler);

    modal.addEventListener('hidden.bs.modal', () => {
      btnOk.removeEventListener('click', handler);
      resolve(false);
    }, { once: true });
  });
}
