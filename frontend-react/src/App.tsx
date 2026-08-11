import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequirePermiso } from '@/auth/RequirePermiso';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientesPage } from '@/pages/clientes/ClientesPage';
import { ProveedoresPage } from '@/pages/proveedores/ProveedoresPage';
import { RrhhPage } from '@/pages/rrhh/RrhhPage';
import { RolesPage } from '@/pages/roles/RolesPage';
import { UsuariosPage } from '@/pages/usuarios/UsuariosPage';
import { CategoriasPage } from '@/pages/configuracion/CategoriasPage';
import { MarcasPage } from '@/pages/configuracion/MarcasPage';
import { UnidadesMedidaPage } from '@/pages/configuracion/UnidadesMedidaPage';
import { AlmacenesPage } from '@/pages/configuracion/AlmacenesPage';
import { SeriesPage } from '@/pages/configuracion/SeriesPage';
import { EmpresaPage } from '@/pages/configuracion/EmpresaPage';
import { MargenesPage } from '@/pages/configuracion/MargenesPage';
import { TiposCambioPage } from '@/pages/configuracion/TiposCambioPage';
import { AjustesInventarioPage } from '@/pages/inventario/AjustesInventarioPage';
import { ProductosPage } from '@/pages/productos/ProductosPage';
import { InventarioPage } from '@/pages/inventario/InventarioPage';
import { KardexPage } from '@/pages/inventario/KardexPage';
import { AjusteNuevoPage } from '@/pages/inventario/AjusteNuevoPage';
import { OrdenesCompraPage } from '@/pages/ordenes-compra/OrdenesCompraPage';
import { ReportesPage } from '@/pages/reportes/ReportesPage';
import { CajaPage } from '@/pages/caja/CajaPage';
import { CajaHistorialPage } from '@/pages/caja/CajaHistorialPage';
import { ComprasPage } from '@/pages/compras/ComprasPage';
import { NotaCreditoCompraPage } from '@/pages/compras/NotaCreditoCompraPage';
import { NuevaCompraPage } from '@/pages/compras/NuevaCompraPage';
import { FacturacionEnviarPage } from '@/pages/facturacion/FacturacionEnviarPage';
import { GastosPage } from '@/pages/gastos/GastosPage';
import { VentasPage } from '@/pages/ventas/VentasPage';
import { NuevaVentaPage } from '@/pages/ventas/NuevaVentaPage';
import { ImprimirPage } from '@/pages/ventas/ImprimirPage';
import { NotaCreditoPage } from '@/pages/ventas/NotaCreditoPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <ConfigProvider locale={esES} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="/ventas/imprimir" element={<ImprimirPage />} />

                  <Route element={<AppLayout />}>
                    <Route path="/" element={<DashboardPage />} />

                    <Route element={<RequirePermiso perm="clientes:ver" />}>
                      <Route path="/clientes" element={<ClientesPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="proveedores:ver" />}>
                      <Route path="/proveedores" element={<ProveedoresPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="rrhh:ver" />}>
                      <Route path="/rrhh" element={<RrhhPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="roles:ver" />}>
                      <Route path="/roles" element={<RolesPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="usuarios:ver" />}>
                      <Route path="/usuarios" element={<UsuariosPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="productos:editar" />}>
                      <Route path="/configuracion/categorias" element={<CategoriasPage />} />
                      <Route path="/configuracion/marcas" element={<MarcasPage />} />
                      <Route path="/configuracion/unidades-medida" element={<UnidadesMedidaPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="inventario:editar" />}>
                      <Route path="/configuracion/almacenes" element={<AlmacenesPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="configuracion:ver" />}>
                      <Route path="/configuracion/series" element={<SeriesPage />} />
                      <Route path="/configuracion/empresa" element={<EmpresaPage />} />
                      <Route path="/configuracion/margenes" element={<MargenesPage />} />
                      <Route path="/configuracion/tipos-cambio" element={<TiposCambioPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="inventario:ver" />}>
                      <Route path="/inventario/ajustes" element={<AjustesInventarioPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="productos:ver" />}>
                      <Route path="/productos" element={<ProductosPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="inventario:ver" />}>
                      <Route path="/inventario" element={<InventarioPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="reportes:ver" />}>
                      <Route path="/inventario/kardex" element={<KardexPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="inventario:editar" />}>
                      <Route path="/inventario/ajustes/nuevo" element={<AjusteNuevoPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="ordenes_compra:ver" />}>
                      <Route path="/ordenes-compra" element={<OrdenesCompraPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="reportes:ver" />}>
                      <Route path="/reportes" element={<ReportesPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="caja:ver" />}>
                      <Route path="/caja" element={<CajaPage />} />
                      <Route path="/caja/historial" element={<CajaHistorialPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="compras:ver" />}>
                      <Route path="/compras" element={<ComprasPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="compras:anular" />}>
                      <Route path="/compras/nueva-nota-credito" element={<NotaCreditoCompraPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="compras:crear" />}>
                      <Route path="/compras/nueva" element={<NuevaCompraPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="facturacion:ver" />}>
                      <Route path="/facturacion/enviar" element={<FacturacionEnviarPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="gastos:ver" />}>
                      <Route path="/gastos" element={<GastosPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="ventas:ver" />}>
                      <Route path="/ventas" element={<VentasPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="ventas:crear" />}>
                      <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
                    </Route>

                    <Route element={<RequirePermiso perm="ventas:anular" />}>
                      <Route path="/ventas/nueva-nota-credito" element={<NotaCreditoPage />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
