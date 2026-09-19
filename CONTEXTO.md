# Contexto del proyecto (para retomar rápido en otra sesión)

> Este documento es un **registro vivo** del estado del proyecto: reglas de negocio, modelo de datos, rutas, decisiones tomadas y avances. Se actualiza al cerrar cada funcionalidad importante. Las convenciones de código (cómo está estructurado el repo, patrones a seguir) están en `CLAUDE.md` — este archivo es el complemento de "qué se hizo, por qué, y en qué estado quedó".

Última actualización: **2026-09-19** (auditoría de seguridad completa §16, Caja: el cuadre ya no lo desvían pagos no-efectivo §17, Gastos vinculados con sus egresos de Caja §18, Kardex: Notas de Crédito de Compra ya no pueden sobre-acreditar §19, Reportes reorganizados en páginas dedicadas + reporte de Toma de Inventario mejorado §20, Importación masiva de catálogo de Productos §21). Anterior: 2026-09-12 (Arqueo de Caja §6, Kardex §7, Compras en moneda original §10, bug de Subtotal/IGV/Total en soles disfrazados de USD §11, de 5 a 3 precios de venta §12, bug del IGV comiéndose el margen real §13, Kardex no guardaba costo en ventas/anulaciones §14, cantidades siempre enteras §15).

---

## 1. Qué es MARTSOFT

ERP/facturador para un negocio de **repuestos de auto en Perú** con **2 tiendas** (puntos de venta). Es un producto pensado para ser distribuible/blanco-etiquetable (nombre de marca del software = "MARTSOFT"), pero hoy tiene un solo cliente real: el dueño de este repo, que **es no-técnico y opera el sistema día a día**. Prioridad siempre: explicaciones claras y confirmar antes de cambios que toquen datos reales o el flujo diario, sobre todo en **Ventas y Caja** (se usan en producción activamente).

Reglas de negocio clave:
- **Single-tenant**: `tbl_empresas` tiene una sola fila (la empresa configurada ahí es la que aparece en sidebar/comprobantes; "MARTSOFT" es solo la marca del software).
- **Multi-tienda, mono-almacén**: hay 2 `tbl_puntos_venta` pero un solo `tbl_almacenes` compartido. No asumir que cada tienda tiene su propio stock.
- **SUNAT (Perú)**: Boleta/Factura/Nota de Crédito van a NubeFact como PSE/OSE. IGV = 18%. Hoy en modo **mock** (`SUNAT_MODE=mock`, `PERU_API_PROVIDER=mock`) — sin credenciales reales, todo simulado (incluye consultas RUC/DNI).
- **Envío a SUNAT es manual**, no automático al emitir la venta (pantalla Facturación → Enviar a SUNAT).
- **Compras** = mercadería (afecta stock). **Gastos** = cualquier otro comprobante de proveedor (flete, alquiler, servicios, honorarios) — una sola línea, sin tabla de detalle, con vínculo débil opcional a una Compra (`id_compra_relacionada`) para el caso "esta es la factura real del flete de tal compra".
- **Cotizaciones** no es un módulo de datos aparte: vive en la misma tabla/endpoint que Ventas (`tipo_documento: 'COTIZACION'`), solo separado en el frontend para que el vendedor no elija mal el tipo de documento.
- **Caja**: apertura con monto inicial → movimientos (ingreso/egreso, automáticos desde Ventas/Gastos o manuales) → cierre con monto contado total. Desde 2026-09-12 también existe **Arqueo de Caja** intermedio (ver §6).
- Roles con permisos granulares `modulo:accion` (`ver, crear, editar, eliminar, aprobar, anular`); Administrador (`es_superadmin`) bypassa todo.

**Glosario de precio/costo/valor** (definido 2026-09-12, para no mezclar los términos en pantallas ni conversaciones futuras):
- **Precio** = lo que se paga o se cobra — un dato de *entrada*. En Compras: el precio que dice la factura del proveedor. En Ventas: el precio que se le cobra al cliente (con IGV).
- **Costo** = lo que le cuesta a la empresa tener el producto en inventario — siempre *calculado* por el sistema, nunca se escribe a mano (salvo un Ajuste de Inventario manual). Incluye el flete prorrateado. Es lo que usan Kardex, Ajustes de Inventario y el costo promedio del producto.
- **Valor unitario** = término técnico de SUNAT (precio sin IGV) — uso interno para la factura electrónica, nunca se le muestra al usuario.

Credenciales de prueba (seed, idempotente vía `npm run prisma:seed`):
- `admin@daytona.pe` / `Admin123!` — Administrador (superadmin)
- `tienda1@daytona.pe` / `Tienda1_2026!` — Vendedor, Tienda 1
- `tienda2@daytona.pe` / `Tienda2_2026!` — Vendedor, Tienda 2

## 2. Stack y cómo levantar todo

Monolito modular: `backend/` (NestJS + Prisma + PostgreSQL, puerto 3000, prefijo `/api/v1`, Swagger en `/api/docs`) + `frontend-react/` (React 19 + TS + Vite + Ant Design + TanStack Query, puerto 5174). No hay otro frontend (el viejo `frontend/` en vanilla JS está retirado, no replicar patrones de ahí).

```bash
cd backend && npm run start:dev       # requiere PostgreSQL local + backend/.env (copiar de .env.example)
cd frontend-react && npm run dev
```

Convenciones de código detalladas (estructura de módulos, permisos, DTOs, patrón `{ ok, data, meta }`, workaround de migraciones sin TTY, serialización de `Decimal` como string, etc.) → **ver `CLAUDE.md`**, no se repiten acá.

## 3. Modelo de datos — mapa completo de tablas

Todas con prefijo `tbl_`. Agrupadas por área (ver `backend/prisma/schema.prisma` para el detalle campo por campo):

**Identidad / seguridad**
- `tbl_empresas`, `tbl_puntos_venta`, `tbl_series_documento` (correlativos SUNAT de boletas/facturas)
- `tbl_roles`, `tbl_permisos`, `tbl_roles_permisos`, `tbl_usuarios`, `tbl_usuarios_roles`, `tbl_dispositivos`, `tbl_logs_acceso`, `tbl_auditoria`

**Catálogo / productos**
- `tbl_categorias`, `tbl_subcategorias`, `tbl_marcas`, `tbl_unidades_medida`, `tbl_almacenes`
- `tbl_clientes`, `tbl_proveedores`, `tbl_producto_codigos_proveedor` (código alterno por proveedor para un mismo producto)
- `tbl_productos`

**Inventario**
- `tbl_inventario` (stock actual), `tbl_movimientos_inventario`, `tbl_kardex`
- `tbl_ajustes_inventario` + `tbl_detalle_ajustes_inventario`
- `tbl_tomas_inventario` + `tbl_detalle_tomas_inventario` (conteo físico general, con reporte de diferencias)

**Ventas / cobros**
- `tbl_metodos_pago`
- `tbl_ventas` (incluye Boleta/Factura/Nota de Venta/Cotización/Nota de Crédito), `tbl_detalle_ventas`, `tbl_pagos`
- `tbl_sunat_envios`, `tbl_sunat_respuestas` (tracking del envío manual a NubeFact)

