/**
 * Motor de distribución de letras — port 1:1 de letras-daytona `modules/letras/letras-utils.php`
 * (funciones analizarCapacidadDiariaConvertida, generarDistribucionConToleranciaAdaptativa,
 * generarDistribucionOptimaMejorada, generarMontosProporcionalesCapacidad, validarFechaPagoReal,
 * calcularNumeroOptimoCuotasSimplificado) y del armado de rangos de
 * analizar-distribucion-inteligente.php / recalcular-distribucion.php.
 *
 * Es lógica pura (sin base de datos): recibe todo lo que necesita ya leído, para poder probarla
 * caso por caso contra el sistema anterior. Reglas:
 *  - El domingo y los días de no pago no son hábiles.
 *  - Cada día de la semana tiene un monto máximo de letras (el mayor de sus límites tras convertir
 *    a la moneda del paquete; 5000 si no hay límite). Lo ya programado de TODOS los proveedores
 *    ese día descuenta capacidad.
 *  - Un proveedor no puede tener dos letras el mismo día (tampoco de otro paquete suyo).
 *  - fecha_banco = fecha_pago − 7 días, y la fecha_banco debe caer dentro del periodo del paquete.
 *  - Los montos se reparten en proporción a la capacidad libre de los mejores días; si no entra,
 *    se acepta pasar el límite hasta una tolerancia (20% → 30 → 40 → 50%).
 *
 *  - La fecha_banco nunca cae el mismo día de inicio del paquete (comportamiento del PHP, ver distribuirConTolerancia).
 *
 * Diferencias deliberadas con el PHP (documentadas en los tests):
 *  - Las letras canceladas no ocupan capacidad (en el PHP no existía ese estado en el cálculo).
 */
import { diaSemanaIso, sumarDias } from '../fechas';

export type Moneda = 'PEN' | 'USD';

export const DIAS_BANCO = 7;
export const LIMITE_POR_DEFECTO = 5000;
export const MAX_CUOTAS = 36;

export interface ConfigDistribucion {
  /** % que se permite pasar el límite diario. Default 20. */
  tolerancia?: number;
  /** Capacidad mínima para que un día cuente como "disponible" (debajo: "limitado"). Default 100. */
  monto_minimo?: number;
  /** Solo informativo (límites de cuotas). Default 5000. */
  monto_maximo_preferido?: number;
}

export interface PaqueteDistribucion {
  id: string;
  id_proveedor: string;
  moneda: Moneda;
  monto_total: number;
  /** 'YYYY-MM-DD' */
  fecha_inicio_pago: string;
  fecha_fin_pago: string;
  /** Cuotas registradas en el paquete (referencial para el número óptimo). */
  cuotas_referencial: number;
  pago_unico: boolean;
}

export interface LimiteDia { dia_semana: number; moneda: Moneda; monto_maximo: number }

/** Letra ya programada de OTRO paquete (cualquier proveedor). */
export interface LetraProgramada { fecha_pago: string; monto: number; moneda: Moneda; id_proveedor: string }

export interface DatosDistribucion {
  paquete: PaqueteDistribucion;
  config: ConfigDistribucion;
  tipoCambio: number;
  diasNoPago: Set<string>;
  limites: LimiteDia[];
  letrasProgramadas: LetraProgramada[];
}

export type EstadoDia = 'no_habil' | 'sin_capacidad' | 'limitado' | 'disponible';

export interface CapacidadDia {
  fecha: string;
  num_dia_semana: number;
  es_habil: boolean;
  monto_programado: number;
  limite_maximo: number;
  capacidad_disponible: number;
  estado: EstadoDia;
  tiene_letra_proveedor: boolean;
}

export type EstadoLetraPropuesta = 'valida' | 'advertencia' | 'invalida';

export interface LetraPropuesta {
  numero_cuota: number;
  monto: number;
  fecha_banco: string;
  fecha_pago: string;
  /** Lo que ya había programado ese día (otros paquetes). */
  monto_existente: number;
  monto_total_dia: number;
  limite_dia: number;
  estado: EstadoLetraPropuesta;
  observaciones: string;
}

export interface AnalisisCuotas {
  numero_cuotas_optimo: number;
  cuotas_referencial: number;
  dias_disponibles: number;
  capacidad_total_disponible: number;
  capacidad_promedio: number;
  monto_cuota_promedio: number;
  limites: { minimo_cuotas: number; maximo_cuotas: number };
  explicacion: string;
}

