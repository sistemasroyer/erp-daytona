# MARTSOFT

ERP/facturador (producto distribuible, blanco-etiquetable) usado actualmente por un negocio de repuestos de auto en Perú (2 tiendas). Monolito modular: backend NestJS+Prisma+PostgreSQL, frontend React SPA. Single-tenant por instalación (una empresa, `tbl_empresas` tiene una sola fila) — el nombre de la marca del software es "MARTSOFT" (login, título del navegador, docs de la API); el nombre de la empresa/tenant configurado en `tbl_empresas` es lo que se muestra en el sidebar ya logueado y en los comprobantes impresos.

## Estructura del repo

```
backend/          NestJS + Prisma + PostgreSQL — API REST, puerto 3000
frontend-react/   React 19 + TS + Vite + Ant Design + TanStack Query — puerto 5174
docs/             PDF de referencia de la API de NubeFact (facturación electrónica)
```

No hay otro frontend. Hubo uno viejo en vanilla JS (`frontend/`, puerto 5173) que fue reescrito por completo a React y eliminado — si ves referencias a `.html` o a `/src/pages/algo.html` en historial de git, es de esa app ya retirada, no la repliques.

## Cómo correr todo

```bash
# Backend (puerto 3000, prefijo /api/v1)
cd backend && npm run start:dev

# Frontend (puerto 5174)
cd frontend-react && npm run dev
```

Requiere PostgreSQL local corriendo y `backend/.env` configurado (copiar de `.env.example`). Seed: `cd backend && npm run prisma:seed` (idempotente, seguro re-ejecutar).

**Credenciales de prueba (seed):**
- `admin@daytona.pe` / `Admin123!` — rol Administrador (`es_superadmin: true`, bypassa todos los permisos)
- `tienda1@daytona.pe` / `Tienda1_2026!` — rol Vendedor, Tienda 1
- `tienda2@daytona.pe` / `Tienda2_2026!` — rol Vendedor, Tienda 2

`SUNAT_MODE=mock` y `PERU_API_PROVIDER=mock` en `.env` — sin credenciales reales, la facturación electrónica y las consultas RUC/DNI están simuladas.

## Backend — convenciones (leer antes de tocar cualquier módulo)