**Compras / gastos**
- `tbl_compras` + `tbl_detalle_compras` (mercadería, con campos `flete_*` para prorrateo de costo — sin seguimiento de pago del flete, eso vive en Gastos)
- `tbl_gastos` + `tbl_detalle_gastos` (cualquier comprobante que no sea mercadería)
- `tbl_ordenes_compra` + `tbl_detalle_ordenes_compra`

**Caja**
- `tbl_cajas` (catálogo por punto de venta), `tbl_cajas_aperturas` (sesión: apertura→cierre), `tbl_movimientos_caja` (ingresos/egresos)
- `tbl_cajas_arqueos` **(nuevo, 2026-09-12)** — conteo físico por denominación en cualquier momento, sin cerrar caja (ver §6)

**RRHH / configuración**
- `tbl_personal` (planilla: DNI, sueldo, cuenta bancaria, tipo de contrato)
- `tbl_config_margenes` (márgenes de precio configurables)
- `tbl_tipos_cambio`

## 4. Rutas API — base por módulo

Prefijo global `/api/v1`. Fuente de verdad siempre actualizada: **Swagger en `http://localhost:3000/api/docs`** (no hace falta mantener acá el detalle de cada endpoint, solo la base):

| Base route | Módulo |
|---|---|
| `/auth` | login, refresh, logout, dispositivos |
| `/usuarios`, `/roles`, `/permisos` | identidad y control de acceso |
| `/clientes`, `/proveedores` | |
| `/categorias`, `/marcas`, `/unidades-medida`, `/almacenes` | catálogo |
| `/productos` | |
| `/inventario`, `/toma-inventario` | |
| `/ventas` | incluye Cotización/Nota de Venta/canje |
| `/compras`, `/ordenes-compra` | |
| `/gastos` | |
| `/caja` | cajas, aperturas, cierre, movimientos, **arqueos** |
| `/facturacion` | envío manual a SUNAT |
| `/rrhh/personal` | |
| `/reportes` | incluye exports a Excel |
| `/config/margenes`, `/series-documento`, `/tipos-cambio`, `/metodos-pago`, `/empresa` | configuración |

## 5. Historial de decisiones y avances importantes

Orden cronológico, más reciente primero. Resume el "por qué" detrás de cambios no obvios por el código solo (el historial completo de commits está en `git log`).

- **2026-09-19 — Importación masiva de catálogo de Productos** (ver detalle en §21). Plantilla Excel descargable + import con reporte fila por fila.
- **2026-09-19 — Nota de Crédito de Compra: aclarado el switch "afecta stock"**: se agregó un texto de ayuda explicando que hay que desactivarlo cuando el stock ya se sacó a mano (Ajuste de Inventario) antes de que llegue la NC del proveedor — la funcionalidad ya existía (`afecta_stock` en el DTO, gatea todo el bloque de movimiento de inventario en `compras.service.ts`), solo no era obvio para el usuario que resolvía justo ese caso.
- **2026-09-19 — Reportes reorganizados en páginas dedicadas** (ver detalle en §20): Ventas por Producto/Marca/Punto de Venta (con gráfico) + reporte de Toma de Inventario mejorado (con valorización de diferencias). La pestaña vieja de Tomas de Inventario en el Centro de Reportes se retiró (las demás pestañas —Ventas, Compras, Inventario, Auditoría— siguen ahí, decisión del usuario de migrar de a poco).
- **2026-09-19 — Kardex: Notas de Crédito de Compra ya no pueden sobre-acreditar** (ver detalle en §19).
- **2026-09-19 — Gastos vinculados con sus egresos de Caja** (ver detalle en §18): se puede ver el Gasto desde el movimiento de Caja y viceversa, y pagar un Gasto pendiente desde la pantalla de Caja usa el mismo flujo que "Pagar" desde Gastos.
- **2026-09-19 — Caja: el cuadre/arqueo ya no lo desvían los pagos no-efectivo** (ver detalle en §17). Bug real: Yape/tarjeta/transferencia se contaban como si fueran efectivo físico al calcular el saldo esperado.
- **2026-09-19 — Auditoría de seguridad completa** (ver detalle en §16): 13 hallazgos revisados y corregidos (fuga de `password_hash`, endpoint de auditoría sin restringir a superadmin, falta de scoping por tienda en Gastos, anulación de venta que no revertía el ingreso de Caja, entre otros).
- **2026-09-12 — Cantidades de producto siempre como enteros** (ver detalle en §15): tanto en pantallas de solo lectura como en los campos donde se escribe una cantidad, en todo el sistema.
- **2026-09-12 — Kardex no guardaba costo en ventas ni en varias anulaciones** (ver detalle en §14). Corregido hacia adelante (movimientos nuevos), no se tocó el historial ya guardado.
- **2026-09-12 — Bug grave: el IGV se comía el margen real de utilidad** (ver detalle en §13). El precio "Distribuidor" (10%) estaba dando pérdida real en cada venta. Corregido + recalculados 11 de 12 productos + descubierto y corregido un producto de prueba (REP-003) con 2 compras falsas que distorsionaban su costo promedio.
- **2026-09-12 — De 5 a 3 precios de venta** (ver detalle en §12). Sin migración de base de datos.
- **2026-09-12 — Bug: Subtotal/IGV/Total de Compras en USD mostraban soles disfrazados de dólares** (ver detalle en §11). Encontrado a partir de un reporte real del usuario (compra 001-351). Arreglado en 3 pantallas, sin migración.
- **2026-09-12 — Código de producto junto al nombre en pantallas internas**: se agregó `producto?.codigo` (ya venía en todas las respuestas del backend, solo faltaba pintarlo) en `CompraDetalleModal.tsx` (2 tablas), `VentaDetalleModal.tsx`, `OrdenesCompraPage.tsx`, `NotaCreditoCompraPage.tsx`, `NotaCreditoPage.tsx`. A propósito **no** se tocó `ImprimirPage.tsx` (el comprobante impreso para el cliente) — el código interno no debe aparecer en un documento fiscal de cara al cliente. tsc limpio.
- **2026-09-12 — Nueva Compra: mostrar todo en la moneda de la factura, sin conversión** (ver detalle en §10). Implementado y verificado (tsc limpio, solo frontend), pendiente prueba manual del usuario.
- **2026-09-12 — Kardex: número de documento, subtipo NC, y "ver documento"** (ver detalle en §7). Implementado y verificado (tsc + backend arrancando limpio), pendiente prueba manual del usuario.
- **2026-09-12 — Arqueo de Caja** (ver detalle en §6). Nueva funcionalidad, implementada y pendiente de prueba manual del usuario en navegador.
- **Cotizaciones como módulo aparte** (`f0cefb5`): separación de UI/rutas dentro de Ventas para que el vendedor no elija mal el tipo de documento — sigue siendo el mismo backend/tabla de Ventas, no un dominio nuevo.
- **Rebrand ERP Daytona → MARTSOFT** (`3df3a3f`): cambio de marca del software (login, título, docs API). El nombre de la empresa/tenant en `tbl_empresas` es independiente y sigue siendo configurable.
- **Toma de Inventario** (`a6dec4e`, `bf8c18d`): módulo de conteo físico general (distinto del Arqueo de Caja, que es solo de efectivo) — cantidad vacía, observaciones y reporte de diferencias.
- **Gastos** (`42256c2`, `f2e351f`, `cb85b20`): módulo agregado para separar mercadería (Compras) de cualquier otro comprobante de proveedor; luego se agregó detalle de línea, proveedor obligatorio, importación XML, y vínculo a factura de flete ya registrada en una Compra.
- **Migración completa a React** (`3516b9b`): el frontend legacy en vanilla JS fue retirado por completo — no replicar patrones de ahí si aparecen en git history antiguo.
- **IDOR corregido en Caja/Ventas**: helper `assertMismoPuntoVenta()` en los services valida que un usuario no acceda a datos de otra tienda (excepto superadmin) — patrón a replicar si se agrega scoping por tienda en otro módulo nuevo.