export interface ResultadoDistribucion {
  letras: LetraPropuesta[];
  tolerancia_utilizada: number;
  mensaje_tolerancia: string;
}

export class DistribucionError extends Error {}

/** round() de PHP (mitad hacia afuera, sin el error de coma flotante de Math.round con x.xx5). */
export function redondear(valor: number, decimales = 2): number {
  const signo = valor < 0 ? -1 : 1;
  const r = Math.round(Number(`${Math.abs(valor)}e${decimales}`));
  return signo * Number(`${r}e-${decimales}`);
}

/** id 1 = PEN, id 2 = USD en letras-daytona: PEN→USD divide, USD→PEN multiplica. */
export function convertir(monto: number, origen: Moneda, destino: Moneda, tipoCambio: number): number {
  if (monto === 0 || origen === destino) return monto;
  if (origen === 'PEN' && destino === 'USD') return monto / Math.max(1e-6, tipoCambio);
  return monto * tipoCambio;
}

/** Rango de fechas de pago que se analiza: [inicio − 7, fin + 14] (igual que el PHP). */
export function rangoAnalisis(paquete: Pick<PaqueteDistribucion, 'fecha_inicio_pago' | 'fecha_fin_pago'>) {
  return { desde: sumarDias(paquete.fecha_inicio_pago, -DIAS_BANCO), hasta: sumarDias(paquete.fecha_fin_pago, 14) };
}

function limitesPorDia(limites: LimiteDia[], monedaDestino: Moneda, tipoCambio: number): Record<number, number> {
  const resultado: Record<number, number> = {};
  for (const l of limites) {
    const conv = convertir(l.monto_maximo, l.moneda, monedaDestino, tipoCambio);
    if (resultado[l.dia_semana] === undefined || conv > resultado[l.dia_semana]) resultado[l.dia_semana] = conv;
  }
  for (let d = 1; d <= 7; d++) if (resultado[d] === undefined) resultado[d] = LIMITE_POR_DEFECTO;
  return resultado;
}

/** analizarCapacidadDiariaConvertida(): capacidad libre de cada día del rango, en la moneda del paquete. */
export function analizarCapacidadDiaria(datos: DatosDistribucion, desde: string, hasta: string): CapacidadDia[] {
  const { paquete, config, tipoCambio, diasNoPago } = datos;
  const montoMinimo = config.monto_minimo ?? 100;
  const limites = limitesPorDia(datos.limites, paquete.moneda, tipoCambio);

  const programado: Record<string, number> = {};
  const delProveedor = new Set<string>();
  for (const l of datos.letrasProgramadas) {
    if (l.fecha_pago < desde || l.fecha_pago > hasta) continue;
    programado[l.fecha_pago] = (programado[l.fecha_pago] ?? 0) + convertir(l.monto, l.moneda, paquete.moneda, tipoCambio);
    if (l.id_proveedor === paquete.id_proveedor) delProveedor.add(l.fecha_pago);
  }

  const dias: CapacidadDia[] = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    const dia = diaSemanaIso(fecha);
    const esHabil = dia !== 7 && !diasNoPago.has(fecha);
    const limite = limites[dia] ?? LIMITE_POR_DEFECTO;
    const prog = programado[fecha] ?? 0;
    const cap = limite - prog;
    const estado: EstadoDia = !esHabil ? 'no_habil' : cap <= 0 ? 'sin_capacidad' : cap < montoMinimo ? 'limitado' : 'disponible';
    dias.push({
      fecha, num_dia_semana: dia, es_habil: esHabil,
      monto_programado: redondear(prog), limite_maximo: redondear(limite),
      capacidad_disponible: Math.max(0, redondear(cap)), estado,
      tiene_letra_proveedor: delProveedor.has(fecha),
    });
  }
  return dias;
}