- **Módulos** en `backend/src/modules/<nombre>/`: `<nombre>.module.ts`, `.controller.ts`, `.service.ts`, `dto/*.ts`. Sin capa de repositorio salvo `inventario` (tiene `inventario.repository.ts` porque varios módulos necesitan registrar movimientos de stock dentro de su propia transacción).
- **Prisma**: `backend/prisma/schema.prisma`. Modelos con prefijo `tbl_`. Campos de auditoría estándar en casi todo: `estado_registro`, `eliminado` (soft delete — los `findMany`/`findFirst` casi siempre filtran `eliminado: false`), `fecha_creacion`, `fecha_modificacion`, `usuario_creacion`, `usuario_modificacion`.
- **Permisos**: decorador `@Permisos('modulo:accion')` en cada endpoint (`common/decorators/permisos.decorator.ts`), enforced por `PermisosGuard` global. Acciones válidas: `ver, crear, editar, eliminar, aprobar, anular` (enum `AccionPermiso` en el schema). Los permisos de cada módulo se siembran automáticamente en `backend/prisma/seed.ts`: agregar el nombre del módulo al array `modulos` (línea ~110) genera las 6 combinaciones `modulo:accion`; después hay que sumarlas a mano al array de permisos del rol que corresponda (`permisosVendedor`, `permisosCompras`, etc. — Administrador recibe todo automáticamente).
- **Usuario actual**: `@CurrentUser('sub')` da el id del usuario; `@CurrentUser('idPuntoVenta')` y `@CurrentUser('esSuperadmin')` también existen cuando hace falta scoping por tienda.
- **Números de documento internos**: `generarNumeroInterno(prefijo, secuencial)` de `common/utils/numero-documento.util.ts` → `"COM-00000001"`. Cada módulo transaccional (Ventas, Compras, Gastos) usa su propio prefijo (`VTA`, `COM`, `GAS`) y cuenta filas existentes para el secuencial — no hay tabla de correlativos separada para esto (sí existe `tbl_series_documento` pero es para los correlativos SUNAT de boletas/facturas, no para el numero_interno).
- **Redondeo**: `redondear2`/`redondear4` del mismo util — usar siempre en vez de `Math.round` a mano, para consistencia de decimales monetarios.
- **Respuesta HTTP**: interceptor global (`common/interceptors/response-transform.interceptor.ts`) envuelve todo en `{ ok: true, data, meta? }`. Si un service de listado devuelve `{ data, total, page, limit }` (plano, sin envolver), el interceptor detecta `total` y arma `meta: { total, page, limit, totalPages }` automáticamente — por eso todos los `findAll` de los módulos devuelven ese shape plano, nunca armes el `meta` a mano. Errores: `common/filters/http-exception.filter.ts` → `{ ok: false, statusCode, message, errors, timestamp, path }`.
- **Migraciones en este entorno**: `npx prisma migrate dev` falla ("non-interactive environment") porque el shell no tiene TTY. Workaround usado en este proyecto: generar el SQL con `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, guardarlo a mano en `prisma/migrations/<timestamp>_<nombre>/migration.sql`, y aplicarlo con `npx prisma migrate deploy` (no interactivo). Después `npx prisma generate` — si el backend está corriendo con `--watch`, primero hay que matar el proceso (Windows bloquea el `.dll.node` del query engine con `EPERM` si sigue vivo).
- **Dinero/Decimal**: los campos `Decimal` de Prisma se serializan como **string** en el JSON de la API (no number). El frontend siempre los tipa `string` y hace `Number(...)`/`formatMoneda(...)` para mostrarlos — nunca asumas `number` en un tipo TS del lado del cliente para un campo que en Prisma es `Decimal`.

### Módulos backend existentes

`auth, usuarios, roles, permisos, clientes, proveedores, productos, categorias, marcas, unidades-medida, almacenes, inventario, ventas, compras, gastos, ordenes-compra, caja, facturacion, rrhh, reportes, config-margenes, tipos-cambio, series-documento, metodos-pago, empresa, peru-api`

Puntos no obvios:
- **Compras** (`tbl_compras`) es mercadería (afecta stock, tiene `tbl_detalle_compras` por producto). Tiene campos `flete_*` para prorratear el costo del flete al costo de inventario (`flete_monto`, `flete_moneda`, `flete_tipo_prorrateo`, `id_proveedor_flete`) — **pero ya no tiene seguimiento de pago del flete** (eso se sacó, ver Gastos).
- **Gastos** (`tbl_gastos`) es para CUALQUIER factura de proveedor que no sea mercadería (flete, alquiler, servicios, comida, honorarios, etc.). Es de una sola línea (sin tabla de detalle, a diferencia de Compras) — un comprobante = un monto. Tiene `id_compra_relacionada` opcional (vínculo débil, sin FK real, mismo patrón que `id_orden_compra` en Compras) para el caso de "esta es la factura real del flete de esta compra". El pago de un Gasto sí genera un movimiento de egreso en `tbl_movimientos_caja` si se le pasa `id_caja_apertura`.
- **Ventas** (`tbl_ventas`) maneja Boleta/Factura/Nota de Venta/Cotización/Nota de Crédito, con envío a SUNAT vía NubeFact (mock por defecto) desacoplado de la emisión — el envío es manual desde Facturación → Enviar a SUNAT, no automático al crear la venta.
- **IDOR histórico corregido**: hay un helper `assertMismoPuntoVenta()` en `ventas.service.ts` que valida que el usuario no acceda a ventas de otra tienda (excepto superadmin) — patrón a replicar si se agrega scoping por tienda en otro módulo.

## Frontend (`frontend-react/`) — convenciones

- **Sin codegen de API**: tipos TS escritos a mano en `src/types/<modulo>.ts`, cliente API a mano en `src/api/<modulo>.ts` (siempre `{ listar, obtener, crear, ... }` como objeto plano, no clases). Los tipos deben reflejar el schema de Prisma exactamente (campo por campo), no lo que "parecería lógico" — este proyecto tiene historial real de bugs por asumir formas de datos sin verificar contra el backend.
- **Alias `@/`** apunta a `src/` (`vite.config.ts` + `tsconfig.app.json`).
- **Rutas**: todas bajo `<RequireAuth>` en `App.tsx`, cada grupo de rutas envuelto en `<RequirePermiso perm="modulo:accion" />` — el permiso usado ahí debe coincidir con el que exige el endpoint principal de esa pantalla en el backend, no con lo que "parece" el permiso del menú.
- **Menú**: `src/components/layout/menu.ts`, array `MENU` de grupos `{ header, items: [{ key, label, icon, href, perm }] }`. `perm: null` = visible para cualquier autenticado.
- **Componentes compartidos reutilizables**: `Autocomplete<T>` (buscador con debounce, acepta `value` opcional para forzar el texto mostrado desde afuera — útil para pre-rellenar), `useConfirmar()` (modal de confirmación en vez de `window.confirm`), `EstadoTag` (Tag coloreado según un mapa de estados conocidos — si agregás un estado nuevo que no está en `COLORES_DEFAULT`, agregalo ahí en vez de dejarlo con el color por defecto), `usePagination(limit)`.
- **Patrón de página**: CRUD simple → `XPage.tsx` + `XFormModal.tsx` (React Hook Form + Zod, ver `ClienteFormModal.tsx`). Transaccional/complejo (Ventas, Compras, Notas de Crédito, Gastos) → estado plano con `useState` en vez de RHF, porque mezclan `Autocomplete`, `DatePicker` con `dayjs`, pre-relleno desde otra pantalla y cálculos derivados en vivo — RHF agrega fricción ahí sin beneficio real.
- **Money/fecha**: `formatMoneda()` de `utils/format.ts`; fechas con `dayjs`.
- **Ant Design v6**: ojo con APIs deprecadas si copiás patrones viejos — `Alert` usa `title` no `message`; `Space`/`Divider` usan `orientation` no `direction`; `List`/`List.Item` están deprecados (usar divs con flexbox); `InputNumber` con `addonBefore/After` deprecado (usar `Space.Compact` + botón disabled).
- **Layout**: sidebar y header con `position: sticky` (`AppLayout.tsx`) para que no se desplacen con el scroll del contenido.

### Páginas frontend existentes (`src/pages/`)

`clientes, proveedores, rrhh, roles, usuarios, configuracion/ (categorias, marcas, unidades-medida, almacenes, series, empresa, margenes, tipos-cambio), inventario/ (ajustes, ajuste-nuevo, listado, kardex), productos, ordenes-compra, reportes, caja, ventas/ (listado, nueva, imprimir con QR, nota-credito), compras/ (listado, nueva con importación XML y prorrateo de flete, nota-credito), facturacion/ (enviar a SUNAT), gastos/`

## Verificación end-to-end

Este proyecto no tiene tests automatizados de frontend. La forma establecida de verificar una pantalla nueva es: `tsc --noEmit -p tsconfig.app.json` en `frontend-react/` para tipos, y una pasada real en navegador con Playwright — instalar temporalmente (`npm install -D playwright` en `frontend-react/`), loguearse de verdad contra el backend local, ejercitar el flujo completo, y **desinstalar Playwright y borrar los scripts/screenshots temporales al terminar** (no debe quedar como dependencia ni archivo suelto en el repo).

## Contexto de negocio a tener en cuenta

- Perú, SUNAT: los comprobantes electrónicos (Boleta/Factura/Nota de Crédito) van a NubeFact como PSE/OSE. IGV = 18%.
- Multi-tienda pero mono-almacén: hay 2 `tbl_puntos_venta` (tiendas) pero un solo `tbl_almacenes` compartido — no asumas que cada tienda tiene su propio almacén de inventario.
- El dueño (usuario de este repo) es no-técnico y opera el sistema día a día — priorizar explicaciones claras y confirmaciones antes de cambios que afecten datos reales o el flujo de trabajo diario, sobre todo en Ventas/Caja que se usan en producción activamente.