## 6. Arqueo de Caja (funcionalidad más reciente — 2026-09-12)

**Qué es y por qué**: hasta ahora Caja solo permitía cuadrar el efectivo al **cerrar** la sesión del día (un solo monto total contado). El negocio necesitaba poder contar el efectivo físico **en cualquier momento del día**, desglosado por billetes y monedas, para detectar diferencias temprano sin interrumpir la operación — a esto le llaman "arqueo de caja".

**Decisiones de diseño**:
- Es un **registro histórico independiente**, no cierra ni modifica la apertura de caja (`tbl_cajas_aperturas`). Se pueden hacer varios arqueos en una misma apertura.
- Denominaciones fijas (moneda peruana, no configurables): monedas S/ 0.10, 0.20, 0.50, 1, 2, 5; billetes S/ 10, 20, 50, 100, 200.
- Reutiliza los permisos existentes `caja:ver` (listar) / `caja:crear` (registrar) — no se creó un permiso nuevo ni se tocó `seed.ts`.
- El desglose de denominaciones se guarda como `Json` (no una subtabla): catálogo fijo y cerrado, mismo criterio que `tbl_ventas.respuesta_raw`.
- El cálculo de "saldo esperado por sistema" se extrajo a un método privado compartido `calcularSaldoSistema()` en `caja.service.ts`, reutilizado por `cerrarCaja` y el nuevo `registrarArqueo` (antes estaba duplicado).

**Qué se tocó**:
- `backend/prisma/schema.prisma`: modelo nuevo `tbl_cajas_arqueos` + relaciones inversas en `tbl_cajas_aperturas` y `tbl_usuarios`.
- Migración `backend/prisma/migrations/20260912104500_caja_arqueos/`.
- `backend/src/modules/caja/caja.service.ts` y `caja.controller.ts`: `POST` y `GET /caja/aperturas/:id/arqueos`.
- `frontend-react/src/types/caja.ts`, `api/caja.ts`: tipos y llamadas nuevas.
- `frontend-react/src/pages/caja/ArqueoCajaModal.tsx` (nuevo): formulario de conteo por denominación con total y diferencia en vivo.
- `frontend-react/src/pages/caja/CajaResumenVista.tsx`: nueva sección "Arqueos de caja" (reutilizada en `CajaPage.tsx` y `CajaHistorialDetalleModal.tsx`).
- No se tocó `menu.ts` ni `App.tsx` (es un modal dentro de la pantalla de Caja existente, no una ruta nueva).

**Estado**: implementado, `tsc --noEmit` limpio, backend arrancando sin errores. **Falta que el usuario lo pruebe manualmente en el navegador** (`localhost:5174` → login `tienda1@daytona.pe` / `Tienda1_2026!` → Caja → botón "Arqueo de Caja") antes de commitear. Plan completo del diseño (por si hace falta el detalle línea por línea) quedó en `C:\Users\ROGER\.claude\plans\recursive-stirring-shell.md` de esa sesión.

## 7. Kardex: número de documento, subtipo Nota de Crédito, y "ver documento" (2026-09-12)

**Qué era el problema**: el Kardex de un producto (`/inventario/kardex`) mostraba el tipo de movimiento (entrada/salida/ajuste) y una referencia genérica ("Venta", "Compra", "Ajuste"), pero no el número real del documento, no dejaba abrirlo, y — el hallazgo más importante — **una Venta y su Nota de Crédito comparten `tipo_referencia='venta'`** en `tbl_kardex` (mismo caso Compra/NC compra con `'compra'`), así que a simple vista no se podía saber si un movimiento fue una venta normal o una devolución.

**Cómo se resolvió**: `tbl_kardex.id_referencia` es un UUID crudo sin FK real. En vez de migrar el esquema (habría requerido backfill para todo el historial ya existente), se resuelve el número de documento **en el momento de la consulta**: `InventarioRepository.obtenerKardex()` junta los `id_referencia` de la página por tipo y hace lookups en lote (`tbl_ventas`/`tbl_compras`/`tbl_ajustes_inventario` con `where: { id: { in: [...] } }`, sin N+1), agregando `numero_documento` y `tipo_documento_origen` a cada fila. `tipo_documento_origen` (`tbl_ventas.tipo_documento` = `NOTA_CREDITO` vs otros; `tbl_compras.tipo_documento` string `'nota_credito'` vs `'compra'`) es lo que permite distinguir la Nota de Crédito en el frontend.

**Qué se tocó**:
- `backend/src/modules/inventario/inventario.repository.ts`: método nuevo `resolverDocumentosOrigen()`, usado por `obtenerKardex()`. Sin migración — ambos endpoints (`/inventario/kardex/:id` y `/reportes/kardex/:id`, el único que usa el frontend) delegan al mismo repository, así que se arregló una sola vez.
- `frontend-react/src/types/kardex.ts`: campos `numero_documento`/`tipo_documento_origen`/`id_referencia`/`descripcion` en `MovimientoKardex` + helper `etiquetaReferencia()` que arma el label distinguiendo NC.
- `frontend-react/src/pages/inventario/AjusteDetalleModal.tsx` (nuevo): se extrajo el modal de detalle de Ajuste que antes vivía inline en `AjustesInventarioPage.tsx`, para reutilizarlo también desde Kardex.
- `frontend-react/src/pages/inventario/KardexPage.tsx`: columna "N° Documento", columna "Referencia" ahora usa `etiquetaReferencia()`, y botón "Ver documento" que abre `VentaDetalleModal`/`CompraDetalleModal` (ya existían, reutilizados tal cual — sirven tanto para el documento normal como para su Nota de Crédito porque viven en la misma tabla) o el nuevo `AjusteDetalleModal`, según `tipo_referencia`.
- Transferencias e Inventario Inicial se dejaron sin botón "ver documento" a propósito: no existe un `tbl_transferencias` ni documento propio navegable para esos casos — decisión de no inventar uno para esto.
- **Corrección 2026-09-12 (misma sesión)**: para movimientos de tipo Compra, `numero_documento` mostraba el código interno del sistema (`COM-00000009`) en vez del número real de la factura del proveedor. Se corrigió para usar `serie-numero` (ej. `001-351`), con fallback a `numero_interno` solo si la compra no tiene serie/número cargados. Ventas (usa `numero_comprobante`, ya era el número real) y Ajustes (usa su propio `numero_interno`, que es su "número de movimiento") no necesitaron cambio.

**Estado**: implementado, `tsc --noEmit` limpio, backend recompiló sin errores (0 errors en watch mode). Falta prueba manual del usuario en navegador.

## 10. Nueva Compra: mostrar todo en la moneda de la factura, sin conversión (2026-09-12)

