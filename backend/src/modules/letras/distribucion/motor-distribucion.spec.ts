import * as fs from 'fs';
import * as path from 'path';
import {
  analizarDistribucion, recalcularDistribucion, redondear, DistribucionError,
  type DatosDistribucion, type LimiteDia, type LetraProgramada, type PaqueteDistribucion, type ConfigDistribucion,
} from './motor-distribucion';

/**
 * Paridad con letras-daytona: __fixtures__/paridad-php.json tiene 400 escenarios aleatorios y lo que
 * devolvió el motor PHP ORIGINAL (letras-utils.php, sin modificar salvo el login) para cada uno, tanto
 * en "analizar" (cuotas óptimas) como en "recalcular" (cuotas elegidas a mano). El port debe dar
 * exactamente las mismas cuotas, montos, fechas, estados y tolerancia — o el mismo error.
 */
interface Escenario {
  id: number;
  paquete: PaqueteDistribucion;
  config: ConfigDistribucion;
  tipoCambio: number;
  diasNoPago: string[];
  limites: LimiteDia[];
  letrasProgramadas: LetraProgramada[];
  cuotasManual: number;
}
type ResultadoPhp = { error: string } | { cuotas: number; tolerancia: number; letras: { numero_cuota: number; monto: number; fecha_banco: string; fecha_pago: string; estado: string; observaciones: string }[] };

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'paridad-php.json'), 'utf8')) as {
  escenarios: Escenario[];
  php: { id: number; analizar: ResultadoPhp; recalcular: ResultadoPhp }[];
};

const datos = (e: Escenario): DatosDistribucion => ({
  paquete: e.paquete, config: e.config, tipoCambio: e.tipoCambio,
  diasNoPago: new Set(e.diasNoPago), limites: e.limites, letrasProgramadas: e.letrasProgramadas,
});

function comparar(phpRes: ResultadoPhp, correr: () => { cuotas: number; tolerancia_utilizada: number; letras: { numero_cuota: number; monto: number; fecha_banco: string; fecha_pago: string; estado: string; observaciones: string }[] }) {
  if ('error' in phpRes) {
    expect(correr).toThrow(DistribucionError);
    expect(correr).toThrow(phpRes.error);
    return;
  }
  const ts = correr();
  expect(ts.cuotas).toBe(phpRes.cuotas);
  expect(ts.tolerancia_utilizada).toBe(phpRes.tolerancia);
  expect(ts.letras.map((l) => ({
    numero_cuota: l.numero_cuota, monto: l.monto, fecha_banco: l.fecha_banco, fecha_pago: l.fecha_pago, estado: l.estado, observaciones: l.observaciones,
  }))).toEqual(phpRes.letras);
}

describe('Motor de distribución de letras — paridad con letras-daytona (PHP)', () => {
  it('tiene escenarios con resultado y con error', () => {
    expect(fixture.escenarios).toHaveLength(400);
    expect(fixture.php.filter((r) => !('error' in r.analizar)).length).toBeGreaterThan(200);
    expect(fixture.php.filter((r) => 'error' in r.recalcular).length).toBeGreaterThan(50);
  });

  describe.each(fixture.escenarios.map((e, i) => [e.id, e, fixture.php[i]] as const))('escenario %i', (_id, escenario, php) => {
    it('analizar (número óptimo de cuotas) = PHP', () => {
      comparar(php.analizar, () => {
        const r = analizarDistribucion(datos(escenario));
        return { cuotas: r.analisis_cuotas.numero_cuotas_optimo, ...r };
      });
    });
    it('recalcular (cuotas a mano) = PHP', () => {
      comparar(php.recalcular, () => {
        const r = recalcularDistribucion(datos(escenario), escenario.cuotasManual);
        return { cuotas: escenario.cuotasManual, ...r };
      });
    });
  });
});

describe('redondear (round() de PHP)', () => {
  it('redondea .5 hacia afuera sin error de coma flotante', () => {
    expect(redondear(1.005)).toBe(1.01);
    expect(redondear(2.675)).toBe(2.68);
    expect(redondear(-1.005)).toBe(-1.01);
    expect(redondear(2.5, 0)).toBe(3);
  });
});

describe('reglas', () => {
  const base: DatosDistribucion = {
    paquete: { id: 'P', id_proveedor: 'YO', moneda: 'PEN', monto_total: 9000, fecha_inicio_pago: '2026-10-05', fecha_fin_pago: '2026-11-04', cuotas_referencial: 3, pago_unico: false },
    config: {}, tipoCambio: 3.75, diasNoPago: new Set(), limites: [], letrasProgramadas: [],
  };

  it('fecha banco = fecha de pago − 7, nunca domingo ni día de no pago, y la suma cuadra', () => {
    const datosNoPago = { ...base, diasNoPago: new Set(['2026-10-15', '2026-10-16']) };
    const r = recalcularDistribucion(datosNoPago, 3);
    expect(r.letras.reduce((s, l) => s + l.monto, 0)).toBeCloseTo(9000, 2);
    for (const l of r.letras) {
      const pago = new Date(`${l.fecha_pago}T00:00:00Z`);
      expect(pago.getUTCDay()).not.toBe(0);
      expect(datosNoPago.diasNoPago.has(l.fecha_pago)).toBe(false);
      expect((pago.getTime() - new Date(`${l.fecha_banco}T00:00:00Z`).getTime()) / 86_400_000).toBe(7);
    }
  });

  it('no pone dos letras del mismo proveedor el mismo día', () => {
    const ocupados = ['2026-10-12', '2026-10-13', '2026-10-14'];
    const r = recalcularDistribucion({ ...base, letrasProgramadas: ocupados.map((f) => ({ fecha_pago: f, monto: 10, moneda: 'PEN' as const, id_proveedor: 'YO' })) }, 3);
    for (const l of r.letras) expect(ocupados).not.toContain(l.fecha_pago);
  });

  it('pago único: una sola cuota', () => {
    const datosUnico = { ...base, paquete: { ...base.paquete, monto_total: 4000, pago_unico: true } };
    expect(analizarDistribucion(datosUnico).letras).toHaveLength(1);
    expect(() => recalcularDistribucion(datosUnico, 2)).toThrow('PAGO ÚNICO');
  });
});