/** calcularNumeroOptimoCuotasSimplificado(). */
export function calcularNumeroOptimoCuotas(paquete: PaqueteDistribucion, dias: CapacidadDia[], config: ConfigDistribucion): AnalisisCuotas {
  if (paquete.pago_unico) {
    return {
      numero_cuotas_optimo: 1, cuotas_referencial: 1, dias_disponibles: dias.length,
      capacidad_total_disponible: 0, capacidad_promedio: 0, monto_cuota_promedio: paquete.monto_total,
      limites: { minimo_cuotas: 1, maximo_cuotas: 1 },
      explicacion: "El proveedor tiene condición de 'Pago Único', por lo que se genera una sola cuota.",
    };
  }
  const montoTotal = paquete.monto_total;
  const montoMinimo = config.monto_minimo ?? 100;
  const montoMaximoPreferido = config.monto_maximo_preferido ?? 5000;
  const utiles = dias.filter((d) => (d.estado === 'disponible' || d.estado === 'limitado') && d.capacidad_disponible >= montoMinimo && d.es_habil);
  const totalDias = Math.max(1, utiles.length);
  const capTotal = utiles.reduce((s, d) => s + d.capacidad_disponible, 0);
  const capPromedio = capTotal / totalDias;
  const porCapacidad = capPromedio > 0 ? Math.ceil(montoTotal / capPromedio) : 1;
  // Promedio ponderado: referencial (peso 1) y por capacidad diaria (peso 2.5).
  const optimo = Math.max(1, Math.min(MAX_CUOTAS, redondear((paquete.cuotas_referencial * 1 + porCapacidad * 2.5) / 3.5, 0)));
  return {
    numero_cuotas_optimo: optimo,
    cuotas_referencial: paquete.cuotas_referencial,
    dias_disponibles: totalDias,
    capacidad_total_disponible: redondear(capTotal),
    capacidad_promedio: redondear(capPromedio),
    monto_cuota_promedio: redondear(montoTotal / optimo),
    limites: { minimo_cuotas: Math.max(1, Math.ceil(montoTotal / montoMaximoPreferido)), maximo_cuotas: Math.max(1, Math.floor(montoTotal / montoMinimo)) },
    explicacion: `Se sugieren ${optimo} cuotas distribuidas según capacidad.`,
  };
}

function montosProporcionales(montoTotal: number, cuotas: number, disponibles: CapacidadDia[]): number[] {
  if (cuotas <= 1) return [montoTotal];
  const mejores = disponibles.slice(0, cuotas);
  const capTotal = mejores.reduce((s, d) => s + d.capacidad_disponible, 0);
  if (capTotal <= 0) return Array.from({ length: cuotas }, () => redondear(montoTotal / cuotas));
  const montos = mejores.map((d) => redondear(montoTotal * (d.capacidad_disponible / capTotal)));
  const diferencia = montoTotal - montos.reduce((s, x) => s + x, 0);
  if (Math.abs(diferencia) > 0.001) montos[0] = redondear(montos[0] + diferencia);
  return montos;
}

function estadoLetra(pct: number, tolerancia: number): EstadoLetraPropuesta {
  if (pct <= 100) return 'valida';
  if (pct <= 100 + tolerancia) return 'advertencia';
  return 'invalida';
}

function observaciones(pct: number, tolerancia: number): string {
  if (pct <= 100) return 'Ok';
  if (pct <= 100 + tolerancia) return `Exceso ${(pct - 100).toFixed(1)}% (Tol)`;
  return `EXCEDE ${(pct - 100).toFixed(1)}%`;
}