**Qué era el problema**: en `NuevaCompraPage.tsx`, si la factura era en USD, algunas partes de la pantalla mostraban el monto convertido a soles sin que el usuario lo pidiera — las cajas "Costo unit. s/IGV" / "Costo unit. c/IGV" de cada línea estaban **hardcodeadas a "S/"** literal (ignoraban la moneda elegida), el desglose "Base/IGV" por línea también, y el resumen de totales mostraba una líneita chica "≈ S/ ..." debajo de cada monto.

**Decisión** (confirmada con el usuario): si la factura es en USD, todo en pantalla se ve en dólares, sin ninguna referencia convertida a soles — se sacaron los "≈" del resumen. La excepción es el modal de detalle de una compra ya guardada (`CompraDetalleModal.tsx`), sección **"Costeo de inventario"** (Costo Base, Flete Prorrateado, Costo Final): esa se deja en soles a propósito, porque valoriza el inventario (obligatorio en soles para contabilidad en Perú) y ya tiene un aviso explicando que es un cálculo aparte de la factura — no se tocó.

**Bug relacionado encontrado y arreglado de paso**: el monto del flete (que tiene su propio selector de moneda, independiente de la moneda de la factura) se mostraba mal convertido cuando su moneda no coincidía con la de la factura. Ahora se muestra siempre en su propia moneda (`fleteMonto` + `fleteMoneda`), sin conversión.

**Qué se tocó** (solo frontend, un archivo): `frontend-react/src/pages/compras/NuevaCompraPage.tsx` — se sacó toda conversión a PEN de la capa de *display* (la función `getCostoUnitarioSinIgvPen` se simplificó a `getCostoUnitarioSinIgv`, sin parámro de moneda/tipo de cambio). El payload que se manda al backend en `guardar()` **no cambió** — sigue mandando `importe_linea` en la moneda original + `tipo_cambio` por separado, el backend sigue calculando su propia conversión a soles para el costeo de inventario.

**Estado**: implementado, `tsc --noEmit` limpio. Falta prueba manual del usuario (probar con una compra en USD y otra en PEN, y con flete en una moneda distinta a la factura).

## 11. Bug: Subtotal/IGV/Total de Compras en USD mostraban soles disfrazados de dólares (2026-09-12)

**Causa raíz** (`backend/src/modules/compras/compras.service.ts:78-106`): el backend SIEMPRE calcula y guarda `subtotal`/`igv`/`total` — tanto a nivel de línea (`tbl_detalle_compras`) como de cabecera (`tbl_compras`) — **en soles (PEN)**, sin importar la moneda de la factura. Solo `precio_unitario`/`importe_linea` quedan en la moneda original. Esto es intencional (la valorización de inventario debe ir en soles), pero varias pantallas mostraban esos campos PEN con el símbolo de la moneda de la factura (`compra.moneda`) como si ya estuvieran en esa moneda — resultado: si la factura es USD, "Subtotal/IGV/Total" se veían ~3-4x más grandes de lo real (el valor en soles, con el símbolo de dólar). Detectado porque el usuario notó que Cantidad × P. Unitario no cuadraba con el Subtotal mostrado (compra 001-351: 5 × US$17.70 no daba el "Subtotal US$281.25" que se veía, porque ese 281.25 en realidad eran soles).

**Fix**: sin migración — el dato correcto en soles ya estaba bien guardado, solo había que revertir la conversión al mostrarlo. Nuevo helper `penAMonedaOriginal(valorPen, moneda, tipoCambio)` en `frontend-react/src/utils/format.ts` (divide entre el tipo de cambio si la moneda es USD). Aplicado en:
- `frontend-react/src/pages/compras/ComprasPage.tsx` (columna "Total" del listado)
- `frontend-react/src/pages/compras/CompraDetalleModal.tsx` (tabla "Detalle de la factura": Subtotal/IGV/Total por línea y el resumen) — **la sección "Costeo de inventario" de este mismo archivo NO se tocó**, sigue en soles a propósito (ver §10, decisión ya tomada)
- `frontend-react/src/pages/compras/NotaCreditoCompraPage.tsx` (tabla de búsqueda de compras a acreditar, y el texto "Total original")

Funciona automáticamente para todas las compras ya registradas (no solo las nuevas), porque es un cálculo al momento de mostrar, no algo que dependa de datos nuevos guardados distinto.

**Estado**: implementado, `tsc --noEmit` limpio, verificado matemáticamente contra la compra real 001-351 (da Subtotal US$75.00 + IGV US$13.50 = Total US$88.50, que sí cuadra con 5 × US$17.70). Pendiente confirmación visual del usuario en el navegador.

## 12. Sistema de costeo y márgenes de precio — cómo funciona + cambio de 5 a 3 precios (2026-09-12)

**Cómo funciona el costeo** (explicado al usuario, útil recordarlo en futuras sesiones):
- `tbl_productos.costo_promedio` se recalcula solo (promedio ponderado) en cada entrada de stock — método `actualizarCostoPromedio()` en `backend/src/modules/inventario/inventario.repository.ts:169-201`. Fórmula: `(stockAnterior×costoAnterior + cantidadEntrada×costoNuevo) / (stockAnterior+cantidadEntrada)`.
- Cada producto tiene hasta 5 precios de venta guardados como columnas fijas `precio_venta_1`..`precio_venta_5` en `tbl_productos` (no es una lista flexible — es un límite estructural de la tabla).
- `tbl_config_margenes` (5 filas por `numero`, cada una con `nombre` + `margen` en % + `activo`) es la "receta": `precio_venta = costo × (1 + margen/100)`.
- **Al registrar una compra** (`compras.service.ts:210-226`), el sistema recalcula automáticamente los `precio_venta_N` de cada producto comprado, usando el costo de *esa* compra puntual (no el promedio) × cada margen **activo** (`findActivos()`). Si un margen está desactivado, esa compra ya no le toca el precio a ese número.
- **Al crear un producto nuevo**, los precios NO se calculan solos — hay que escribirlos a mano (o quedan en 0).
- **Al cambiar el % de un margen en Configuración**, eso NO actualiza retroactivamente los productos ya cargados, solo aplica a la próxima compra de cada producto.
- El usuario también puede editar cualquier `precio_venta_N` a mano en cualquier momento — se mantiene hasta que una nueva compra lo vuelva a pisar.
- Inconsistencia menor detectada (no crítica, ya documentada, no corregida): al comprar, `precio_compra_sin_igv`/`precio_compra_con_igv` del producto se pisan con el costo de *esa* compra puntual, no con el costo promedio recién calculado un instante antes en la misma transacción — aunque `costo_promedio` en sí queda bien.

**Cambio aplicado — de 5 a 3 precios activos**: el usuario decidió reducir de 5 a 3 márgenes en uso: quedan activos **Precio Minorista (25%)**, **Precio Mayorista (20%)**, **Precio Distribuidor (10%)**; se desactivaron **Precio Especial (15%, numero=3)** y **Precio Costo (5%, numero=5)**.

**Decisión de enfoque**: NO se migró el esquema (las 5 columnas siguen existiendo en `tbl_productos` — reversible sin trabajo de desarrollo si algún día quieren reactivar un margen). Se optó por "desactivar + limpiar datos", apoyándose en que Ventas/Cotizaciones/listado de Productos ya filtran precios en 0 para no mostrarlos como opción (`Number(precio) > 0`), patrón confirmado en `NuevaVentaPage.tsx`, `NuevaCotizacionPage.tsx` y `ProductosPage.tsx`.

