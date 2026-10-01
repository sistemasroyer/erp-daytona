/**
 * Migración de datos de letras-daytona (PHP + MySQL) a MARTSOFT.
 *
 * Uso (desde backend/):
 *   LETRAS_DB_URL="mysql://usuario:clave@host:3306/base" npm run migrar:letras            → simulación (no guarda nada)
 *   LETRAS_DB_URL="mysql://usuario:clave@host:3306/base" npm run migrar:letras -- --aplicar → guarda
 * (LETRAS_DB_URL también puede ir en backend/.env). Al usuario de MySQL le basta permiso de lectura.
 *
 * Qué migra: bancos, días de no pago, límites de pago por día, proveedores (por RUC: si ya existe en
 * MARTSOFT solo se marca "pago único"), paquetes, documentos y letras con sus pagos. No migra usuarios,
 * roles, tipos de cambio, cuentas bancarias ni la auditoría (MARTSOFT ya tiene los suyos).
 *
 * Es idempotente: cada fila guarda su id de letras-daytona en `id_legacy`, así que volver a correrlo
 * actualiza lo ya migrado en vez de duplicarlo. Pensado para correrse por última vez justo antes de
 * empezar a usar Letras en MARTSOFT: una re-ejecución pisa los cambios hechos aquí a lo migrado.
 * La simulación hace todo dentro de una transacción que al final se deshace, así que valida todo
 * (restricciones de la BD incluidas) sin dejar rastro.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';

type Tx = Prisma.TransactionClient;
type Moneda = 'PEN' | 'USD';
type Fila = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const APLICAR = process.argv.includes('--aplicar');
const ESTADO_PAQUETE = { 1: 'borrador', 2: 'pendiente_aprobacion', 3: 'aprobado', 4: 'en_proceso', 5: 'completado', 6: 'cancelado' } as const;
// 3 = vencida en letras-daytona; aquí "vencida" se deriva de la fecha, se guarda como pendiente.
const ESTADO_LETRA = { 1: 'pendiente', 2: 'pagada', 3: 'pendiente', 4: 'cancelada' } as const;
const TIPO_DOCUMENTO: Record<string, 'factura' | 'nota_credito' | 'nota_debito' | 'otro'> = { FAC: 'factura', NC: 'nota_credito', ND: 'nota_debito' };

const avisos: string[] = [];
const avisar = (m: string) => avisos.push(m);
const mayus = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().toUpperCase());
const recortar = (v: string | null, max: number, que: string) => {
  if (v && v.length > max) { avisar(`${que}: "${v}" se recortó a ${max} caracteres`); return v.slice(0, max); }
  return v;
};
const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const activo = (v: unknown) => v === null || v === undefined || Number(v) === 1;
/** DATE de MySQL ('YYYY-MM-DD') → Date a medianoche UTC, igual que `aFecha` de letras/fechas.ts. */
const fecha = (v: unknown): Date | null => {
  if (!v) return null;
  const t = String(v).slice(0, 10);
  return t === '0000-00-00' ? null : new Date(`${t}T00:00:00.000Z`);
};
/** DATETIME de MySQL (hora de Lima) → Date. */
const fechaHora = (v: unknown): Date | undefined => {
  if (!v || String(v).startsWith('0000')) return undefined;
  return new Date(`${String(v).replace(' ', 'T')}-05:00`);
};
const sumarDias = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

class Simulacion extends Error {}

