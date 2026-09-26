import { CajaService, CerrarCajaDto } from './caja.service';
import { PrismaService } from '../../database/prisma.service';

describe('Cierre con arqueo final', () => {
  const apertura = { monto_apertura: 100, caja: { id_punto_venta: 'pv' } };
  let tx: any;
  let service: CajaService;
  beforeEach(() => {
    tx = {
      tbl_cajas_aperturas: {
        findFirst: jest.fn().mockResolvedValue(apertura),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ estado: 'cerrada' }),
      },
      tbl_movimientos_caja: { aggregate: jest.fn()
        .mockResolvedValueOnce({ _sum: { monto: 50 } })
        .mockResolvedValueOnce({ _sum: { monto: 20 } }) },
      tbl_cajas_arqueos: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new CajaService({ $transaction: (fn: any) => fn(tx) } as unknown as PrismaService);
  });
  const cerrar = (dto: CerrarCajaDto) => service.cerrarCaja('apertura', dto, 'usuario', 'pv');

  it.each([[2, 100, -30], [0, 0, -130], [3, 150, 20]])('calcula el efectivo con %s billetes y conserva el detalle', async (cantidad, contado, diferencia) => {
    await cerrar({ detalle: [{ denominacion: 50, tipo: 'billete', cantidad }] });
    expect(tx.tbl_cajas_aperturas.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ monto_cierre: contado, monto_sistema: 130, diferencia }),
    }));
    expect(tx.tbl_cajas_arqueos.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      monto_contado: contado, monto_sistema: 130, diferencia,
      detalle_denominaciones: [{ denominacion: 50, tipo: 'billete', cantidad, subtotal: contado }],
    }) });
    for (const [arg] of tx.tbl_movimientos_caja.aggregate.mock.calls) {
      expect(arg.where.OR).toEqual([{ id_metodo_pago: null }, { metodo_pago: { es_efectivo: true } }]);
    }
  });

  it.each([
    undefined, [],
    [{ denominacion: 3, tipo: 'moneda', cantidad: 1 }],
    [{ denominacion: 50, tipo: 'moneda', cantidad: 1 }],
    [{ denominacion: 50, tipo: 'billete', cantidad: -1 }],
    [{ denominacion: 50, tipo: 'billete', cantidad: 1.5 }],
    [{ denominacion: 50, tipo: 'billete', cantidad: 1 }, { denominacion: 50, tipo: 'billete', cantidad: 2 }],
  ].map((detalle) => [detalle]))('rechaza un conteo inválido %#', async (detalle) => {
    await expect(cerrar({ detalle } as CerrarCajaDto)).rejects.toThrow();
    expect(tx.tbl_cajas_aperturas.updateMany).not.toHaveBeenCalled();
  });

  it('no crea otro arqueo si otra solicitud cerró la caja', async () => {
    tx.tbl_cajas_aperturas.updateMany.mockResolvedValue({ count: 0 });
    await expect(cerrar({ detalle: [{ denominacion: 1, tipo: 'moneda', cantidad: 0 }] })).rejects.toThrow('ya fue cerrada');
    expect(tx.tbl_cajas_arqueos.create).not.toHaveBeenCalled();
  });
});