**Qué se hizo**:
1. `PATCH /config/margenes/3` y `/5` con `{ activo: false }` (vía la API real, no un script directo a la BD — así queda auditado igual que si se hiciera desde la pantalla Configuración → Márgenes).
2. `PATCH /productos/:id` con `{ precio_venta_3: 0, precio_venta_5: 0 }` para los 12 productos activos que había en ese momento (todos tenían P3 cargado, 4 de ellos también tenían P5).
3. `frontend-react/src/pages/productos/ProductoFormModal.tsx:74`: se agregó `.filter((m) => m.activo)` antes de renderizar los inputs de precio — antes mostraba siempre los 5 márgenes devueltos por `GET /config/margenes` (que trae todos, activos e inactivos); ahora solo muestra los 3 activos. Sin este cambio, el formulario de producto habría seguido mostrando 5 inputs aunque los márgenes estuvieran desactivados.
4. No se tocó ningún otro archivo — Ventas, Cotizaciones, Productos (listado), reportes y el backend de compras/productos ya eran compatibles sin cambios (todos los campos son opcionales, y los filtros de "precio > 0" ya existían).

**Si en el futuro se agrega un producto nuevo**, solo va a pedir los 3 precios activos (el formulario ya se adapta). Si algún día quieren volver a 4 o 5 precios, alcanza con reactivar el margen en Configuración — no hace falta tocar código.

**Estado**: implementado y aplicado sobre datos reales (no es solo código pendiente de probar — ya se ejecutó). `tsc --noEmit` limpio.

## 13. Bug grave: el IGV se comía el margen real de utilidad (2026-09-12)

**El problema**: en `compras.service.ts` (líneas 210-226), la fórmula de auto-cálculo de precios de venta era `precio_venta = costo_sin_igv × (1 + margen/100)` — sin sumar el IGV encima. Pero en `ventas.service.ts` (líneas 116-129), ese mismo `precio_venta_N` se usa DIRECTAMENTE como "precio final con IGV incluido" (`valor_unitario = precio_unitario / 1.18` para sacar la base). Resultado: el 18% de IGV salía de adentro del margen configurado, no se sumaba aparte.

**Impacto real verificado con números** (costo S/100): Minorista (margen 25%) daba solo 5.93% de ganancia real; Mayorista (20%) solo 1.69%; **Distribuidor (10%) daba -6.78% — pérdida real en cada venta**, aunque el sistema mostrara "10% de margen".

**Fix**: `compras.service.ts` — se agregó el factor IGV (`item.afecta_igv ? 1.18 : 1`) multiplicando al final: `precio = costoFinal × (1 + margen/100) × factorIgv`. Aplica solo a compras nuevas hacia adelante (no toca lo que se calculó antes).

**Corrección de datos existentes**: se recalcularon `precio_venta_1/2/4` de 11 de los 12 productos activos (vía `PATCH /productos/:id`, API real, no script directo a BD) usando su `costo_promedio` actual con la fórmula corregida. **No se tocó REP-003** (Aceite de Motor) porque sus precios no coincidían con ninguna fórmula (parecían ajustados a mano) — ahí el usuario decidió sí recalcularlo iguelmente, pero al hacerlo apareció un segundo problema (ver abajo).

**Segundo hallazgo — REP-003 tenía costo promedio contaminado por datos de prueba**: revisando su historial completo (`tbl_movimientos_inventario`/`tbl_kardex`/`tbl_compras`), se encontraron 2 compras **activas** (no anuladas) con costos absurdamente bajos: `COM-00000007` (100 unidades a S/0.954) y `COM-00000008` (100 unidades a S/0.4595) — casi seguro compras de prueba del sistema (el historial de este producto está lleno de descripciones "prueba"/"test"). Esas 200 unidades baratas arrastraban el costo promedio real a solo S/4.87. **Se anularon ambas compras** (vía `PATCH /compras/:id/anular`, motivo documentado) — esto corrigió el stock (276→76) pero **no** corrigió `costo_promedio` solo, porque el sistema solo recalcula el promedio ponderado en movimientos de tipo entrada, no cuando se anula una compra vieja (limitación real, no es un bug nuevo, ya existía). Un intento de reconstruir el costo correcto reproduciendo todo el historial de movimientos dio stock negativo en algún punto — señal de que hay algún movimiento de stock inicial de este producto no capturado en `tbl_movimientos_inventario`, así que **no se forzó ningún número**. Decisión del usuario: dejarlo así, se va a ir corrigiendo solo con la próxima compra real de este producto (que si se registra por la pantalla normal, va a mezclar el costo actual con el costo real de esa compra).

**Pendiente / a tener en cuenta**:
- El precio de venta de REP-003 sigue siendo el viejo (S/70.31 para P1) — no está actualizado a la fórmula nueva porque su costo base no es confiable todavía.
- Limitación general del sistema (no exclusiva de este caso): anular una compra repone el stock pero no re-promedia `costo_promedio` retroactivamente. Si en el futuro se anula una compra grande, el costo promedio puede quedar desactualizado hasta la siguiente compra real — bueno tenerlo presente.

## 14. Kardex no guardaba costo en ventas ni en varias anulaciones (2026-09-12)

**El problema**: revisando todos los lugares donde se genera un movimiento de inventario/Kardex (`grep registrarMovimiento(EnTransaccion)?\(` en todo `backend/src`), se encontró que varios NO pasaban `costoUnitario` al helper (`InventarioRepository.registrarMovimientoEnTransaccion`), quedando en 0 por defecto:

| Origen | Tipo | ¿Guardaba costo antes? |
|---|---|---|
| Compra | entrada | ✅ Sí |
| **Venta** | salida | ❌ No |
| **Anulación de Venta** (repone stock) | entrada | ❌ No |
| **Canje** (Nota de Venta/Cotización → Boleta/Factura) | salida | ❌ No |
| **Anulación de Compra** | salida | ❌ No |
| **Nota de Crédito de Compra** | salida | ❌ No |
| Nota de Crédito de Venta (devolución física) | entrada | ✅ Sí (ya usaba costo_promedio) |
| Ajuste de Inventario | entrada/salida | ✅ Sí |
| Transferencia entre almacenes | salida+entrada | ✅ Sí |
| Inventario inicial | entrada | ✅ Sí |

Un Kardex "valorizado" (lo que pide SUNAT) debe mostrar el costo en cada movimiento, no solo en compras — es lo que permite calcular costo de ventas real. **Importante**: esto no afectaba `costo_promedio` ni `stock_actual` (esos ya estaban bien) — era solo que el registro/historial del Kardex no dejaba el valor asentado.

**Fix**: se agregó `costoUnitario: costo_promedio del producto en ese momento` en los 5 puntos que faltaban (`ventas.service.ts`: venta, anulación de venta, canje; `compras.service.ts`: anulación de compra, nota de crédito de compra), siguiendo el mismo patrón que ya usaba la Nota de Crédito de Venta. Para el único caso que es `entrada` (anulación de venta), se aplicó el mismo truco ya existente: usar el costo promedio actual como costo de esa entrada, lo cual matemáticamente **no distorsiona el promedio ponderado** (promedio de X y X sigue siendo X) — para los `salida` (venta, canje, anulación compra, NC compra) ni hace falta ese cuidado, porque `InventarioRepository.registrarMovimientoEnTransaccion` nunca recalcula el promedio en movimientos de salida.

