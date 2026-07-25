import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'src/pages/login.html',
        dashboard: 'src/pages/dashboard.html',
        productos: 'src/pages/productos/index.html',
        clientes: 'src/pages/clientes/index.html',
        proveedores: 'src/pages/proveedores/index.html',
        ventas: 'src/pages/ventas/index.html',
        'ventas-nueva': 'src/pages/ventas/nueva.html',
        compras: 'src/pages/compras/index.html',
        'compras-nueva': 'src/pages/compras/nueva.html',
        ordenes: 'src/pages/ordenes-compra/index.html',
        inventario: 'src/pages/inventario/index.html',
        kardex: 'src/pages/inventario/kardex.html',
        caja: 'src/pages/caja/index.html',
        reportes: 'src/pages/reportes/index.html',
        rrhh: 'src/pages/rrhh/index.html',
        usuarios: 'src/pages/usuarios/index.html',
        roles: 'src/pages/roles/index.html',
        'config-margenes': 'src/pages/configuracion/margenes.html',
        'config-categorias': 'src/pages/configuracion/categorias.html',
        'config-marcas': 'src/pages/configuracion/marcas.html',
        'config-unidades': 'src/pages/configuracion/unidades-medida.html',
        'config-almacenes': 'src/pages/configuracion/almacenes.html',
        'config-tipos-cambio': 'src/pages/configuracion/tipos-cambio.html',
        'config-series': 'src/pages/configuracion/series.html',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
