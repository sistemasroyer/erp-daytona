import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed del ERP Daytona...\n');

  // ─── EMPRESA ────────────────────────────────────────────────────────────────
  console.log('📦 Creando empresa...');
  const empresa = await prisma.tbl_empresas.upsert({
    where: { ruc: '20123456789' },
    update: {},
    create: {
      ruc: '20123456789',
      razon_social: 'DAYTONA AUTOPARTES S.A.C.',
      nombre_comercial: 'DAYTONA AUTOPARTES',
      direccion: 'AV. PERU 916',
      ubigeo: '130001',
      departamento: 'LA LIBERTAD',
      provincia: 'TRUJILLO',
      distrito: 'TRUJILLO',
      telefono: '01-4441234',
      email: 'ventas@daytona.pe',
      regimen_tributario: 'RÉGIMEN GENERAL',
      modo_sunat: 'mock',
      usuario_creacion: 'seed',
    },
  });

  // ─── PUNTOS DE VENTA ────────────────────────────────────────────────────────
  console.log('🏪 Creando puntos de venta...');
  const pv1 = await prisma.tbl_puntos_venta.upsert({
    where: { id: '01' },
    update: {},
    create: {
      id: '01',
      id_empresa: empresa.id,
      nombre: 'TIENDA 1',
      direccion: 'AV. PERU 916',
      telefono: '01-4441234',
      usuario_creacion: 'seed',
    },
  });

  const pv2 = await prisma.tbl_puntos_venta.upsert({
    where: { id: '02' },
    update: {},
    create: {
      id: '02',
      id_empresa: empresa.id,
      nombre: 'TIENDA 2',
      direccion: 'AV. PERU 918',
      telefono: '01-4441234',
      usuario_creacion: 'seed',
    },
  });

  // ─── SERIES DE DOCUMENTO ────────────────────────────────────────────────────
  console.log('📄 Creando series de documento...');
  const seriesData = [
    { id_punto_venta: pv1.id, tipo_documento: 'FACTURA' as const, serie: 'F001' },
    { id_punto_venta: pv1.id, tipo_documento: 'BOLETA' as const, serie: 'B001' },
    { id_punto_venta: pv1.id, tipo_documento: 'NOTA_CREDITO' as const, serie: 'FC01' },
    { id_punto_venta: pv1.id, tipo_documento: 'NOTA_CREDITO' as const, serie: 'BC01' },
    { id_punto_venta: pv1.id, tipo_documento: 'NOTA_DEBITO' as const, serie: 'FD01' },
    { id_punto_venta: pv1.id, tipo_documento: 'NOTA_VENTA' as const, serie: 'NV01' },
    { id_punto_venta: pv1.id, tipo_documento: 'COTIZACION' as const, serie: 'CT01' },
    { id_punto_venta: pv2.id, tipo_documento: 'FACTURA' as const, serie: 'F002' },
    { id_punto_venta: pv2.id, tipo_documento: 'BOLETA' as const, serie: 'B002' },
    { id_punto_venta: pv2.id, tipo_documento: 'NOTA_CREDITO' as const, serie: 'FC02' },
    { id_punto_venta: pv2.id, tipo_documento: 'NOTA_CREDITO' as const, serie: 'BC02' },
    { id_punto_venta: pv2.id, tipo_documento: 'NOTA_DEBITO' as const, serie: 'FD02' },
    { id_punto_venta: pv2.id, tipo_documento: 'NOTA_VENTA' as const, serie: 'NV02' },
    { id_punto_venta: pv2.id, tipo_documento: 'COTIZACION' as const, serie: 'CT02' },
  ];

  for (const s of seriesData) {
    await prisma.tbl_series_documento.upsert({
      where: {
        id_punto_venta_tipo_documento_serie: {
          id_punto_venta: s.id_punto_venta,
          tipo_documento: s.tipo_documento,
          serie: s.serie,
        },
      },
      update: {},
      create: { ...s, correlativo_actual: 0, usuario_creacion: 'seed' },
    });
  }

  // ─── ALMACÉN (compartido entre ambos puntos de venta) ────────────────────────
  console.log('🏭 Creando almacén...');
  const almacenPrincipal = await prisma.tbl_almacenes.upsert({
    where: { id: '00000000-0000-0000-0002-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-000000000001',
      id_empresa: empresa.id,
      nombre: 'Almacén Principal',
      descripcion: 'Almacén central compartido por ambas tiendas',
      es_principal: true,
      usuario_creacion: 'seed',
    },
  });

  // ─── PERMISOS ────────────────────────────────────────────────────────────────
  console.log('🔐 Creando permisos...');
  const modulos = [
    'auth', 'usuarios', 'roles', 'clientes', 'proveedores', 'productos',
    'inventario', 'ventas', 'compras', 'gastos', 'ordenes_compra', 'caja',
    'facturacion', 'reportes', 'rrhh', 'seguridad', 'configuracion',
  ];
  const acciones = ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'anular'] as const;

  const permisoMap: Record<string, string> = {};

  for (const modulo of modulos) {
    for (const accion of acciones) {
      const clave = `${modulo}:${accion}`;
      const existing = await prisma.tbl_permisos.findFirst({
        where: { modulo, accion },
      });

      if (existing) {
        permisoMap[clave] = existing.id;
      } else {
        const permiso = await prisma.tbl_permisos.create({
          data: {
            modulo,
            accion,
            descripcion: `Permiso para ${accion} en ${modulo}`,
            usuario_creacion: 'seed',
          },
        });
        permisoMap[clave] = permiso.id;
      }
    }
  }

  // ─── ROL SUPERADMIN ──────────────────────────────────────────────────────────
  console.log('👑 Creando roles...');
  let rolAdmin = await prisma.tbl_roles.findFirst({ where: { nombre: 'Administrador', eliminado: false } });
  if (!rolAdmin) {
    rolAdmin = await prisma.tbl_roles.create({
      data: {
        nombre: 'Administrador',
        descripcion: 'Acceso total al sistema',
        es_superadmin: true,
        usuario_creacion: 'seed',
      },
    });
  }

  // Asignar todos los permisos al admin
  for (const permisoId of Object.values(permisoMap)) {
    await prisma.tbl_roles_permisos.upsert({
      where: { id_rol_id_permiso: { id_rol: rolAdmin.id, id_permiso: permisoId } },
      update: {},
      create: { id_rol: rolAdmin.id, id_permiso: permisoId, usuario_creacion: 'seed' },
    });
  }

  // Rol Vendedor / Cajero — en cada tienda la misma persona vende y maneja caja
  let rolVendedor = await prisma.tbl_roles.findFirst({ where: { nombre: 'Vendedor', eliminado: false } });
  if (!rolVendedor) {
    rolVendedor = await prisma.tbl_roles.create({
      data: {
        nombre: 'Vendedor',
        descripcion: 'Vendedor / Cajero de tienda: ventas, clientes y manejo de caja',
        es_superadmin: false,
        usuario_creacion: 'seed',
      },
    });
  }

  const permisosVendedor = [
    'ventas:ver', 'ventas:crear',
    'clientes:ver', 'clientes:crear', 'clientes:editar',
    'productos:ver', 'inventario:ver',
    'caja:ver', 'caja:crear', 'caja:editar',
    'gastos:ver', 'gastos:crear',
    'reportes:ver',
  ];

  for (const clave of permisosVendedor) {
    const pid = permisoMap[clave];
    if (pid) {
      await prisma.tbl_roles_permisos.upsert({
        where: { id_rol_id_permiso: { id_rol: rolVendedor.id, id_permiso: pid } },
        update: {},
        create: { id_rol: rolVendedor.id, id_permiso: pid, usuario_creacion: 'seed' },
      });
    }
  }

  // Rol Compras
  let rolCompras = await prisma.tbl_roles.findFirst({ where: { nombre: 'Compras', eliminado: false } });
  if (!rolCompras) {
    rolCompras = await prisma.tbl_roles.create({
      data: {
        nombre: 'Compras',
        descripcion: 'Gestión de compras y proveedores',
        es_superadmin: false,
        usuario_creacion: 'seed',
      },
    });
  }

  const permisosCompras = [
    'compras:ver', 'compras:crear', 'compras:editar', 'compras:anular',
    'gastos:ver', 'gastos:crear', 'gastos:editar', 'gastos:anular',
    'ordenes_compra:ver', 'ordenes_compra:crear', 'ordenes_compra:editar',
    'ordenes_compra:aprobar', 'ordenes_compra:anular',
    'proveedores:ver', 'proveedores:crear', 'proveedores:editar',
    'productos:ver', 'productos:editar',
    'inventario:ver', 'inventario:crear', 'inventario:editar', 'inventario:anular',
    'reportes:ver',
  ];

  for (const clave of permisosCompras) {
    const pid = permisoMap[clave];
    if (pid) {
      await prisma.tbl_roles_permisos.upsert({
        where: { id_rol_id_permiso: { id_rol: rolCompras.id, id_permiso: pid } },
        update: {},
        create: { id_rol: rolCompras.id, id_permiso: pid, usuario_creacion: 'seed' },
      });
    }
  }

  // ─── USUARIO ADMINISTRADOR ───────────────────────────────────────────────────
  console.log('👤 Creando usuario administrador...');
  let usuarioAdmin = await prisma.tbl_usuarios.findFirst({
    where: { email: 'admin@daytona.pe', eliminado: false },
  });

  if (!usuarioAdmin) {
    usuarioAdmin = await prisma.tbl_usuarios.create({
      data: {
        email: 'admin@daytona.pe',
        password_hash: await bcrypt.hash('Admin123!', 12),
        nombre: 'Administrador',
        apellido: 'Sistema',
        id_punto_venta: null,
        usuario_creacion: 'seed',
      },
    });
  }

  await prisma.tbl_usuarios_roles.upsert({
    where: { id_usuario_id_rol: { id_usuario: usuarioAdmin.id, id_rol: rolAdmin.id } },
    update: {},
    create: { id_usuario: usuarioAdmin.id, id_rol: rolAdmin.id, usuario_creacion: 'seed' },
  });

  // ─── USUARIOS VENDEDOR/CAJERO — UNO POR TIENDA ───────────────────────────────
  console.log('👤 Creando usuarios vendedor/cajero por tienda...');
  const usuariosTienda = [
    { email: 'tienda1@daytona.pe', password: 'Tienda1_2026!', nombre: 'Vendedor', apellido: 'Tienda 1', id_punto_venta: pv1.id },
    { email: 'tienda2@daytona.pe', password: 'Tienda2_2026!', nombre: 'Vendedor', apellido: 'Tienda 2', id_punto_venta: pv2.id },
  ];

  for (const u of usuariosTienda) {
    let usuario = await prisma.tbl_usuarios.findFirst({ where: { email: u.email, eliminado: false } });
    if (!usuario) {
      usuario = await prisma.tbl_usuarios.create({
        data: {
          email: u.email,
          password_hash: await bcrypt.hash(u.password, 12),
          nombre: u.nombre,
          apellido: u.apellido,
          id_punto_venta: u.id_punto_venta,
          usuario_creacion: 'seed',
        },
      });
    }
    await prisma.tbl_usuarios_roles.upsert({
      where: { id_usuario_id_rol: { id_usuario: usuario.id, id_rol: rolVendedor.id } },
      update: {},
      create: { id_usuario: usuario.id, id_rol: rolVendedor.id, usuario_creacion: 'seed' },
    });
  }

  // ─── UNIDADES DE MEDIDA (SUNAT) ──────────────────────────────────────────────
  console.log('📏 Creando unidades de medida...');
  const unidades = [
    { codigo_sunat: 'NIU', descripcion: 'UNIDAD', simbolo: 'UND' },
    { codigo_sunat: 'KGM', descripcion: 'KILOGRAMO', simbolo: 'KG' },
    { codigo_sunat: 'GRM', descripcion: 'GRAMO', simbolo: 'GR' },
    { codigo_sunat: 'LTR', descripcion: 'LITRO', simbolo: 'LT' },
    { codigo_sunat: 'MTR', descripcion: 'METRO', simbolo: 'MT' },
    { codigo_sunat: 'MTK', descripcion: 'METRO CUADRADO', simbolo: 'M2' },
    { codigo_sunat: 'MTQ', descripcion: 'METRO CÚBICO', simbolo: 'M3' },
    { codigo_sunat: 'ZZ', descripcion: 'SERVICIO', simbolo: 'SER' },
    { codigo_sunat: 'BX', descripcion: 'CAJA', simbolo: 'CJA' },
    { codigo_sunat: 'DZN', descripcion: 'DOCENA', simbolo: 'DOC' },
    { codigo_sunat: 'PK', descripcion: 'PAQUETE', simbolo: 'PAQ' },
    { codigo_sunat: 'PR', descripcion: 'PAR', simbolo: 'PAR' },
    { codigo_sunat: 'SET', descripcion: 'JUEGO', simbolo: 'JGO' },
    { codigo_sunat: 'GLL', descripcion: 'GALÓN', simbolo: 'GAL' },
  ];

  for (const u of unidades) {
    await prisma.tbl_unidades_medida.upsert({
      where: { codigo_sunat: u.codigo_sunat },
      update: {},
      create: { ...u, usuario_creacion: 'seed' },
    });
  }

  // ─── CATEGORÍAS: REPUESTOS Y PARTES DE VEHÍCULOS ─────────────────────────────
  console.log('🗂️  Creando categorías...');
  const categoriasData = [
    { nombre: 'FILTROS', subs: ['FILTRO DE ACEITE', 'FILTRO DE AIRE', 'FILTRO DE COMBUSTIBLE', 'FILTRO DE CABINA'] },
    { nombre: 'LUBRICANTES', subs: ['ACEITE DE MOTOR', 'ACEITE DE TRANSMISIÓN', 'GRASAS', 'ADITIVOS'] },
    { nombre: 'FRENOS', subs: ['PASTILLAS DE FRENO', 'DISCOS DE FRENO', 'LÍQUIDO DE FRENOS', 'ZAPATAS'] },
    { nombre: 'SUSPENSIÓN Y DIRECCIÓN', subs: ['AMORTIGUADORES', 'RÓTULAS', 'TERMINALES', 'BUJES'] },
    { nombre: 'ELÉCTRICO', subs: ['BUJÍAS', 'BATERÍAS', 'ALTERNADORES', 'FOCOS'] },
    { nombre: 'MOTOR', subs: ['CORREAS Y BANDAS', 'EMPAQUETADURAS', 'BOMBAS DE AGUA', 'RODAJES'] },
    { nombre: 'CARROCERÍA Y ACCESORIOS', subs: ['ESPEJOS', 'PARACHOQUES', 'LIMPIAPARABRISAS', 'ACCESORIOS'] },
    { nombre: 'LLANTAS Y AROS', subs: ['LLANTAS', 'AROS', 'VÁLVULAS'] },
  ];

  const categoriaMap: Record<string, string> = {};

  for (const cat of categoriasData) {
    const existing = await prisma.tbl_categorias.findFirst({
      where: { nombre: cat.nombre, eliminado: false },
    });

    const categoria = existing || await prisma.tbl_categorias.create({
      data: { nombre: cat.nombre, usuario_creacion: 'seed' },
    });

    categoriaMap[cat.nombre] = categoria.id;

    for (const subNombre of cat.subs) {
      const subExisting = await prisma.tbl_subcategorias.findFirst({
        where: { id_categoria: categoria.id, nombre: subNombre, eliminado: false },
      });
      if (!subExisting) {
        await prisma.tbl_subcategorias.create({
          data: { id_categoria: categoria.id, nombre: subNombre, usuario_creacion: 'seed' },
        });
      }
    }
  }

  // ─── MARCAS (repuestos automotrices) ─────────────────────────────────────────
  console.log('🏷️  Creando marcas...');
  const marcasData = [
    'GENÉRICO', 'BOSCH', 'NGK', 'MOBIL', 'CASTROL', 'SHELL HELIX',
    'MONROE', 'TRW', 'FEBI BILSTEIN', 'MANN FILTER', 'GATES', 'VALVOLINE',
  ];
  for (const nombre of marcasData) {
    const existing = await prisma.tbl_marcas.findFirst({ where: { nombre, eliminado: false } });
    if (!existing) {
      await prisma.tbl_marcas.create({ data: { nombre, usuario_creacion: 'seed' } });
    }
  }

  // ─── MÉTODOS DE PAGO ─────────────────────────────────────────────────────────
  console.log('💳 Creando métodos de pago...');
  const metodosPago = [
    { nombre: 'EFECTIVO', codigo: 'EFE', requiere_referencia: false },
    { nombre: 'TARJETA DÉBITO', codigo: 'TDB', requiere_referencia: true },
    { nombre: 'TARJETA CRÉDITO', codigo: 'TRC', requiere_referencia: true },
    { nombre: 'TRANSFERENCIA', codigo: 'TRF', requiere_referencia: true },
    { nombre: 'YAPE', codigo: 'YAP', requiere_referencia: true },
    { nombre: 'PLIN', codigo: 'PLN', requiere_referencia: true },
    { nombre: 'CHEQUE', codigo: 'CHQ', requiere_referencia: true },
    { nombre: 'CRÉDITO', codigo: 'CRD', requiere_referencia: false },
  ];

  for (const mp of metodosPago) {
    const existing = await prisma.tbl_metodos_pago.findFirst({ where: { nombre: mp.nombre, eliminado: false } });
    if (!existing) {
      await prisma.tbl_metodos_pago.create({ data: { ...mp, usuario_creacion: 'seed' } });
    }
  }

  // ─── CAJAS (una por tienda) ───────────────────────────────────────────────────
  console.log('💰 Creando cajas por tienda...');
  const cajasData = [
    { id_punto_venta: pv1.id, nombre: 'Caja Tienda 1' },
    { id_punto_venta: pv2.id, nombre: 'Caja Tienda 2' },
  ];
  for (const c of cajasData) {
    const existing = await prisma.tbl_cajas.findFirst({
      where: { id_punto_venta: c.id_punto_venta, nombre: c.nombre, eliminado: false },
    });
    if (!existing) {
      await prisma.tbl_cajas.create({
        data: { ...c, descripcion: `Caja de ventas de ${c.nombre}`, usuario_creacion: 'seed' },
      });
    }
  }

  // ─── CLIENTE GENÉRICO ─────────────────────────────────────────────────────────
  console.log('👥 Creando cliente genérico...');
  const clienteExisting = await prisma.tbl_clientes.findFirst({
    where: { tipo_documento: 'DNI', numero_documento: '00000000', eliminado: false },
  });
  if (!clienteExisting) {
    await prisma.tbl_clientes.create({
      data: {
        tipo_documento: 'DNI',
        numero_documento: '00000000',
        razon_social: 'CLIENTES VARIOS',
        nombre_comercial: 'VARIOS',
        es_habitual: false,
        usuario_creacion: 'seed',
      },
    });
  }

  // ─── PROVEEDORES ──────────────────────────────────────────────────────────────
  console.log('🏢 Creando proveedores...');
  const proveedoresData = [
    { ruc: '20100497418', razon_social: 'REFAX PERU SAC', dias_credito: 90 },
    { ruc: '20454237197', razon_social: 'GRUPO V&P SAC', dias_credito: 60 },
    { ruc: '20480880154', razon_social: 'NOR OIL SAC', dias_credito: 30 },
    { ruc: '20524525543', razon_social: 'ARDINI TRADING EIRL', dias_credito: 90 },
    { ruc: '20511914125', razon_social: 'SOLTRAK', dias_credito: 60 },
    { ruc: '20476640041', razon_social: 'BONG', dias_credito: 90 },
    { ruc: '20609400723', razon_social: 'DISOIL', dias_credito: 90 },
    { ruc: '20559109101', razon_social: 'LUMAXA SAC', dias_credito: 60 },
  ];

  const proveedorMap: Record<string, string> = {};
  for (const p of proveedoresData) {
    let proveedor = await prisma.tbl_proveedores.findFirst({ where: { ruc: p.ruc, eliminado: false } });
    if (!proveedor) {
      proveedor = await prisma.tbl_proveedores.create({
        data: { ...p, usuario_creacion: 'seed' },
      });
    }
    proveedorMap[p.razon_social] = proveedor.id;
  }

  // ─── PRODUCTOS: REPUESTOS Y PARTES DE VEHÍCULOS ──────────────────────────────
  console.log('📦 Creando productos de ejemplo...');
  const unidadUnd = (await prisma.tbl_unidades_medida.findFirst({ where: { codigo_sunat: 'NIU' } }))!;
  const unidadGal = (await prisma.tbl_unidades_medida.findFirst({ where: { codigo_sunat: 'GLL' } }))!;
  const unidadJgo = (await prisma.tbl_unidades_medida.findFirst({ where: { codigo_sunat: 'SET' } }))!;
  const unidadPar = (await prisma.tbl_unidades_medida.findFirst({ where: { codigo_sunat: 'PR' } }))!;

  const marcaId = async (nombre: string) =>
    (await prisma.tbl_marcas.findFirst({ where: { nombre, eliminado: false } }))!.id;

  const productosEjemplo = [
    {
      codigo: 'REP-001',
      nombre: 'FILTRO DE ACEITE TOYOTA COROLLA / HILUX',
      id_categoria: categoriaMap['FILTROS'],
      id_marca: await marcaId('BOSCH'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 8.47, precio_compra_con_igv: 10.00,
      precio_venta_1: 18.00, precio_venta_2: 16.00, precio_venta_3: 15.00,
      stock_minimo: 10, stock_maximo: 100,
      proveedor: 'REFAX PERU SAC', codigo_proveedor: 'BOS-15601',
    },
    {
      codigo: 'REP-002',
      nombre: 'FILTRO DE AIRE NISSAN SENTRA',
      id_categoria: categoriaMap['FILTROS'],
      id_marca: await marcaId('MANN FILTER'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 16.95, precio_compra_con_igv: 20.00,
      precio_venta_1: 35.00, precio_venta_2: 32.00, precio_venta_3: 30.00,
      stock_minimo: 8, stock_maximo: 60,
      proveedor: 'REFAX PERU SAC', codigo_proveedor: 'MANN-C2882',
    },
    {
      codigo: 'REP-003',
      nombre: 'ACEITE DE MOTOR 20W50 MINERAL x1GAL',
      id_categoria: categoriaMap['LUBRICANTES'],
      id_marca: await marcaId('MOBIL'),
      id_unidad_medida: unidadGal.id,
      precio_compra_sin_igv: 42.37, precio_compra_con_igv: 50.00,
      precio_venta_1: 75.00, precio_venta_2: 70.00, precio_venta_3: 65.00,
      stock_minimo: 12, stock_maximo: 80,
      proveedor: 'NOR OIL SAC', codigo_proveedor: 'MOB-20W50',
    },
    {
      codigo: 'REP-004',
      nombre: 'ACEITE DE MOTOR SINTÉTICO 5W30 x1GAL',
      id_categoria: categoriaMap['LUBRICANTES'],
      id_marca: await marcaId('CASTROL'),
      id_unidad_medida: unidadGal.id,
      precio_compra_sin_igv: 84.75, precio_compra_con_igv: 100.00,
      precio_venta_1: 145.00, precio_venta_2: 135.00, precio_venta_3: 125.00,
      stock_minimo: 6, stock_maximo: 40,
      proveedor: 'DISOIL', codigo_proveedor: 'CAS-5W30-SYN',
    },
    {
      codigo: 'REP-005',
      nombre: 'PASTILLAS DE FRENO DELANTERAS HYUNDAI ACCENT',
      id_categoria: categoriaMap['FRENOS'],
      id_marca: await marcaId('TRW'),
      id_unidad_medida: unidadJgo.id,
      precio_compra_sin_igv: 50.85, precio_compra_con_igv: 60.00,
      precio_venta_1: 95.00, precio_venta_2: 88.00, precio_venta_3: 82.00,
      stock_minimo: 4, stock_maximo: 30,
      proveedor: 'GRUPO V&P SAC', codigo_proveedor: 'TRW-GDB3413',
    },
    {
      codigo: 'REP-006',
      nombre: 'DISCO DE FRENO DELANTERO TOYOTA YARIS',
      id_categoria: categoriaMap['FRENOS'],
      id_marca: await marcaId('GENÉRICO'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 33.90, precio_compra_con_igv: 40.00,
      precio_venta_1: 65.00, precio_venta_2: 60.00, precio_venta_3: 55.00,
      stock_minimo: 4, stock_maximo: 24,
      proveedor: 'GRUPO V&P SAC', codigo_proveedor: 'GVP-DF-YAR',
    },
    {
      codigo: 'REP-007',
      nombre: 'AMORTIGUADOR DELANTERO KIA RIO',
      id_categoria: categoriaMap['SUSPENSIÓN Y DIRECCIÓN'],
      id_marca: await marcaId('MONROE'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 101.69, precio_compra_con_igv: 120.00,
      precio_venta_1: 180.00, precio_venta_2: 168.00, precio_venta_3: 155.00,
      stock_minimo: 2, stock_maximo: 16,
      proveedor: 'ARDINI TRADING EIRL', codigo_proveedor: 'MON-71646',
    },
    {
      codigo: 'REP-008',
      nombre: 'BUJÍA DE ENCENDIDO IRIDIUM',
      id_categoria: categoriaMap['ELÉCTRICO'],
      id_marca: await marcaId('NGK'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 21.19, precio_compra_con_igv: 25.00,
      precio_venta_1: 38.00, precio_venta_2: 35.00, precio_venta_3: 32.00,
      stock_minimo: 16, stock_maximo: 120,
      proveedor: 'SOLTRAK', codigo_proveedor: 'NGK-ILZKR7B11',
    },
    {
      codigo: 'REP-009',
      nombre: 'BATERÍA 12V 45AH',
      id_categoria: categoriaMap['ELÉCTRICO'],
      id_marca: await marcaId('GENÉRICO'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 211.86, precio_compra_con_igv: 250.00,
      precio_venta_1: 360.00, precio_venta_2: 340.00, precio_venta_3: 320.00,
      stock_minimo: 3, stock_maximo: 20,
      proveedor: 'BONG', codigo_proveedor: 'BAT-45AH',
    },
    {
      codigo: 'REP-010',
      nombre: 'CORREA DE DISTRIBUCIÓN',
      id_categoria: categoriaMap['MOTOR'],
      id_marca: await marcaId('GATES'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 46.61, precio_compra_con_igv: 55.00,
      precio_venta_1: 85.00, precio_venta_2: 78.00, precio_venta_3: 72.00,
      stock_minimo: 4, stock_maximo: 30,
      proveedor: 'LUMAXA SAC', codigo_proveedor: 'GAT-T295',
    },
    {
      codigo: 'REP-011',
      nombre: 'LIMPIAPARABRISAS UNIVERSAL 20"',
      id_categoria: categoriaMap['CARROCERÍA Y ACCESORIOS'],
      id_marca: await marcaId('GENÉRICO'),
      id_unidad_medida: unidadPar.id,
      precio_compra_sin_igv: 16.95, precio_compra_con_igv: 20.00,
      precio_venta_1: 32.00, precio_venta_2: 30.00, precio_venta_3: 28.00,
      stock_minimo: 10, stock_maximo: 60,
      proveedor: 'LUMAXA SAC', codigo_proveedor: 'LMX-WB20',
    },
    {
      codigo: 'REP-012',
      nombre: 'LLANTA 195/65 R15',
      id_categoria: categoriaMap['LLANTAS Y AROS'],
      id_marca: await marcaId('GENÉRICO'),
      id_unidad_medida: unidadUnd.id,
      precio_compra_sin_igv: 169.49, precio_compra_con_igv: 200.00,
      precio_venta_1: 290.00, precio_venta_2: 270.00, precio_venta_3: 250.00,
      stock_minimo: 4, stock_maximo: 24,
      proveedor: 'ARDINI TRADING EIRL', codigo_proveedor: 'ARD-19565R15',
    },
  ];

  for (const prod of productosEjemplo) {
    const { proveedor, codigo_proveedor, ...prodData } = prod;
    const existing = await prisma.tbl_productos.findFirst({
      where: { codigo: prodData.codigo, eliminado: false },
    });
    if (!existing) {
      const creado = await prisma.tbl_productos.create({
        data: {
          ...prodData,
          costo_promedio: prodData.precio_compra_sin_igv,
          tipo_existencia: '01',
          usuario_creacion: 'seed',
        },
      });

      const idProveedor = proveedorMap[proveedor];
      if (idProveedor) {
        await prisma.tbl_producto_codigos_proveedor.upsert({
          where: { id_producto_id_proveedor: { id_producto: creado.id, id_proveedor: idProveedor } },
          update: {},
          create: {
            id_producto: creado.id,
            id_proveedor: idProveedor,
            codigo_alterno: codigo_proveedor,
          },
        });
      }
    }
  }

  // ─── TIPO DE CAMBIO INICIAL ───────────────────────────────────────────────────
  console.log('💱 Creando tipo de cambio inicial...');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const tcExisting = await prisma.tbl_tipos_cambio.findFirst({ where: { fecha: hoy } });
  if (!tcExisting) {
    await prisma.tbl_tipos_cambio.create({
      data: {
        fecha: hoy,
        compra: 3.72,
        venta: 3.75,
        fuente: 'manual',
        usuario_creacion: 'seed',
      },
    });
  }

  // ─── MÁRGENES DE PRECIOS ──────────────────────────────────────────────────────
  const margenesDefault = [
    { numero: 1, nombre: 'Precio Minorista', margen: 30, descripcion: 'Venta al público / minorista' },
    { numero: 2, nombre: 'Precio Mayorista', margen: 20, descripcion: 'Clientes mayoristas' },
    { numero: 3, nombre: 'Precio Especial', margen: 15, descripcion: 'Clientes especiales / recurrentes' },
    { numero: 4, nombre: 'Precio Distribuidor', margen: 10, descripcion: 'Distribuidores autorizados' },
    { numero: 5, nombre: 'Precio Costo', margen: 5, descripcion: 'Costo + margen mínimo' },
  ];
  for (const m of margenesDefault) {
    await prisma.tbl_config_margenes.upsert({
      where: { numero: m.numero },
      update: {},
      create: m,
    });
  }
  console.log('💰 Márgenes de precios configurados');

  // ─── RESUMEN ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('📌 CREDENCIALES DE ACCESO:');
  console.log('   Administrador: admin@daytona.pe / Admin123!');
  console.log('   Tienda 1:      tienda1@daytona.pe / Tienda1_2026!');
  console.log('   Tienda 2:      tienda2@daytona.pe / Tienda2_2026!');
  console.log('═══════════════════════════════════════════════════');
  console.log('📌 EMPRESA: DAYTONA AUTOPARTES S.A.C. | RUC: 20123456789');
  console.log('📌 TIENDA 1 (id 01): AV. PERU 916');
  console.log('📌 TIENDA 2 (id 02): AV. PERU 918');
  console.log('📌 API URL: http://localhost:3000/api/v1');
  console.log('📌 Swagger: http://localhost:3000/api/docs');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