async function main() {
  process.loadEnvFile?.('.env');
  const url = process.env.LETRAS_DB_URL;
  if (!url) throw new Error('Falta LETRAS_DB_URL (mysql://usuario:clave@host:3306/base)');

  const mysql = await createConnection({ uri: url, charset: 'utf8mb4', dateStrings: true, decimalNumbers: true });
  const prisma = new PrismaClient();
  console.log(`\n${APLICAR ? '💾 MIGRANDO (se guardan los cambios)' : '🔎 SIMULACIÓN (no se guarda nada; use --aplicar para guardar)'}\n`);

  try {
    const leer = async (tabla: string, where = '') => {
      const [filas] = await mysql.query<RowDataPacket[]>(`SELECT * FROM ${tabla} ${where}`);
      return filas as Fila[];
    };
    const origen = {
      monedas: await leer('lt_moneda'),
      usuarios: await leer('lt_usuario'),
      bancos: await leer('lt_banco'),
      diasNoPago: await leer('lt_dias_nopago'),
      limites: await leer('lt_restriccion_dias_nopago'),
      proveedores: await leer('lt_proveedor'),
      tiposDocumento: await leer('lt_tipo_documento'),
      paquetes: await leer('lt_paquete', 'ORDER BY id'),
      documentos: await leer('lt_documento', 'ORDER BY id'),
      letras: await leer('lt_letra', 'ORDER BY id_paquete, numero_cuota, id'),
    };

    const resumen = await prisma.$transaction(async (tx) => {
      const r = await migrar(tx, origen);
      if (!APLICAR) throw new Simulacion(JSON.stringify(r));
      return r;
    }, { timeout: 600_000, maxWait: 30_000 }).catch((err) => {
      if (err instanceof Simulacion) return JSON.parse(err.message) as Record<string, string>;
      throw err;
    });

    console.log('Resultado:');
    for (const [k, v] of Object.entries(resumen)) console.log(`  ${k.padEnd(22)} ${v}`);
    if (avisos.length) {
      console.log(`\n⚠️  Avisos (${avisos.length}):`);
      for (const a of avisos) console.log(`  - ${a}`);
    }
    console.log(APLICAR ? '\n✅ Migración guardada.' : '\nℹ️  Nada se guardó. Si el resultado está bien, vuelva a correrlo con --aplicar.');
  } finally {
    await mysql.end();
    await prisma.$disconnect();
  }
}