**Alcance**: el fix aplica **solo hacia adelante** — los movimientos ya guardados en el Kardex con costo S/0.00 (todo el historial de ventas hasta ahora) se quedan así, no se reescribió el pasado. Si en algún momento se necesita un reporte de costo de ventas histórico, ese vacío en los datos viejos hay que tenerlo en cuenta.

**Estado**: implementado, backend recompiló sin errores. No requirió migración (mismo modelo de datos, solo se empezó a llenar un campo que antes quedaba en 0).

## 15. Cantidades de producto siempre como enteros (2026-09-12)

**Pedido**: que las cantidades de producto (no montos de dinero) se muestren y se ingresen siempre como números enteros, sin decimales, en todo el sistema — para no confundir, ya que en este negocio (repuestos) siempre se cuenta por unidad.

**Qué se tocó** (todo frontend, sin cambios de backend ni de esquema — `tbl_*.cantidad` sigue siendo `Decimal(12,4)` en la base, solo se restringió la UI):

*Visualización* (`.toFixed(4)`/`.toFixed(2)` → `.toFixed(0)`) en: `CompraDetalleModal.tsx`, `NotaCreditoCompraPage.tsx`, `NotaCreditoPage.tsx` (ventas), `ReportesPage.tsx` (Stock, Cant. contada, Stock sistema, Diferencia — reporte de tomas de inventario), `AjusteDetalleModal.tsx`, `InventarioPage.tsx` (Stock, Mín., Máx.), `KardexPage.tsx` (Entrada, Salida, Stock resultante, Stock del producto en el header), `OrdenesCompraPage.tsx`, `GastoDetalleModal.tsx`, `ImprimirPage.tsx` (comprobante impreso), `VentaDetalleModal.tsx`, `ProductosPage.tsx` (columna Stock), `TomaInventarioDetallePage.tsx` (helper `fmtCantidad`, antes mostraba 2 decimales si no era entero).

*Campos de entrada* (se agregó `min={1} step={1} precision={0}`, quitando los `min={0.001}`/`step={0.0001}` que permitían decimales) en: `NuevaCompraPage.tsx`, `NuevaVentaPage.tsx`, `NuevaCotizacionPage.tsx`, `AjusteNuevoPage.tsx`, `OrdenNuevaModal.tsx`, `TransferenciaModal.tsx`, `GastoFormModal.tsx`, `NotaCreditoCompraPage.tsx`, `NotaCreditoPage.tsx`, `TomaInventarioDetallePage.tsx` (2 inputs), y los campos `stock_minimo`/`stock_maximo` de `ProductoFormModal.tsx`.

**Lo que NO se tocó a propósito**: montos de dinero (`formatMoneda`, costos unitarios, tipo de cambio, flete) siguen con sus decimales — el pedido era solo sobre cantidades de producto, no sobre plata.

**Estado**: implementado, `tsc --noEmit` limpio.

## 8. Cambio pendiente sin commitear (de una sesión anterior, no relacionado a Arqueo/Kardex)

`backend/.env.example` tiene una modificación sin commitear: se quitaron las variables `APP_NAME`, `APP_URL`, `TIPO_CAMBIO_FUENTE`, `LOG_LEVEL` (aparentemente ya no usadas). Pendiente de decisión: commitear o descartar.

## 9. Ideas / backlog mencionado pero no implementado

- **"P. Referencial" en Órdenes de Compra** (`OrdenesCompraPage.tsx`, campo `precio_referencial`): es un cuarto término distinto a Precio/Costo para el mismo concepto (precio por unidad). Detectado en la investigación de terminología del 2026-09-12, no corregido — el usuario prefirió dejarlo para después.
- **Label engañoso en Productos**: "Último costo de compra (sin IGV)" (`ProductoFormModal.tsx`, campo `precio_compra_sin_igv`) no es en realidad el precio de la última factura — el sistema lo sobreescribe con el costo promedio ponderado después de cada compra, quedando igual al campo de al lado ("Costo promedio (ponderado)"). Mismo dato, dos labels. No corregido — pendiente para después.
- **Margen/utilidad en los reportes de Ventas Agrupadas** (§20): hoy solo muestran ingresos y unidades. El usuario decidió arrancar así ("fase 1") y dejar margen/utilidad para una fase 2, cuando haga falta.
- **Migrar el resto de `ReportesPage.tsx`** (§20): quedan las pestañas Ventas (listado crudo), Compras, Inventario valorizado y Auditoría sin página dedicada propia. El usuario prefirió sacar solo la pestaña de Tomas de Inventario por ahora y dejar el resto para más adelante.

## 16. Auditoría de seguridad completa (2026-09-19)

**Qué se hizo**: revisión de seguridad de todo el repo (backend + frontend), sin alcance acotado a un módulo. Metodología: revisión manual guiada por categorías típicas de OWASP/control de acceso (autenticación, autorización, IDOR, fuga de datos sensibles, condiciones de carrera, inyección, manejo de errores) — no fue un scan automático. Se encontraron y corrigieron los siguientes hallazgos, de más a menos severo:

