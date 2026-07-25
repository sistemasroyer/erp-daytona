-- CreateEnum
CREATE TYPE "AccionPermiso" AS ENUM ('ver', 'crear', 'editar', 'eliminar', 'aprobar', 'anular');

-- CreateEnum
CREATE TYPE "EstadoDispositivo" AS ENUM ('pendiente', 'aprobado', 'bloqueado');

-- CreateEnum
CREATE TYPE "TipoDocumentoCliente" AS ENUM ('DNI', 'RUC', 'CE', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "TipoDocumentoSunat" AS ENUM ('FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "EstadoSunat" AS ENUM ('pendiente', 'enviado', 'aceptado', 'rechazado', 'error');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('vigente', 'anulada');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('PEN', 'USD');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('entrada', 'salida', 'ajuste_positivo', 'ajuste_negativo', 'transferencia_entrada', 'transferencia_salida');

-- CreateEnum
CREATE TYPE "TipoReferenciaMovimiento" AS ENUM ('venta', 'compra', 'ajuste', 'transferencia', 'inventario_inicial');

-- CreateEnum
CREATE TYPE "MetodoValuacion" AS ENUM ('peps', 'ueps', 'promedio');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('borrador', 'aprobado', 'convertido', 'anulado');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('borrador', 'registrada', 'anulada');

-- CreateEnum
CREATE TYPE "TipoProrrateoFlete" AS ENUM ('precio', 'cantidad');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('abierta', 'cerrada');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('ingreso', 'egreso');

-- CreateEnum
CREATE TYPE "FuenteTipoCambio" AS ENUM ('manual', 'sunat');

-- CreateEnum
CREATE TYPE "TipoContratoPersonal" AS ENUM ('indefinido', 'plazo_fijo', 'services', 'practicas', 'locacion_servicios');

-- CreateEnum
CREATE TYPE "TipoOperacionAuditoria" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "tbl_empresas" (
    "id" TEXT NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "direccion" VARCHAR(500),
    "ubigeo" VARCHAR(6),
    "departamento" VARCHAR(100),
    "provincia" VARCHAR(100),
    "distrito" VARCHAR(100),
    "telefono" VARCHAR(20),
    "email" VARCHAR(150),
    "web" VARCHAR(200),
    "logo_path" VARCHAR(500),
    "cert_path" VARCHAR(500),
    "cert_password" VARCHAR(200),
    "clave_sol_usuario" VARCHAR(100),
    "clave_sol_password" VARCHAR(200),
    "modo_sunat" VARCHAR(10) NOT NULL DEFAULT 'mock',
    "regimen_tributario" VARCHAR(100),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_puntos_venta" (
    "id" TEXT NOT NULL,
    "id_empresa" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(500),
    "telefono" VARCHAR(20),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_puntos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_series_documento" (
    "id" TEXT NOT NULL,
    "id_punto_venta" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoSunat" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo_actual" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_series_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_roles" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "es_superadmin" BOOLEAN NOT NULL DEFAULT false,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_permisos" (
    "id" TEXT NOT NULL,
    "modulo" VARCHAR(100) NOT NULL,
    "submodulo" VARCHAR(100),
    "accion" "AccionPermiso" NOT NULL,
    "descripcion" VARCHAR(300),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_roles_permisos" (
    "id" TEXT NOT NULL,
    "id_rol" TEXT NOT NULL,
    "id_permiso" TEXT NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_usuarios" (
    "id" TEXT NOT NULL,
    "id_punto_venta" TEXT,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(200) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "dni" VARCHAR(8),
    "telefono" VARCHAR(20),
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "ultimo_acceso" TIMESTAMP(3),
    "refresh_token_hash" VARCHAR(200),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_usuarios_roles" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "id_rol" TEXT NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_usuarios_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_dispositivos" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "navegador" VARCHAR(200),
    "sistema_operativo" VARCHAR(100),
    "user_agent" VARCHAR(500),
    "token_dispositivo" VARCHAR(64) NOT NULL,
    "estado" "EstadoDispositivo" NOT NULL DEFAULT 'pendiente',
    "ultimo_uso" TIMESTAMP(3),
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_dispositivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_logs_acceso" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT,
    "email" VARCHAR(150),
    "ip" VARCHAR(45) NOT NULL,
    "accion" VARCHAR(100) NOT NULL,
    "resultado" VARCHAR(20) NOT NULL,
    "detalle" VARCHAR(500),
    "user_agent" VARCHAR(500),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_logs_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_auditoria" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT,
    "tabla" VARCHAR(100) NOT NULL,
    "id_registro" VARCHAR(36) NOT NULL,
    "operacion" "TipoOperacionAuditoria" NOT NULL,
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "ip" VARCHAR(45),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_categorias" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_subcategorias" (
    "id" TEXT NOT NULL,
    "id_categoria" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_subcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_marcas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_marcas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_unidades_medida" (
    "id" TEXT NOT NULL,
    "codigo_sunat" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(100) NOT NULL,
    "simbolo" VARCHAR(10) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_almacenes" (
    "id" TEXT NOT NULL,
    "id_empresa" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "direccion" VARCHAR(500),
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_clientes" (
    "id" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoCliente" NOT NULL DEFAULT 'RUC',
    "numero_documento" VARCHAR(15) NOT NULL,
    "razon_social" VARCHAR(250) NOT NULL,
    "nombre_comercial" VARCHAR(250),
    "direccion" VARCHAR(500),
    "ubigeo" VARCHAR(6),
    "departamento" VARCHAR(100),
    "provincia" VARCHAR(100),
    "distrito" VARCHAR(100),
    "email" VARCHAR(150),
    "telefono" VARCHAR(20),
    "limite_credito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dias_credito" INTEGER NOT NULL DEFAULT 0,
    "es_habitual" BOOLEAN NOT NULL DEFAULT false,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_proveedores" (
    "id" TEXT NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(250) NOT NULL,
    "nombre_comercial" VARCHAR(250),
    "direccion" VARCHAR(500),
    "ubigeo" VARCHAR(6),
    "departamento" VARCHAR(100),
    "provincia" VARCHAR(100),
    "distrito" VARCHAR(100),
    "email" VARCHAR(150),
    "telefono" VARCHAR(20),
    "contacto" VARCHAR(150),
    "cuenta_detraccion" VARCHAR(50),
    "banco_detraccion" VARCHAR(100),
    "porcentaje_detraccion" DECIMAL(5,2),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_productos" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "codigo_alterno" VARCHAR(50),
    "codigo_barras" VARCHAR(50),
    "codigo_sunat" VARCHAR(20),
    "nombre" VARCHAR(250) NOT NULL,
    "descripcion" TEXT,
    "id_categoria" TEXT,
    "id_subcategoria" TEXT,
    "id_marca" TEXT,
    "id_unidad_medida" TEXT NOT NULL,
    "ubicacion" VARCHAR(100),
    "tipo_existencia" VARCHAR(10),
    "afecta_igv" BOOLEAN NOT NULL DEFAULT true,
    "tiene_serie" BOOLEAN NOT NULL DEFAULT false,
    "tiene_lote" BOOLEAN NOT NULL DEFAULT false,
    "stock_actual" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stock_maximo" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_compra_sin_igv" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_compra_con_igv" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_venta_1" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_venta_2" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_venta_3" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_venta_4" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_venta_5" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "costo_promedio" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "fecha_ultima_compra" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "imagen_path" VARCHAR(500),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_inventario" (
    "id" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "id_almacen" TEXT NOT NULL,
    "stock_actual" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stock_reservado" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_movimientos_inventario" (
    "id" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "id_almacen" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "motivo" VARCHAR(300),
    "cantidad" DECIMAL(12,4) NOT NULL,
    "stock_antes" DECIMAL(12,4) NOT NULL,
    "stock_despues" DECIMAL(12,4) NOT NULL,
    "costo_unitario" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "id_referencia" VARCHAR(36),
    "tipo_referencia" "TipoReferenciaMovimiento",
    "id_usuario" VARCHAR(36),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_kardex" (
    "id" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "id_almacen" TEXT NOT NULL,
    "id_movimiento" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo_movimiento" VARCHAR(50) NOT NULL,
    "cantidad_entrada" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "cantidad_salida" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "costo_unitario" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "costo_total" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stock_resultante" DECIMAL(12,4) NOT NULL,
    "metodo_valuacion" "MetodoValuacion" NOT NULL DEFAULT 'promedio',
    "id_referencia" VARCHAR(36),
    "tipo_referencia" VARCHAR(50),
    "descripcion" VARCHAR(300),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_kardex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_metodos_pago" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codigo" VARCHAR(20),
    "requiere_referencia" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_ventas" (
    "id" TEXT NOT NULL,
    "numero_interno" VARCHAR(20) NOT NULL,
    "id_serie_documento" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoSunat" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "numero_comprobante" VARCHAR(15) NOT NULL,
    "id_cliente" TEXT NOT NULL,
    "id_punto_venta" TEXT,
    "id_usuario_vendedor" TEXT NOT NULL,
    "id_caja_apertura" TEXT,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3),
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "otros_cargos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "observaciones" VARCHAR(500),
    "estado_sunat" "EstadoSunat" NOT NULL DEFAULT 'pendiente',
    "estado_venta" "EstadoVenta" NOT NULL DEFAULT 'vigente',
    "motivo_anulacion" VARCHAR(300),
    "id_nota_original" VARCHAR(36),
    "motivo_nota" VARCHAR(300),
    "codigo_motivo_nota" VARCHAR(5),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_detalle_ventas" (
    "id" TEXT NOT NULL,
    "id_venta" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "descripcion" VARCHAR(300),
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precio_tipo" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(12,4) NOT NULL,
    "descuento" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valor_unitario" DECIMAL(12,4) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "afecta_igv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tbl_detalle_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_pagos" (
    "id" TEXT NOT NULL,
    "id_venta" TEXT NOT NULL,
    "id_metodo_pago" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia" VARCHAR(100),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_compras" (
    "id" TEXT NOT NULL,
    "numero_interno" VARCHAR(20) NOT NULL,
    "tipo_documento" VARCHAR(30) NOT NULL,
    "serie" VARCHAR(4),
    "numero" VARCHAR(10),
    "id_proveedor" TEXT NOT NULL,
    "id_almacen" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "id_orden_compra" VARCHAR(36),
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3),
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "flete_monto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "flete_moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "flete_tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "flete_monto_pen" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "flete_tipo_prorrateo" "TipoProrrateoFlete" NOT NULL DEFAULT 'precio',
    "estado" "EstadoCompra" NOT NULL DEFAULT 'borrador',
    "observaciones" VARCHAR(500),
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_detalle_compras" (
    "id" TEXT NOT NULL,
    "id_compra" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "descripcion" VARCHAR(300),
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precio_unitario" DECIMAL(12,4) NOT NULL,
    "precio_unitario_pen" DECIMAL(12,4) NOT NULL,
    "costo_flete_prorrateado" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "costo_unitario_total" DECIMAL(12,4) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "afecta_igv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tbl_detalle_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_ordenes_compra" (
    "id" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "id_proveedor" TEXT NOT NULL,
    "id_usuario_solicitante" TEXT NOT NULL,
    "id_usuario_aprobador" TEXT,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_aprobacion" TIMESTAMP(3),
    "fecha_requerida" TIMESTAMP(3),
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "total_estimado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'borrador',
    "observaciones" VARCHAR(500),
    "id_compra_generada" VARCHAR(36),
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_detalle_ordenes_compra" (
    "id" TEXT NOT NULL,
    "id_orden" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "descripcion" VARCHAR(300),
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precio_referencial" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "subtotal_estimado" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_detalle_ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_cajas" (
    "id" TEXT NOT NULL,
    "id_punto_venta" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_cajas_aperturas" (
    "id" TEXT NOT NULL,
    "id_caja" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "monto_apertura" DECIMAL(12,2) NOT NULL,
    "monto_cierre" DECIMAL(12,2),
    "monto_sistema" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "observaciones_cierre" VARCHAR(500),
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),
    "estado" "EstadoCaja" NOT NULL DEFAULT 'abierta',
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_cajas_aperturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_movimientos_caja" (
    "id" TEXT NOT NULL,
    "id_caja_apertura" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "concepto" VARCHAR(300) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "id_referencia" VARCHAR(36),
    "tipo_referencia" VARCHAR(50),
    "id_usuario" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_tipos_cambio" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "compra" DECIMAL(10,4) NOT NULL,
    "venta" DECIMAL(10,4) NOT NULL,
    "fuente" "FuenteTipoCambio" NOT NULL DEFAULT 'manual',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_tipos_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_personal" (
    "id" TEXT NOT NULL,
    "dni" VARCHAR(8) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "cargo" VARCHAR(100),
    "area" VARCHAR(100),
    "fecha_ingreso" TIMESTAMP(3) NOT NULL,
    "fecha_cese" TIMESTAMP(3),
    "sueldo" DECIMAL(12,2) NOT NULL,
    "cuenta_bancaria" VARCHAR(50),
    "banco" VARCHAR(100),
    "cci" VARCHAR(50),
    "tipo_contrato" "TipoContratoPersonal" NOT NULL DEFAULT 'indefinido',
    "email" VARCHAR(150),
    "telefono" VARCHAR(20),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_sunat_envios" (
    "id" TEXT NOT NULL,
    "id_venta" TEXT NOT NULL,
    "tipo_documento" VARCHAR(5) NOT NULL,
    "nombre_xml" VARCHAR(100) NOT NULL,
    "xml_sin_firma" TEXT,
    "xml_firmado" TEXT,
    "hash_xml" VARCHAR(100),
    "zip_base64" TEXT,
    "fecha_envio" TIMESTAMP(3),
    "intento_numero" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoSunat" NOT NULL DEFAULT 'pendiente',
    "id_job_bullmq" VARCHAR(100),
    "error_mensaje" VARCHAR(500),
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_sunat_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_sunat_respuestas" (
    "id" TEXT NOT NULL,
    "id_envio" TEXT NOT NULL,
    "codigo_respuesta" VARCHAR(10),
    "descripcion_respuesta" VARCHAR(500),
    "cdr_xml" TEXT,
    "cdr_base64" TEXT,
    "es_exitoso" BOOLEAN NOT NULL DEFAULT false,
    "fecha_respuesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_sunat_respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_empresas_ruc_key" ON "tbl_empresas"("ruc");

-- CreateIndex
CREATE INDEX "tbl_empresas_ruc_idx" ON "tbl_empresas"("ruc");

-- CreateIndex
CREATE INDEX "tbl_puntos_venta_id_empresa_idx" ON "tbl_puntos_venta"("id_empresa");

-- CreateIndex
CREATE INDEX "tbl_series_documento_id_punto_venta_idx" ON "tbl_series_documento"("id_punto_venta");

-- CreateIndex
CREATE INDEX "tbl_series_documento_tipo_documento_serie_idx" ON "tbl_series_documento"("tipo_documento", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_series_documento_id_punto_venta_tipo_documento_serie_key" ON "tbl_series_documento"("id_punto_venta", "tipo_documento", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_roles_nombre_key" ON "tbl_roles"("nombre");

-- CreateIndex
CREATE INDEX "tbl_permisos_modulo_idx" ON "tbl_permisos"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_permisos_modulo_accion_key" ON "tbl_permisos"("modulo", "accion");

-- CreateIndex
CREATE INDEX "tbl_roles_permisos_id_rol_idx" ON "tbl_roles_permisos"("id_rol");

-- CreateIndex
CREATE INDEX "tbl_roles_permisos_id_permiso_idx" ON "tbl_roles_permisos"("id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_roles_permisos_id_rol_id_permiso_key" ON "tbl_roles_permisos"("id_rol", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_email_key" ON "tbl_usuarios"("email");

-- CreateIndex
CREATE INDEX "tbl_usuarios_email_idx" ON "tbl_usuarios"("email");

-- CreateIndex
CREATE INDEX "tbl_usuarios_id_punto_venta_idx" ON "tbl_usuarios"("id_punto_venta");

-- CreateIndex
CREATE INDEX "tbl_usuarios_roles_id_usuario_idx" ON "tbl_usuarios_roles"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_roles_id_usuario_id_rol_key" ON "tbl_usuarios_roles"("id_usuario", "id_rol");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_dispositivos_token_dispositivo_key" ON "tbl_dispositivos"("token_dispositivo");

-- CreateIndex
CREATE INDEX "tbl_dispositivos_id_usuario_idx" ON "tbl_dispositivos"("id_usuario");

-- CreateIndex
CREATE INDEX "tbl_dispositivos_token_dispositivo_idx" ON "tbl_dispositivos"("token_dispositivo");

-- CreateIndex
CREATE INDEX "tbl_logs_acceso_id_usuario_idx" ON "tbl_logs_acceso"("id_usuario");

-- CreateIndex
CREATE INDEX "tbl_logs_acceso_fecha_idx" ON "tbl_logs_acceso"("fecha");

-- CreateIndex
CREATE INDEX "tbl_logs_acceso_ip_idx" ON "tbl_logs_acceso"("ip");

-- CreateIndex
CREATE INDEX "tbl_auditoria_id_usuario_idx" ON "tbl_auditoria"("id_usuario");

-- CreateIndex
CREATE INDEX "tbl_auditoria_tabla_id_registro_idx" ON "tbl_auditoria"("tabla", "id_registro");

-- CreateIndex
CREATE INDEX "tbl_auditoria_fecha_idx" ON "tbl_auditoria"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_categorias_nombre_key" ON "tbl_categorias"("nombre");

-- CreateIndex
CREATE INDEX "tbl_subcategorias_id_categoria_idx" ON "tbl_subcategorias"("id_categoria");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_subcategorias_id_categoria_nombre_key" ON "tbl_subcategorias"("id_categoria", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_marcas_nombre_key" ON "tbl_marcas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_unidades_medida_codigo_sunat_key" ON "tbl_unidades_medida"("codigo_sunat");

-- CreateIndex
CREATE INDEX "tbl_almacenes_id_empresa_idx" ON "tbl_almacenes"("id_empresa");

-- CreateIndex
CREATE INDEX "tbl_clientes_numero_documento_idx" ON "tbl_clientes"("numero_documento");

-- CreateIndex
CREATE INDEX "tbl_clientes_razon_social_idx" ON "tbl_clientes"("razon_social");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_clientes_tipo_documento_numero_documento_key" ON "tbl_clientes"("tipo_documento", "numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_proveedores_ruc_key" ON "tbl_proveedores"("ruc");

-- CreateIndex
CREATE INDEX "tbl_proveedores_ruc_idx" ON "tbl_proveedores"("ruc");

-- CreateIndex
CREATE INDEX "tbl_proveedores_razon_social_idx" ON "tbl_proveedores"("razon_social");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_productos_codigo_key" ON "tbl_productos"("codigo");

-- CreateIndex
CREATE INDEX "tbl_productos_codigo_idx" ON "tbl_productos"("codigo");

-- CreateIndex
CREATE INDEX "tbl_productos_nombre_idx" ON "tbl_productos"("nombre");

-- CreateIndex
CREATE INDEX "tbl_productos_id_categoria_idx" ON "tbl_productos"("id_categoria");

-- CreateIndex
CREATE INDEX "tbl_inventario_id_producto_idx" ON "tbl_inventario"("id_producto");

-- CreateIndex
CREATE INDEX "tbl_inventario_id_almacen_idx" ON "tbl_inventario"("id_almacen");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_inventario_id_producto_id_almacen_key" ON "tbl_inventario"("id_producto", "id_almacen");

-- CreateIndex
CREATE INDEX "tbl_movimientos_inventario_id_producto_idx" ON "tbl_movimientos_inventario"("id_producto");

-- CreateIndex
CREATE INDEX "tbl_movimientos_inventario_id_almacen_idx" ON "tbl_movimientos_inventario"("id_almacen");

-- CreateIndex
CREATE INDEX "tbl_movimientos_inventario_fecha_idx" ON "tbl_movimientos_inventario"("fecha");

-- CreateIndex
CREATE INDEX "tbl_movimientos_inventario_id_referencia_idx" ON "tbl_movimientos_inventario"("id_referencia");

-- CreateIndex
CREATE INDEX "tbl_kardex_id_producto_id_almacen_idx" ON "tbl_kardex"("id_producto", "id_almacen");

-- CreateIndex
CREATE INDEX "tbl_kardex_fecha_idx" ON "tbl_kardex"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_metodos_pago_nombre_key" ON "tbl_metodos_pago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_ventas_numero_interno_key" ON "tbl_ventas"("numero_interno");

-- CreateIndex
CREATE INDEX "tbl_ventas_id_cliente_idx" ON "tbl_ventas"("id_cliente");

-- CreateIndex
CREATE INDEX "tbl_ventas_id_usuario_vendedor_idx" ON "tbl_ventas"("id_usuario_vendedor");

-- CreateIndex
CREATE INDEX "tbl_ventas_fecha_emision_idx" ON "tbl_ventas"("fecha_emision");

-- CreateIndex
CREATE INDEX "tbl_ventas_estado_sunat_idx" ON "tbl_ventas"("estado_sunat");

-- CreateIndex
CREATE INDEX "tbl_ventas_numero_comprobante_idx" ON "tbl_ventas"("numero_comprobante");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_ventas_serie_correlativo_tipo_documento_key" ON "tbl_ventas"("serie", "correlativo", "tipo_documento");

-- CreateIndex
CREATE INDEX "tbl_detalle_ventas_id_venta_idx" ON "tbl_detalle_ventas"("id_venta");

-- CreateIndex
CREATE INDEX "tbl_detalle_ventas_id_producto_idx" ON "tbl_detalle_ventas"("id_producto");

-- CreateIndex
CREATE INDEX "tbl_pagos_id_venta_idx" ON "tbl_pagos"("id_venta");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_compras_numero_interno_key" ON "tbl_compras"("numero_interno");

-- CreateIndex
CREATE INDEX "tbl_compras_id_proveedor_idx" ON "tbl_compras"("id_proveedor");

-- CreateIndex
CREATE INDEX "tbl_compras_id_almacen_idx" ON "tbl_compras"("id_almacen");

-- CreateIndex
CREATE INDEX "tbl_compras_fecha_emision_idx" ON "tbl_compras"("fecha_emision");

-- CreateIndex
CREATE INDEX "tbl_detalle_compras_id_compra_idx" ON "tbl_detalle_compras"("id_compra");

-- CreateIndex
CREATE INDEX "tbl_detalle_compras_id_producto_idx" ON "tbl_detalle_compras"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_ordenes_compra_numero_key" ON "tbl_ordenes_compra"("numero");

-- CreateIndex
CREATE INDEX "tbl_ordenes_compra_id_proveedor_idx" ON "tbl_ordenes_compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "tbl_ordenes_compra_estado_idx" ON "tbl_ordenes_compra"("estado");

-- CreateIndex
CREATE INDEX "tbl_detalle_ordenes_compra_id_orden_idx" ON "tbl_detalle_ordenes_compra"("id_orden");

-- CreateIndex
CREATE INDEX "tbl_cajas_id_punto_venta_idx" ON "tbl_cajas"("id_punto_venta");

-- CreateIndex
CREATE INDEX "tbl_cajas_aperturas_id_caja_idx" ON "tbl_cajas_aperturas"("id_caja");

-- CreateIndex
CREATE INDEX "tbl_cajas_aperturas_id_usuario_idx" ON "tbl_cajas_aperturas"("id_usuario");

-- CreateIndex
CREATE INDEX "tbl_cajas_aperturas_estado_idx" ON "tbl_cajas_aperturas"("estado");

-- CreateIndex
CREATE INDEX "tbl_movimientos_caja_id_caja_apertura_idx" ON "tbl_movimientos_caja"("id_caja_apertura");

-- CreateIndex
CREATE INDEX "tbl_movimientos_caja_fecha_idx" ON "tbl_movimientos_caja"("fecha");

-- CreateIndex
CREATE INDEX "tbl_tipos_cambio_fecha_idx" ON "tbl_tipos_cambio"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_tipos_cambio_fecha_key" ON "tbl_tipos_cambio"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_personal_dni_key" ON "tbl_personal"("dni");

-- CreateIndex
CREATE INDEX "tbl_personal_dni_idx" ON "tbl_personal"("dni");

-- CreateIndex
CREATE INDEX "tbl_personal_apellidos_idx" ON "tbl_personal"("apellidos");

-- CreateIndex
CREATE INDEX "tbl_sunat_envios_id_venta_idx" ON "tbl_sunat_envios"("id_venta");

-- CreateIndex
CREATE INDEX "tbl_sunat_envios_estado_idx" ON "tbl_sunat_envios"("estado");

-- CreateIndex
CREATE INDEX "tbl_sunat_respuestas_id_envio_idx" ON "tbl_sunat_respuestas"("id_envio");

-- AddForeignKey
ALTER TABLE "tbl_puntos_venta" ADD CONSTRAINT "tbl_puntos_venta_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "tbl_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_series_documento" ADD CONSTRAINT "tbl_series_documento_id_punto_venta_fkey" FOREIGN KEY ("id_punto_venta") REFERENCES "tbl_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_roles_permisos" ADD CONSTRAINT "tbl_roles_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "tbl_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_roles_permisos" ADD CONSTRAINT "tbl_roles_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "tbl_permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_usuarios" ADD CONSTRAINT "tbl_usuarios_id_punto_venta_fkey" FOREIGN KEY ("id_punto_venta") REFERENCES "tbl_puntos_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_usuarios_roles" ADD CONSTRAINT "tbl_usuarios_roles_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_usuarios_roles" ADD CONSTRAINT "tbl_usuarios_roles_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "tbl_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_dispositivos" ADD CONSTRAINT "tbl_dispositivos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_logs_acceso" ADD CONSTRAINT "tbl_logs_acceso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_auditoria" ADD CONSTRAINT "tbl_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_subcategorias" ADD CONSTRAINT "tbl_subcategorias_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "tbl_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_almacenes" ADD CONSTRAINT "tbl_almacenes_id_empresa_fkey" FOREIGN KEY ("id_empresa") REFERENCES "tbl_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_productos" ADD CONSTRAINT "tbl_productos_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "tbl_categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_productos" ADD CONSTRAINT "tbl_productos_id_subcategoria_fkey" FOREIGN KEY ("id_subcategoria") REFERENCES "tbl_subcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_productos" ADD CONSTRAINT "tbl_productos_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "tbl_marcas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_productos" ADD CONSTRAINT "tbl_productos_id_unidad_medida_fkey" FOREIGN KEY ("id_unidad_medida") REFERENCES "tbl_unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_inventario" ADD CONSTRAINT "tbl_inventario_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_inventario" ADD CONSTRAINT "tbl_inventario_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "tbl_almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_movimientos_inventario" ADD CONSTRAINT "tbl_movimientos_inventario_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_kardex" ADD CONSTRAINT "tbl_kardex_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_kardex" ADD CONSTRAINT "tbl_kardex_id_movimiento_fkey" FOREIGN KEY ("id_movimiento") REFERENCES "tbl_movimientos_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_ventas" ADD CONSTRAINT "tbl_ventas_id_serie_documento_fkey" FOREIGN KEY ("id_serie_documento") REFERENCES "tbl_series_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_ventas" ADD CONSTRAINT "tbl_ventas_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "tbl_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_ventas" ADD CONSTRAINT "tbl_ventas_id_usuario_vendedor_fkey" FOREIGN KEY ("id_usuario_vendedor") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_ventas" ADD CONSTRAINT "tbl_detalle_ventas_id_venta_fkey" FOREIGN KEY ("id_venta") REFERENCES "tbl_ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_ventas" ADD CONSTRAINT "tbl_detalle_ventas_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_pagos" ADD CONSTRAINT "tbl_pagos_id_venta_fkey" FOREIGN KEY ("id_venta") REFERENCES "tbl_ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_pagos" ADD CONSTRAINT "tbl_pagos_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "tbl_metodos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_compras" ADD CONSTRAINT "tbl_compras_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "tbl_proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_compras" ADD CONSTRAINT "tbl_compras_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "tbl_almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_compras" ADD CONSTRAINT "tbl_compras_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_compras" ADD CONSTRAINT "tbl_detalle_compras_id_compra_fkey" FOREIGN KEY ("id_compra") REFERENCES "tbl_compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_compras" ADD CONSTRAINT "tbl_detalle_compras_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_ordenes_compra" ADD CONSTRAINT "tbl_ordenes_compra_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "tbl_proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_ordenes_compra" ADD CONSTRAINT "tbl_ordenes_compra_id_usuario_solicitante_fkey" FOREIGN KEY ("id_usuario_solicitante") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_ordenes_compra" ADD CONSTRAINT "tbl_ordenes_compra_id_usuario_aprobador_fkey" FOREIGN KEY ("id_usuario_aprobador") REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_ordenes_compra" ADD CONSTRAINT "tbl_detalle_ordenes_compra_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "tbl_ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_ordenes_compra" ADD CONSTRAINT "tbl_detalle_ordenes_compra_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_cajas" ADD CONSTRAINT "tbl_cajas_id_punto_venta_fkey" FOREIGN KEY ("id_punto_venta") REFERENCES "tbl_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_cajas_aperturas" ADD CONSTRAINT "tbl_cajas_aperturas_id_caja_fkey" FOREIGN KEY ("id_caja") REFERENCES "tbl_cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_cajas_aperturas" ADD CONSTRAINT "tbl_cajas_aperturas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_movimientos_caja" ADD CONSTRAINT "tbl_movimientos_caja_id_caja_apertura_fkey" FOREIGN KEY ("id_caja_apertura") REFERENCES "tbl_cajas_aperturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_movimientos_caja" ADD CONSTRAINT "tbl_movimientos_caja_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_sunat_envios" ADD CONSTRAINT "tbl_sunat_envios_id_venta_fkey" FOREIGN KEY ("id_venta") REFERENCES "tbl_ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_sunat_respuestas" ADD CONSTRAINT "tbl_sunat_respuestas_id_envio_fkey" FOREIGN KEY ("id_envio") REFERENCES "tbl_sunat_envios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
