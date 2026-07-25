/**
 * Shared layout component — injects navbar + sidebar into every page.
 * Usage: call initLayout('page-key') at the start of each page script.
 * The sidebar highlights the active item matching the given key.
 */

const MENU = [
  {
    header: null,
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', href: '/src/pages/dashboard.html' },
    ],
  },
  {
    header: 'Ventas',
    items: [
      { key: 'ventas', label: 'Ventas', icon: 'bi-receipt', href: '/src/pages/ventas/index.html' },
      { key: 'clientes', label: 'Clientes', icon: 'bi-people', href: '/src/pages/clientes/index.html' },
      { key: 'caja', label: 'Caja', icon: 'bi-cash-register', href: '/src/pages/caja/index.html' },
    ],
  },
  {
    header: 'Compras',
    items: [
      { key: 'compras', label: 'Compras', icon: 'bi-cart', href: '/src/pages/compras/index.html' },
      { key: 'ordenes', label: 'Ordenes de Compra', icon: 'bi-file-earmark-text', href: '/src/pages/ordenes-compra/index.html' },
      { key: 'proveedores', label: 'Proveedores', icon: 'bi-truck', href: '/src/pages/proveedores/index.html' },
    ],
  },
  {
    header: 'Inventario',
    items: [
      { key: 'productos', label: 'Productos', icon: 'bi-box-seam', href: '/src/pages/productos/index.html' },
      { key: 'inventario', label: 'Inventario', icon: 'bi-archive', href: '/src/pages/inventario/index.html' },
      { key: 'kardex', label: 'Kardex', icon: 'bi-journal-text', href: '/src/pages/inventario/kardex.html' },
    ],
  },
  {
    header: 'Reportes',
    items: [
      { key: 'reportes', label: 'Reportes', icon: 'bi-bar-chart', href: '/src/pages/reportes/index.html' },
    ],
  },
  {
    header: 'Administracion',
    items: [
      { key: 'rrhh', label: 'RRHH', icon: 'bi-person-badge', href: '/src/pages/rrhh/index.html' },
      { key: 'usuarios', label: 'Usuarios', icon: 'bi-person-gear', href: '/src/pages/usuarios/index.html' },
      { key: 'roles', label: 'Roles', icon: 'bi-shield-check', href: '/src/pages/roles/index.html' },
    ],
  },
  {
    header: 'Configuracion',
    items: [
      { key: 'config-margenes', label: 'Margenes de Precio', icon: 'bi-percent', href: '/src/pages/configuracion/margenes.html' },
      { key: 'config-categorias', label: 'Categorias', icon: 'bi-tags', href: '/src/pages/configuracion/categorias.html' },
      { key: 'config-marcas', label: 'Marcas', icon: 'bi-bookmark', href: '/src/pages/configuracion/marcas.html' },
      { key: 'config-unidades', label: 'Unidades de Medida', icon: 'bi-rulers', href: '/src/pages/configuracion/unidades-medida.html' },
      { key: 'config-almacenes', label: 'Almacenes', icon: 'bi-building', href: '/src/pages/configuracion/almacenes.html' },
      { key: 'config-tipos-cambio', label: 'Tipos de Cambio', icon: 'bi-currency-exchange', href: '/src/pages/configuracion/tipos-cambio.html' },
      { key: 'config-series', label: 'Series / Correlativos', icon: 'bi-list-ol', href: '/src/pages/configuracion/series.html' },
    ],
  },
];

function renderNavItemHTML(item, activeKey) {
  const isActive = item.key === activeKey;
  const cls = isActive
    ? 'nav-link text-white active-nav d-flex align-items-center gap-2 px-3 py-2 rounded'
    : 'nav-link text-white-50 d-flex align-items-center gap-2 px-3 py-2 rounded';
  return '<a href="' + item.href + '" class="' + cls + '"><i class="bi ' + item.icon + '"></i><span>' + item.label + '</span></a>';
}

function buildSidebarHTML(activeKey) {
  let html = '<nav class="p-2 pt-3"><div class="nav flex-column gap-1">';
  MENU.forEach(function(group, idx) {
    if (!group.header) {
      group.items.forEach(function(item) { html += renderNavItemHTML(item, activeKey); });
      return;
    }

    const groupId = 'nav-group-' + idx;
    const hasActive = group.items.some(function(item) { return item.key === activeKey; });
    const stored = localStorage.getItem('sidebar-group-' + idx);
    const expanded = stored !== null ? stored === 'open' : hasActive;

    html +=
      '<button type="button" class="nav-group-toggle btn btn-sm w-100 text-start d-flex justify-content-between align-items-center text-white-50 small px-3 pt-3 pb-1 text-uppercase bg-transparent border-0" data-group="' + groupId + '">' +
      '<span>' + group.header + '</span>' +
      '<i class="bi ' + (expanded ? 'bi-chevron-up' : 'bi-chevron-down') + '"></i>' +
      '</button>' +
      '<div class="nav-group-items d-flex flex-column gap-1' + (expanded ? '' : ' d-none') + '" id="' + groupId + '">';

    group.items.forEach(function(item) { html += renderNavItemHTML(item, activeKey); });

    html += '</div>';
  });
  html += '</div></nav>';
  return html;
}