async function migrar(tx: Tx, o: Record<string, Fila[]>) {
  const r: Record<string, string> = {};
  const vivos = (filas: Fila[]) => filas.filter((f) => !Number(f.eliminado));

  // ── Monedas y usuarios: solo se mapean ──
  const monedas = new Map<number, Moneda>();
  for (const m of o.monedas) {
    const iso = String(m.codigo_iso ?? '').toUpperCase();
    if (iso === 'PEN' || iso === 'USD') monedas.set(Number(m.id), iso);
  }
  if (!monedas.size) { monedas.set(1, 'PEN'); monedas.set(2, 'USD'); }
  const moneda = (id: unknown, que: string): Moneda => {
    const m = monedas.get(Number(id));
    if (!m) avisar(`${que}: moneda id ${id} desconocida, se tomó PEN`);
    return m ?? 'PEN';
  };

  const usuariosMartsoft = await tx.tbl_usuarios.findMany({ select: { id: true, email: true } });
  const porEmail = new Map(usuariosMartsoft.map((u) => [u.email.toLowerCase(), u.id]));
  const usuarios = new Map<number, string>();
  const sinUsuario = new Set<string>();
  for (const u of o.usuarios) {
    const id = porEmail.get(String(u.email ?? '').toLowerCase().trim());
    if (id) usuarios.set(Number(u.id), id);
    else sinUsuario.add(`${u.usuario} <${u.email}>`);
  }
  const usuario = (id: unknown) => (id ? usuarios.get(Number(id)) ?? null : null);
  r.usuarios = `${usuarios.size} enlazados por email${sinUsuario.size ? `, ${sinUsuario.size} sin cuenta en MARTSOFT (${[...sinUsuario].join(', ')})` : ''}`;

  // ── Bancos ── (si ya hay uno con el mismo nombre creado a mano, se reutiliza)
  const bancos = new Map<number, string>();
  let nBancos = 0;
  for (const b of o.bancos) {
    const nombre = recortar(mayus(b.nombre_banco), 150, 'Banco')!;
    const data = { nombre, siglas: recortar(mayus(b.siglas), 20, 'Siglas de banco'), descripcion: recortar(mayus(b.descripcion), 300, 'Banco'), estado: activo(b.activo), eliminado: !!Number(b.eliminado) };
    const existente = await tx.tbl_bancos.findFirst({ where: { OR: [{ id_legacy: Number(b.id) }, { id_legacy: null, eliminado: false, nombre: { equals: nombre, mode: 'insensitive' } }] }, orderBy: { id_legacy: 'asc' } });
    const banco = existente
      ? await tx.tbl_bancos.update({ where: { id: existente.id }, data: { ...data, id_legacy: Number(b.id) } })
      : await tx.tbl_bancos.create({ data: { ...data, id_legacy: Number(b.id) } });
    bancos.set(Number(b.id), banco.id);
    nBancos++;
  }
  r.bancos = String(nBancos);

  // ── Días de no pago ──
  let nDias = 0;
  for (const d of o.diasNoPago) {
    const f = fecha(d.fecha_nopago);
    if (!f) { avisar(`Día de no pago ${d.id} sin fecha: omitido`); continue; }
    const tipo = d.tipo_dia === 'especial' ? 'especial' : 'feriado';
    if (d.tipo_dia !== 'feriado' && d.tipo_dia !== 'especial') avisar(`Día de no pago ${d.fecha_nopago}: tipo "${d.tipo_dia}" se guardó como feriado`);
    const data = { fecha: f, descripcion: recortar(mayus(d.descripcion) ?? 'SIN DESCRIPCIÓN', 200, 'Día de no pago')!, tipo, estado: activo(d.activo), eliminado: !!Number(d.eliminado) } as const;
    await tx.tbl_dias_no_pago.upsert({ where: { id_legacy: Number(d.id) }, update: data, create: { ...data, id_legacy: Number(d.id) } });
    nDias++;
  }
  r.dias_no_pago = String(nDias);

  // ── Límites por día de la semana ── (reemplazan al límite vigente del mismo día y moneda)
  let nLimites = 0;
  for (const l of vivos(o.limites)) {
    const dia = Number(l.num_dia_semana);
    if (!(dia >= 1 && dia <= 7)) { avisar(`Límite ${l.id}: día de semana ${l.num_dia_semana} inválido, omitido`); continue; }
    const mon = moneda(l.id_moneda, `Límite ${l.dia_semana}`);
    const data = { dia_semana: dia, moneda: mon, monto_maximo: num(l.monto_maximo), estado: activo(l.activo), eliminado: false };
    const existente = await tx.tbl_limites_pago_dia.findFirst({ where: { OR: [{ id_legacy: Number(l.id) }, { id_legacy: null, eliminado: false, dia_semana: dia, moneda: mon }] }, orderBy: { id_legacy: 'asc' } });
    if (existente) await tx.tbl_limites_pago_dia.update({ where: { id: existente.id }, data: { ...data, id_legacy: Number(l.id) } });
    else await tx.tbl_limites_pago_dia.create({ data: { ...data, id_legacy: Number(l.id) } });
    nLimites++;
  }
  r.limites = String(nLimites);

  // ── Proveedores: por RUC ──
  const proveedores = new Map<number, string>();
  let nProvNuevos = 0, nProvExist = 0;
  for (const p of o.proveedores) {
    const ruc = String(p.ruc ?? '').trim();
    if (!/^\d{11}$/.test(ruc)) { avisar(`Proveedor "${p.razon_social}": RUC "${ruc}" inválido, se omiten sus paquetes`); continue; }
    const pagoUnico = ['unico', 'único', 'contado', 'una sola armada'].includes(String(p.tipo_pago ?? '').toLowerCase().trim());
    const existente = await tx.tbl_proveedores.findUnique({ where: { ruc } });
    if (existente) {
      if (pagoUnico && !existente.letras_pago_unico) await tx.tbl_proveedores.update({ where: { id: existente.id }, data: { letras_pago_unico: true } });
      proveedores.set(Number(p.id), existente.id);
      nProvExist++;
    } else {
      const nuevo = await tx.tbl_proveedores.create({
        data: {
          ruc, razon_social: recortar(mayus(p.razon_social), 250, 'Razón social')!, direccion: recortar(mayus(p.direccion), 500, 'Dirección'),
          email: p.email ? String(p.email).trim().slice(0, 150) : null, telefono: p.telefono ? String(p.telefono).slice(0, 20) : null,
          dias_credito: Number(p.dias_credito) || 0, letras_pago_unico: pagoUnico, estado: activo(p.activo), eliminado: !!Number(p.eliminado),
        },
      });
      proveedores.set(Number(p.id), nuevo.id);
      nProvNuevos++;
    }
  }
  r.proveedores = `${nProvExist} ya existían (enlazados por RUC), ${nProvNuevos} creados`;

  // ── Paquetes ── (los eliminados en letras-daytona no se migran)
  const tiposDoc = new Map(o.tiposDocumento.map((t) => [Number(t.id), String(t.abreviacion ?? '').toUpperCase().trim()]));
  const paquetes = new Map<number, { id: string; idProveedor: string; moneda: Moneda }>();
  let nPaq = 0, nPaqOmit = 0;
  for (const p of o.paquetes) {
    if (Number(p.eliminado)) { nPaqOmit++; continue; }
    const idProveedor = proveedores.get(Number(p.id_proveedor));
    if (!idProveedor) { avisar(`Paquete ${p.codigo_paquete}: proveedor ${p.id_proveedor} no migrado, se omite`); nPaqOmit++; continue; }
    const estado = ESTADO_PAQUETE[Number(p.id_estado) as keyof typeof ESTADO_PAQUETE];
    if (!estado) { avisar(`Paquete ${p.codigo_paquete}: estado ${p.id_estado} desconocido, se omite`); nPaqOmit++; continue; }
    const inicio = fecha(p.fecha_inicio_pago) ?? fecha(p.fecha_creacion);
    if (!inicio) { avisar(`Paquete ${p.codigo_paquete}: sin fecha de inicio, se omite`); nPaqOmit++; continue; }
    const dias = Number(p.dias_credito) || 0;
    const mon = moneda(p.id_moneda, `Paquete ${p.codigo_paquete}`);

    let codigo = recortar(mayus(p.codigo_paquete) ?? `LEGACY-${p.id}`, 30, 'Código de paquete')!;
    const choque = await tx.tbl_letras_paquetes.findFirst({ where: { codigo, NOT: { id_legacy: Number(p.id) } }, select: { id: true } });
    if (choque) { avisar(`Paquete ${codigo}: ese código ya existe en MARTSOFT, se guardó como ${codigo}-L`); codigo = `${codigo}-L`.slice(0, 30); }

    const data = {
      codigo, id_proveedor: idProveedor, id_banco: p.id_banco ? bancos.get(Number(p.id_banco)) ?? null : null, moneda: mon, estado,
      fecha_inicio_pago: inicio, fecha_fin_pago: fecha(p.fecha_fin_pago) ?? sumarDias(inicio, dias), dias_credito: dias,
      monto_total: num(p.monto_total), numero_cuotas: Math.max(1, Number(p.numero_cuotas) || 1), comentarios: recortar(mayus(p.comentarios), 500, `Comentario de ${codigo}`),
      id_usuario_aprobador: usuario(p.id_usuario_aprobado), fecha_aprobacion: fechaHora(p.fecha_aprobacion) ?? null,
      usuario_creacion: usuario(p.id_usuario_creado), eliminado: false,
    };
    const fc = fechaHora(p.fecha_creacion);
    const paq = await tx.tbl_letras_paquetes.upsert({
      where: { id_legacy: Number(p.id) }, update: data, create: { ...data, id_legacy: Number(p.id), ...(fc && { fecha_creacion: fc }) },
    });
    paquetes.set(Number(p.id), { id: paq.id, idProveedor, moneda: mon });
    nPaq++;
  }
  r.paquetes = `${nPaq}${nPaqOmit ? ` (${nPaqOmit} omitidos: eliminados o sin proveedor)` : ''}`;

  // ── Documentos ── (se enlazan a la compra de MARTSOFT con el mismo proveedor, serie y número, si existe)
  let nDoc = 0, nEnlazados = 0;
  const sumaDocs = new Map<number, number>();
  for (const d of vivos(o.documentos)) {
    const paq = paquetes.get(Number(d.id_paquete));
    if (!paq) continue;
    const abrev = tiposDoc.get(Number(d.id_tipo_documento)) ?? '';
    const tipo = TIPO_DOCUMENTO[abrev] ?? 'otro';
    const monto = tipo === 'nota_credito' ? -Math.abs(num(d.monto_total)) : Math.abs(num(d.monto_total));
    const serie = recortar(mayus(d.serie) ?? '-', 10, 'Serie')!;
    const numero = recortar(String(d.numero ?? '').trim() || '-', 20, 'Número')!;
    const mon = d.id_moneda ? moneda(d.id_moneda, `Documento ${serie}-${numero}`) : paq.moneda;
    if (mon !== paq.moneda) avisar(`Documento ${serie}-${numero}: moneda ${mon} distinta a la del paquete (${paq.moneda})`);
    const compra = await buscarCompra(tx, paq.idProveedor, tipo, serie, numero);
    if (compra) nEnlazados++;
    const emision = fecha(d.fecha_emision) ?? fecha(d.fecha_registro) ?? new Date();
    const data = {
      id_paquete: paq.id, id_compra: compra, tipo, serie, numero, moneda: mon, monto, fecha_emision: emision,
      fecha_vencimiento: fecha(d.fecha_vencimiento), dias_credito: Number(d.dias_credito) || 0, eliminado: false,
    };
    const fc = fechaHora(d.fecha_registro);
    await tx.tbl_letras_documentos.upsert({ where: { id_legacy: Number(d.id) }, update: data, create: { ...data, id_legacy: Number(d.id), ...(fc && { fecha_creacion: fc }) } });
    sumaDocs.set(Number(d.id_paquete), num((sumaDocs.get(Number(d.id_paquete)) ?? 0) + monto));
    nDoc++;
  }
  r.documentos = `${nDoc} (${nEnlazados} enlazados a compras de MARTSOFT)`;

  // ── Letras ──
  let nLet = 0, nPagadas = 0;
  const sumaLetras = new Map<number, number>();
  for (const l of vivos(o.letras)) {
    const paq = paquetes.get(Number(l.id_paquete));
    if (!paq) continue;
    const estado = ESTADO_LETRA[Number(l.id_estado) as keyof typeof ESTADO_LETRA];
    if (!estado) { avisar(`Letra ${l.id}: estado ${l.id_estado} desconocido, se tomó pendiente`); }
    const pago = fecha(l.fecha_pago_real);
    if (!pago) { avisar(`Letra ${l.id}: sin fecha de pago, se omite`); continue; }
    const monto = num(l.monto_cuota);
    const pagada = estado === 'pagada';
    const data = {
      id_paquete: paq.id, numero_cuota: Number(l.numero_cuota) || 1, moneda: l.id_moneda ? moneda(l.id_moneda, `Letra ${l.id}`) : paq.moneda,
      monto, fecha_pago: pago, fecha_banco: fecha(l.fecha_banco) ?? sumarDias(pago, -7), estado: estado ?? 'pendiente',
      codigo_banco: recortar(mayus(l.codigo_letra), 50, 'Código de letra'),
      // letras-daytona no guardaba el monto pagado (exigía que fuera ±10% del de la letra): se toma el de la letra.
      fecha_pago_efectivo: pagada ? fecha(l.fecha_pago_efectivo) ?? pago : null,
      metodo_pago: pagada ? recortar(mayus(l.metodo_pago), 50, 'Método de pago') : null,
      numero_operacion: pagada ? recortar(mayus(l.numero_operacion), 50, 'N° operación') : null,
      monto_pagado: pagada ? monto : null, id_usuario_pago: pagada ? usuario(l.id_usuario_pago) : null,
      observaciones: l.observaciones ? String(l.observaciones) : null, eliminado: false,
    };
    const fc = fechaHora(l.fecha_creacion);
    await tx.tbl_letras.upsert({ where: { id_legacy: Number(l.id) }, update: data, create: { ...data, id_legacy: Number(l.id), ...(fc && { fecha_creacion: fc }) } });
    if (data.estado !== 'cancelada') sumaLetras.set(Number(l.id_paquete), num((sumaLetras.get(Number(l.id_paquete)) ?? 0) + monto));
    nLet++;
    if (pagada) nPagadas++;
  }
  r.letras = `${nLet} (${nPagadas} pagadas)`;

  // ── Controles: totales que no cuadran (se migran igual, solo se avisa) ──
  for (const p of o.paquetes) {
    if (!paquetes.has(Number(p.id))) continue;
    const total = num(p.monto_total);
    const docs = sumaDocs.get(Number(p.id)) ?? 0;
    const lets = sumaLetras.get(Number(p.id));
    if (Math.abs(docs - total) > 0.01) avisar(`Paquete ${p.codigo_paquete}: sus documentos suman ${docs.toFixed(2)} y el paquete dice ${total.toFixed(2)}`);
    if (lets !== undefined && Number(p.id_estado) !== 6 && Math.abs(lets - total) > 0.01) avisar(`Paquete ${p.codigo_paquete}: sus letras suman ${lets.toFixed(2)} y el paquete dice ${total.toFixed(2)}`);
  }
  return r;
}

/** Compra de MARTSOFT del mismo proveedor con la misma serie y número (sin ceros a la izquierda). */
async function buscarCompra(tx: Tx, idProveedor: string, tipo: string, serie: string, numero: string) {
  if (tipo !== 'factura' && tipo !== 'nota_credito') return null;
  const candidatas = await tx.tbl_compras.findMany({
    where: { id_proveedor: idProveedor, eliminado: false, serie: { equals: serie, mode: 'insensitive' }, tipo_documento: tipo === 'nota_credito' ? 'nota_credito' : { not: 'nota_credito' } },
    select: { id: true, numero: true },
  });
  const limpio = (n: string | null) => (n ?? '').replace(/^0+/, '') || '0';
  return candidatas.find((c) => limpio(c.numero) === limpio(numero))?.id ?? null;
}

main().catch((err) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