1. **Fuga de `password_hash`** en las respuestas de `PATCH /usuarios/:id/estado` (activar/desactivar) y `DELETE /usuarios/:id`: devolvían el registro completo de `tbl_usuarios`, incluido el hash de la contraseña. Fix: `USUARIO_SELECT_SEGURO` (select explícito sin `password_hash`) en `usuarios.service.ts`.
2. **Escalación de privilegios**: cualquier usuario con permiso `usuarios:editar` podía asignarle a alguien (o a sí mismo) un rol `es_superadmin: true` vía `PATCH /usuarios/:id`. Fix: `usuarios.service.ts.update()` ahora cuenta cuántos de los roles que se están asignando son superadmin y bloquea con `ForbiddenException` si el que hace el cambio no es superadmin él mismo. Mismo problema y mismo fix en `roles.service.ts` (`create`/`update` de un rol con `es_superadmin: true`).
3. **`GET /reportes/auditoria` sin restringir**: cualquier usuario con `reportes:ver` (casi todos) podía leer el log de auditoría completo del sistema (quién hizo qué). Fix: `reportes.controller.ts` ahora exige `esSuperadmin`.
4. **Ventas: la apertura de caja no se validaba** al registrar una venta (`POST /ventas` con `id_caja_apertura`) — se podía mandar el id de una apertura de otra tienda, o de una ya cerrada. Fix: `assertCajaAperturaValida()` en `ventas.service.ts`, valida existencia + estado `abierta` + mismo punto de venta (vía `assertMismoPuntoVenta()`, ya existente).
5. **Anular una venta no revertía el ingreso de Caja**: dejaba un ingreso "fantasma" en `tbl_movimientos_caja` que descuadraba el cierre de caja del día. Fix: `ventas.service.ts.anular()` ahora busca el ingreso original (por `id_referencia`+`tipo_referencia:'venta'`) y genera el egreso compensatorio automáticamente; si la apertura de caja de esa venta ya está cerrada, bloquea la anulación automática y pide ajuste manual de un administrador (no intenta tocar una caja ya cerrada). También bloquea anular directamente una venta que ya tiene una Nota de Crédito activa (evitaría duplicar la reversión de stock).
6. **Gastos sin scoping por tienda**: a diferencia de Ventas/Caja, el módulo de Gastos no tenía el patrón `assertMismoPuntoVenta()` — un vendedor de la Tienda 1 podía ver/anular/pagar gastos de la Tienda 2. Fix: se agregó el mismo patrón (`id_punto_venta: null` = alcance general, visible para todos; con valor = solo esa tienda o superadmin).
7. **Condición de carrera al pagar un Gasto**: dos solicitudes de pago simultáneas sobre el mismo gasto podían generar dos movimientos de egreso en Caja para un solo gasto. Fix: `gastos.service.ts.pagar()` usa `updateMany({ where: { id, pagado: false } })` dentro de una transacción `Serializable` y revisa el `count` del resultado, en vez de un `findFirst` seguido de `update` (que deja una ventana de carrera).
8. **Reportes de Ventas/Compras incluían comprobantes anulados** en los totales — `reportes.service.ts` (`reporteVentas`/`reporteCompras`) ahora excluye `estado_venta: 'anulada'` / `estado: 'anulada'`.
9. **`DispositivoGuard` no respetaba `@Public()`**: se ejecutaba incluso en rutas públicas (ej. login), evaluando datos de request antes de que hubiera sesión. Fix: inyecta `Reflector` y sale temprano si la ruta tiene `@Public()`. Confirmado que hoy es un no-op real (el frontend nunca manda `X-Device-Token`), pero queda correcto para cuando se use.
10. **Mensajes de error crudos en producción**: `GlobalExceptionFilter` devolvía el `.message` de cualquier excepción no controlada (podía filtrar detalles internos, ej. de Prisma). Fix: en producción (`NODE_ENV`), los errores que no son `HttpException` se sanitizan a un mensaje genérico.
11. **Duplicados (`P2002` de Prisma) sin manejar** en `clientes`, `proveedores` y `productos` (`create()`): el usuario veía un error 500 genérico en vez de un mensaje claro de "ya existe". Fix: helper nuevo `relanzarSiEsDuplicado()` (`backend/src/common/utils/prisma-errors.util.ts`), usado en los 3 services con try/catch alrededor del `create()`.
12. **`AuditInterceptor` no redactaba campos sensibles**: el log de auditoría (`tbl_auditoria`) guardaba el body completo de cada request, incluidas contraseñas y tokens en texto plano. Fix: `CAMPOS_SENSIBLES` (`password`, `password_hash`, `refresh_token(_hash)`, `access_token`, `token`, `secret`) + `redactar()`, que recorre el objeto pero solo entra en objetos planos (`Object.getPrototypeOf(v) === Object.prototype`) para no romper `Date`/`Decimal` al redactar.
13. **`POST /caja` sin DTO validado**: `caja.service.ts.createCaja()` recibía `dto: any` sin ningún `class-validator`. Fix: `CreateCajaDto` con validadores explícitos.

**Estado**: los 13 hallazgos corregidos y verificados (`tsc --noEmit` limpio en ambos proyectos; los de mayor riesgo — fuga de `password_hash`, escalación de privilegios, reversión de caja al anular venta — se probaron en vivo contra el backend real, no solo por tipos). No se encontraron vulnerabilidades de inyección SQL (Prisma parametriza todo) ni XSS obvio (React escapa por defecto, no hay `dangerouslySetInnerHTML` en el repo).

## 17. Caja: el cuadre/arqueo ya no lo desvían los pagos no-efectivo (2026-09-19)

**El problema**: el usuario pidió revisar que el Arqueo/Cuadre de Caja funcionara bien. Investigando el cálculo del "saldo esperado por sistema" (`calcularSaldoSistema()` en `caja.service.ts`), se encontró que sumaba **todos** los movimientos de `tbl_movimientos_caja` de la apertura, sin importar el método de pago — es decir, una venta cobrada por Yape o tarjeta sumaba al saldo esperado de **efectivo físico**, aunque ese dinero nunca entró a la caja física. Esto hacía que cualquier venta con método de pago distinto a efectivo generara un "faltante" falso al arquear o cerrar caja.

**Fix**:
- `tbl_metodos_pago` (schema + migración `20260919142256_metodos_pago_es_efectivo`): columna nueva `es_efectivo Boolean @default(false)`, poblada por la migración (`UPDATE ... SET es_efectivo=true WHERE codigo='EFE' OR nombre='EFECTIVO'`) y en `seed.ts` (cada método de pago del seed ahora declara `es_efectivo: true/false`).
- `caja.service.ts`: `FILTRO_MOVIMIENTO_EFECTIVO = { OR: [{ id_metodo_pago: null }, { metodo_pago: { es_efectivo: true } }] }` (movimientos manuales sin método de pago asociado —`id_metodo_pago: null`— se siguen contando como efectivo, ya que son ingresos/egresos manuales de caja). Aplicado tanto en `calcularSaldoSistema()` (usado por Cierre y Arqueo) como en `getResumenCaja()` (los totales de ingresos/egresos que se muestran en pantalla).

**Estado**: implementado, migración aplicada, verificado en vivo con Claude-in-Chrome (venta en efectivo sí afecta el saldo esperado, venta con otro método de pago ya no).

## 18. Gastos vinculados con sus egresos de Caja (2026-09-19)

**Pedido**: poder relacionar un Gasto con el movimiento de egreso de Caja que generó su pago (y viceversa), para que sean trazables en ambos sentidos — mismo patrón que ya existía para Ventas/Kardex.

**Qué se hizo**:
- `frontend-react/src/types/caja.ts`: `MovimientoCaja` ganó `id_referencia`/`tipo_referencia` (ya venían del backend, solo faltaba tiparlos).
- `CajaResumenVista.tsx`: columna nueva "Ver documento" (ícono de ojo) en la tabla de movimientos, que abre `VentaDetalleModal`/`GastoDetalleModal` según `tipo_referencia` — mismo patrón ya usado en Kardex.
- `CajaPage.tsx` (`MovimientoModal`): al registrar un egreso manual, aparece un select "¿Es el pago de un gasto pendiente?"; si se elige un gasto, el modal llama a `gastosApi.pagar()` en vez de `cajaApi.movimiento()` — unificando los dos puntos de entrada (pagar desde Gastos, o registrar el egreso desde Caja) en el mismo flujo de negocio, para que ambos generen el vínculo `id_referencia`/`tipo_referencia:'gasto'` correctamente.

**Estado**: implementado, `tsc --noEmit` limpio.

## 19. Kardex: Notas de Crédito de Compra ya no pueden sobre-acreditar (2026-09-19)

**El problema**: revisando el Kardex a pedido del usuario, se encontró que `compras.service.ts.crearNotaCreditoCompra()` no llevaba la cuenta de cuánto de cada línea de una compra ya había sido acreditado por Notas de Crédito anteriores — se podía registrar más de una NC sobre la misma compra y terminar acreditando (y sacando de stock) más cantidad de la que realmente se compró. Mismo tipo de bug que ya se había corregido antes del lado de Ventas (acreditar de más una venta), pero no se había replicado en Compras.

**Fix**: `crearNotaCreditoCompra()` ahora suma, por `(id_producto, precio_unitario_pen)`, la cantidad ya acreditada en NCs previas no anuladas de la misma compra, y rechaza la nueva NC si se pasa del disponible. También se bloqueó anular una Compra si ya tiene una NC activa (`id_compra_original`) — mismo criterio que ya existía para Ventas (ver §16, punto 5).