export function initLayout(activeKey) {
  if (document.getElementById('layout-root')) return;

  const body = document.body;
  const existingChildren = Array.from(body.childNodes);

  // Build navbar
  const navbar = document.createElement('nav');
  navbar.className = 'navbar navbar-expand-lg navbar-dark bg-primary sticky-top shadow-sm';
  navbar.style.zIndex = '1030';
  navbar.innerHTML =
    '<div class="container-fluid">' +
    '<button class="btn btn-primary me-2" id="btn-sidebar-toggle" title="Menu"><i class="bi bi-list fs-5"></i></button>' +
    '<a class="navbar-brand fw-bold" href="/src/pages/dashboard.html"><i class="bi bi-grid-3x3-gap-fill me-2"></i>ERP Daytona</a>' +
    '<div class="ms-auto d-flex align-items-center gap-3">' +
    '<span class="text-white-50 small d-none d-md-inline" id="nav-fecha"></span>' +
    '<div class="dropdown">' +
    '<button class="btn btn-primary dropdown-toggle d-flex align-items-center gap-2" data-bs-toggle="dropdown">' +
    '<i class="bi bi-person-circle"></i><span id="nav-user-name">Usuario</span></button>' +
    '<ul class="dropdown-menu dropdown-menu-end">' +
    '<li><span class="dropdown-item-text text-muted small" id="nav-user-role"></span></li>' +
    '<li><hr class="dropdown-divider"></li>' +
    '<li><a class="dropdown-item" href="#" id="btn-logout"><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesion</a></li>' +
    '</ul></div></div></div>';

  // Build sidebar
  const sidebar = document.createElement('aside');
  sidebar.id = 'sidebar';
  sidebar.className = 'bg-dark text-white flex-shrink-0';
  sidebar.style.cssText = 'width:250px;min-height:100%;transition:width .2s;overflow-y:auto;overflow-x:hidden';
  sidebar.innerHTML = buildSidebarHTML(activeKey);

  // Wrap existing content
  const contentWrapper = document.createElement('main');
  contentWrapper.className = 'flex-grow-1 overflow-auto';
  contentWrapper.style.minWidth = '0';
  existingChildren.forEach(function(node) { contentWrapper.appendChild(node); });

  // Main area
  const mainArea = document.createElement('div');
  mainArea.className = 'd-flex';
  mainArea.style.minHeight = 'calc(100vh - 56px)';
  mainArea.appendChild(sidebar);
  mainArea.appendChild(contentWrapper);

  // Root
  const root = document.createElement('div');
  root.id = 'layout-root';
  root.className = 'd-flex flex-column';
  root.style.minHeight = '100vh';
  root.appendChild(navbar);
  root.appendChild(mainArea);

  body.appendChild(root);
  body.classList.add('bg-body-tertiary');

  // Sidebar collapse state
  const collapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  if (collapsed) sidebar.style.width = '0px';

  document.getElementById('btn-sidebar-toggle').addEventListener('click', function() {
    const isCollapsed = sidebar.style.width === '0px';
    sidebar.style.width = isCollapsed ? '250px' : '0px';
    localStorage.setItem('sidebar-collapsed', isCollapsed ? 'false' : 'true');
  });

  // Group accordion toggles
  sidebar.querySelectorAll('.nav-group-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const target = document.getElementById(btn.dataset.group);
      const icon = btn.querySelector('i');
      const willOpen = target.classList.contains('d-none');
      target.classList.toggle('d-none', !willOpen);
      icon.className = 'bi ' + (willOpen ? 'bi-chevron-up' : 'bi-chevron-down');
      localStorage.setItem(btn.dataset.group.replace('nav-group-', 'sidebar-group-'), willOpen ? 'open' : 'closed');
    });
  });

  // Date
  var fechaEl = document.getElementById('nav-fecha');
  if (fechaEl) {
    fechaEl.textContent = new Date().toLocaleDateString('es-PE', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  // User info
  try {
    var raw = localStorage.getItem('user');
    if (raw) {
      var user = JSON.parse(raw);
      var nameEl = document.getElementById('nav-user-name');
      var roleEl = document.getElementById('nav-user-role');
      if (nameEl) nameEl.textContent = ((user.nombre || '') + ' ' + (user.apellido || '')).trim() || 'Usuario';
      if (roleEl) roleEl.textContent = (user.roles && user.roles[0] && user.roles[0].nombre) || user.email || '';
    }
  } catch (_) {}

  // Logout
  var btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async function(e) {
      e.preventDefault();
      try {
        var token = localStorage.getItem('access_token');
        if (token) {
          await fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
          });
        }
      } catch (_) {}
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/src/pages/login.html';
    });
  }
}
