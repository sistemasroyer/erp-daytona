export interface MenuItemDef {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** Permiso "modulo:accion" requerido para ver el ítem (null = visible para cualquier
   * usuario autenticado). Debe coincidir con el permiso que protege el endpoint
   * principal de esa pantalla en el backend (@Permisos() de cada módulo). */
  perm: string | null;
}

export interface MenuGroupDef {
  header: string | null;
  items: MenuItemDef[];
}

// Ported 1:1 desde frontend/src/components/layout.js, con los mismos permisos
// (incluyendo el endurecimiento de Categorias/Marcas/Unidades -> productos:editar
// y Almacenes -> inventario:editar aplicado en esa app).
export const MENU: MenuGroupDef[] = [
  {
    header: null,
    items: [{ key: 'dashboard', label: 'Dashboard', icon: 'DashboardOutlined', href: '/', perm: null }],
  },
  {
    header: 'Ventas',
    items: [
      { key: 'ventas-nueva', label: 'Nueva Venta', icon: 'FileAddOutlined', href: '/ventas/nueva', perm: 'ventas:crear' },
      { key: 'ventas-listado', label: 'Listado de Ventas', icon: 'UnorderedListOutlined', href: '/ventas', perm: 'ventas:ver' },
      { key: 'nueva-nota-credito', label: 'Nueva Nota de Crédito', icon: 'FileExcelOutlined', href: '/ventas/nueva-nota-credito', perm: 'ventas:anular' },
      { key: 'clientes', label: 'Clientes', icon: 'TeamOutlined', href: '/clientes', perm: 'clientes:ver' },
      { key: 'caja', label: 'Caja', icon: 'WalletOutlined', href: '/caja', perm: 'caja:ver' },
      { key: 'caja-historial', label: 'Historial de Caja', icon: 'HistoryOutlined', href: '/caja/historial', perm: 'caja:ver' },
    ],
  },
  {
    header: 'Facturación Electrónica',
    items: [
      { key: 'facturacion-enviar', label: 'Enviar a SUNAT', icon: 'CloudUploadOutlined', href: '/facturacion/enviar', perm: 'facturacion:ver' },
    ],
  },
  {
    header: 'Compras',
    items: [
      { key: 'compras', label: 'Compras', icon: 'ShoppingCartOutlined', href: '/compras', perm: 'compras:ver' },
      { key: 'nueva-nota-credito-compra', label: 'Nota de Crédito (Compra)', icon: 'FileExcelOutlined', href: '/compras/nueva-nota-credito', perm: 'compras:anular' },
      { key: 'ordenes', label: 'Ordenes de Compra', icon: 'FileTextOutlined', href: '/ordenes-compra', perm: 'ordenes_compra:ver' },
      { key: 'proveedores', label: 'Proveedores', icon: 'CarOutlined', href: '/proveedores', perm: 'proveedores:ver' },
    ],
  },
  {
    header: 'Gastos',
    items: [
      { key: 'gastos', label: 'Gastos', icon: 'DollarOutlined', href: '/gastos', perm: 'gastos:ver' },
    ],
  },
  {
    header: 'Inventario',
    items: [
      { key: 'productos', label: 'Productos', icon: 'InboxOutlined', href: '/productos', perm: 'productos:ver' },
      { key: 'inventario', label: 'Inventario', icon: 'DatabaseOutlined', href: '/inventario', perm: 'inventario:ver' },
      { key: 'kardex', label: 'Kardex', icon: 'BookOutlined', href: '/inventario/kardex', perm: 'reportes:ver' },
    ],
  },
  {
    header: 'Reportes',
    items: [{ key: 'reportes', label: 'Reportes', icon: 'BarChartOutlined', href: '/reportes', perm: 'reportes:ver' }],
  },
  {
    header: 'Administracion',
    items: [
      { key: 'rrhh', label: 'RRHH', icon: 'IdcardOutlined', href: '/rrhh', perm: 'rrhh:ver' },
      { key: 'usuarios', label: 'Usuarios', icon: 'UserSwitchOutlined', href: '/usuarios', perm: 'usuarios:ver' },
      { key: 'roles', label: 'Roles', icon: 'SafetyCertificateOutlined', href: '/roles', perm: 'roles:ver' },
    ],
  },
  {
    header: 'Configuracion',
    items: [
      { key: 'config-margenes', label: 'Margenes de Precio', icon: 'PercentageOutlined', href: '/configuracion/margenes', perm: 'configuracion:ver' },
      { key: 'config-categorias', label: 'Categorias', icon: 'TagsOutlined', href: '/configuracion/categorias', perm: 'productos:editar' },
      { key: 'config-marcas', label: 'Marcas', icon: 'BookOutlined', href: '/configuracion/marcas', perm: 'productos:editar' },
      { key: 'config-unidades', label: 'Unidades de Medida', icon: 'ColumnWidthOutlined', href: '/configuracion/unidades-medida', perm: 'productos:editar' },
      { key: 'config-almacenes', label: 'Almacenes', icon: 'HomeOutlined', href: '/configuracion/almacenes', perm: 'inventario:editar' },
      { key: 'config-tipos-cambio', label: 'Tipos de Cambio', icon: 'DollarOutlined', href: '/configuracion/tipos-cambio', perm: 'configuracion:ver' },
      { key: 'config-series', label: 'Series / Correlativos', icon: 'OrderedListOutlined', href: '/configuracion/series', perm: 'configuracion:ver' },
      { key: 'config-empresa', label: 'Datos de la Empresa', icon: 'ShopOutlined', href: '/configuracion/empresa', perm: 'configuracion:ver' },
    ],
  },
];