**Relacionado — aclarado, no es un bug**: el switch "Implica devolución física de mercadería al proveedor (descuenta stock)" (`afecta_stock` en el DTO) ya permitía registrar una NC de Compra **sin** tocar stock, para el caso de una factura vieja donde el stock ya se había sacado a mano con un Ajuste de Inventario antes de que llegara la NC del proveedor. La funcionalidad ya estaba bien — solo se agregó un texto de ayuda debajo del switch aclarando explícitamente ese caso, porque no era obvio a partir del label solo.

**Estado**: implementado, `tsc --noEmit` limpio.

## 20. Reportes reorganizados en páginas dedicadas (2026-09-19)

**El problema**: todos los reportes vivían en una sola pantalla con pestañas (`ReportesPage.tsx`: Ventas, Compras, Inventario, Auditoría) — sin gráficos, sin desglose por producto/marca/tienda, y el reporte de Toma de Inventario todavía no existía como tal (el módulo de Toma de Inventario en sí ya existía, pero no había una vista de reporte/análisis de sus resultados).

**Qué se agregó** (todo nuevo, no reemplaza lo existente salvo un punto abajo):
- **Reporte de Ventas Agrupadas** (`VentasAgrupadoVista.tsx`, componente compartido) — filtros de fecha y punto de venta, KPIs, gráfico de barras (top 15) con `@ant-design/plots`, tabla ordenable, export a Excel. Tres páginas delgadas sobre el mismo componente: **Ventas por Producto**, **Ventas por Marca**, **Ventas por Punto de Venta** (`/reportes/ventas-por-producto|marca|punto-venta`). Backend: `GET /reportes/ventas-agrupado?agrupar_por=producto|marca|punto_venta` (une `tbl_detalle_ventas`→`tbl_ventas`, excluye canjeadas/anuladas/cotizaciones, resta las Notas de Crédito) + export a Excel.
  - **Alcance decidido con el usuario**: por ahora solo ingresos (S/) y unidades — margen/utilidad queda para una fase 2 (ver §9).
- **Reporte de Toma de Inventario** (`TomaInventarioReportePage.tsx`, nuevo) — filtros (fecha, producto, tipo de diferencia), KPIs (conteos, faltan, sobran, valor neto), gráfico de barras con color por tipo (rojo=Falta, verde=Sobra), tabla, export a Excel. Backend: `reporteTomasInventario()` ampliado con `valor_diferencia` por línea (`diferencia × costo_promedio`) y un ranking `porProducto`.
- **Aclaración de texto** (encontrada de paso mientras se revisaba este reporte): el `@ApiOperation summary` del endpoint `PATCH /toma-inventario/:id/finalizar` decía que aplicaba correcciones de stock — no es así, "Finalizar" solo congela el conteo; la corrección de stock se hace aparte, a mano, vía Ajustes de Inventario. El texto del frontend ya estaba bien, se corrigió solo el de Swagger.
- **Retirada la pestaña "Tomas de Inventario"** del `ReportesPage.tsx` viejo (reemplazada por la página nueva). Las demás pestañas (Ventas, Compras, Inventario, Auditoría) siguen ahí — el usuario decidió migrar de a poco, no de una vez (ver §9).
- `menu.ts` / `App.tsx`: grupo "Reportes" ahora tiene 5 ítems — los 4 nuevos + "Ventas, Compras, Inventario y Auditoría" (la pantalla vieja, con ese nombre para que quede claro qué le falta migrar).

**Estado**: implementado, `tsc --noEmit` limpio en ambos proyectos, verificado en vivo con Claude-in-Chrome (incluida una corrección del eje/orden de las barras de `@ant-design/plots`, que no se comportaba como la documentación sugiere — ver detalle técnico en `CLAUDE.md` si hace falta tocar gráficos de nuevo).

## 21. Importación masiva de catálogo de Productos (2026-09-19)

**Pedido**: poder cargar el catálogo de productos en lote (no uno por uno desde el formulario), con una plantilla descargable que indique los campos necesarios y sus opciones válidas.

**Qué se hizo** (módulo nuevo dentro de Productos, `ProductoImportacionService` — mismo patrón que `CompraXmlService` en Compras: un service aparte inyectado en el mismo `ProductosModule`, no todo amontonado en `productos.service.ts`):

- **`GET /productos/importar/plantilla`** — genera un `.xlsx` (ExcelJS) con 3 hojas: *Instrucciones* (qué es cada columna, obligatorio vs. opcional), *Listas* (valores válidos de unidad de medida/categoría/marca/tipo de existencia/almacén — también sirve de fuente para los desplegables) y *Productos* (una fila de ejemplo + validaciones de Excel que bloquean valores fuera de lista en unidad/tipo/IGV/almacén). Las columnas de precio de venta se arman dinámicamente según los márgenes **activos** en `tbl_config_margenes` (hoy 3: Minorista/Mayorista/Distribuidor — ver §12), con el nombre real del margen en el encabezado.
- **`POST /productos/importar`** (`{ file_base64 }`) — procesa el Excel fila por fila, cada una en su propia transacción independiente (si una fila falla, las demás igual se crean). Por fila: valida código no repetido (ni dentro del archivo ni contra el catálogo existente) y unidad de medida reconocida; **categoría y marca se crean automáticamente** si el nombre no existe (a diferencia de unidad de medida, que debe matchear exacto — por los códigos SUNAT); si la fila trae `stock_inicial > 0`, registra un movimiento real de "Carga inicial de inventario" (mismo mecanismo que ya usa `POST /inventario/inicializar`, con Kardex incluido) en el almacén indicado o, si no se especifica, en el almacén marcado como principal. Devuelve un resumen `{ total, creados, errores, detalle: [{fila, codigo, ok, mensaje}] }`.
- **Frontend**: botón "Importar catálogo" en `ProductosPage.tsx` → `ImportarProductosModal.tsx` (nuevo): descargar plantilla, subir archivo completado (se lee como base64 en el navegador, no hay subida multipart — mismo patrón ya usado por la importación de XML de Compras), tabla de resultados fila por fila.
- **Fuera de alcance a propósito**: códigos alternos por proveedor (`tbl_producto_codigos_proveedor`) no se importan en lote — se siguen cargando desde el formulario normal del producto, uno por uno.

**Bug encontrado y corregido antes de terminar**: la plantilla generaba columnas de precio solo para los márgenes *activos* (hoy 3), pero el parser de importación al principio contaba *todos* los márgenes configurados (activos e inactivos, 5) para saber en qué columna esperar cada precio — con esta instalación (que tiene 2 márgenes desactivados) las columnas quedaban desalineadas y la columna "descripción" se habría leído como si fuera un precio. Se corrigió filtrando `activo: true` también en el import, igual que ya hacía la generación de la plantilla.

**Estado**: implementado y verificado extremo a extremo contra la API real (no solo por tipos): se armó un Excel de prueba con una fila válida, una con unidad inválida y una con código duplicado dentro del mismo archivo, y el resultado coincidió exactamente con lo esperado (1 creado con stock/categoría/marca/costo correctos verificados en Kardex e Inventario, 2 rechazados con el mensaje correcto). Los datos de prueba (producto, categoría y marca) se borraron al terminar. `tsc --noEmit` limpio en ambos proyectos.