/** generarDistribucionOptimaMejorada(): una pasada con una tolerancia fija. */
function distribuirConTolerancia(paquete: PaqueteDistribucion, dias: CapacidadDia[], cuotas: number, tolerancia: number): LetraPropuesta[] {
  const inicio = paquete.fecha_inicio_pago;
  const fin = paquete.fecha_fin_pago;
  const disponibles = dias
    .filter((d) => (d.estado === 'disponible' || d.estado === 'limitado') && d.es_habil)
    // fecha_banco en (inicio, fin]: el día de inicio queda FUERA. En el PHP, DateTime::createFromFormat('Y-m-d')
    // le pone la hora actual al inicio, y la fecha_banco (medianoche) del mismo día resulta "menor"; así se
    // comportó siempre letras-daytona y se mantiene para dar las mismas fechas.
    .filter((d) => { const fb = sumarDias(d.fecha, -DIAS_BANCO); return fb > inicio && fb <= fin; });
  if (disponibles.length === 0) throw new DistribucionError('No hay días disponibles en el rango válido de fechas.');
  if (disponibles.length < cuotas) throw new DistribucionError(`Solo hay ${disponibles.length} días válidos para ${cuotas} cuotas.`);

  // Orden estable por capacidad descendente (usort de PHP 8 también es estable).
  disponibles.sort((a, b) => b.capacidad_disponible - a.capacidad_disponible);
  const mapa = new Map(dias.map((d) => [d.fecha, { ...d }]));
  const montos = montosProporcionales(paquete.monto_total, cuotas, disponibles);
  const usadas = new Set<string>();
  const resultado: LetraPropuesta[] = [];

  montos.forEach((monto, i) => {
    let asignado = false;
    for (const base of disponibles) {
      const fp = base.fecha;
      if (usadas.has(fp)) continue;
      const d = mapa.get(fp);
      if (!d || diaSemanaIso(fp) === 7 || !d.es_habil || d.estado === 'no_habil' || d.tiene_letra_proveedor) continue;
      const pct = d.limite_maximo > 0 ? ((d.monto_programado + monto) / d.limite_maximo) * 100 : 0;
      if (pct > 100 + tolerancia) continue;

      resultado.push({
        numero_cuota: i + 1, monto: redondear(monto), fecha_banco: sumarDias(fp, -DIAS_BANCO), fecha_pago: fp,
        monto_existente: d.monto_programado, monto_total_dia: d.monto_programado + monto, limite_dia: d.limite_maximo,
        estado: estadoLetra(pct, tolerancia), observaciones: observaciones(pct, tolerancia),
      });
      usadas.add(fp);
      d.monto_programado += monto;
      d.capacidad_disponible -= monto;
      asignado = true;
      break;
    }
    if (!asignado) throw new DistribucionError(`No se pudo asignar la cuota ${i + 1} con la tolerancia actual.`);
  });

  resultado.sort((a, b) => a.fecha_pago.localeCompare(b.fecha_pago));
  resultado.forEach((l, k) => { l.numero_cuota = k + 1; });
  return resultado;
}

/** generarDistribucionConToleranciaAdaptativa(): prueba con la tolerancia del usuario y la sube (30/40/50%) si no entra. */
export function generarDistribucion(paquete: PaqueteDistribucion, dias: CapacidadDia[], cuotas: number, config: ConfigDistribucion): ResultadoDistribucion {
  const tolUsuario = Math.trunc(config.tolerancia ?? 20);
  const niveles = [...new Set([tolUsuario, 30, 40, 50].filter((t) => t >= tolUsuario && t <= 50))].sort((a, b) => a - b);
  let ultimoError = '';
  for (const tol of niveles) {
    try {
      const letras = distribuirConTolerancia(paquete, dias, cuotas, tol);
      const mensaje = tol > tolUsuario ? `Tolerancia ajustada al ${tol}% para acomodar las cuotas dentro de los límites diarios.` : '';
      return { letras, tolerancia_utilizada: tol, mensaje_tolerancia: mensaje };
    } catch (err) {
      if (!(err instanceof DistribucionError)) throw err;
      ultimoError = err.message;
    }
  }
  throw new DistribucionError(`No se pudo generar la distribución. Ni con 50% de tolerancia hay espacio suficiente. Último error: ${ultimoError}`);
}

/** Análisis completo (analizar-distribucion-inteligente.php): número óptimo de cuotas + distribución. */
export function analizarDistribucion(datos: DatosDistribucion) {
  const { desde, hasta } = rangoAnalisis(datos.paquete);
  const dias = analizarCapacidadDiaria(datos, desde, hasta);
  const analisis = calcularNumeroOptimoCuotas(datos.paquete, dias, datos.config);
  const resultado = generarDistribucion(datos.paquete, dias, analisis.numero_cuotas_optimo, datos.config);
  return { capacidad_dias: dias, analisis_cuotas: analisis, ...resultado };
}

/** Recálculo con un número de cuotas elegido por el usuario (recalcular-distribucion.php). */
export function recalcularDistribucion(datos: DatosDistribucion, numeroCuotas: number) {
  if (numeroCuotas < 1 || numeroCuotas > MAX_CUOTAS) throw new DistribucionError(`Número de cuotas debe estar entre 1 y ${MAX_CUOTAS}`);
  if (datos.paquete.pago_unico && numeroCuotas > 1) throw new DistribucionError('Proveedor de PAGO ÚNICO. No se permiten múltiples cuotas.');
  const { desde, hasta } = rangoAnalisis(datos.paquete);
  const dias = analizarCapacidadDiaria(datos, desde, hasta);
  const resultado = generarDistribucion(datos.paquete, dias, numeroCuotas, datos.config);
  return { capacidad_dias: dias, ...resultado };
}
