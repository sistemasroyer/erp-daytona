import { AprobacionesService } from './aprobaciones.service';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

describe('Autorizaciones de anulacion', () => {
  let service: AprobacionesService;
  let db: any;
  let approval: any;
  const token = 'a'.repeat(64);
  const dto = { autorizacion: token, motivo: 'Documento duplicado' };
  beforeEach(() => {
    approval = { id: 'approval', recurso: 'ventas', id_documento: 'doc', id_solicitante: 'user',
      id_aprobador: 'supervisor', accion: 'anular', motivo: dto.motivo, usada_en: null,
      vence_en: new Date(Date.now() + 60000) };
    db = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      tbl_usuarios: { findFirst: jest.fn().mockResolvedValue({ id: 'user', id_punto_venta: 'pv',
        roles: [{ rol: { estado: true, eliminado: false, es_superadmin: true, permisos: [] } }] }) },
      tbl_ventas: { findUnique: jest.fn().mockResolvedValue({ estado_venta: 'registrada', id_punto_venta: 'pv' }) },
      tbl_autorizaciones: { findUnique: jest.fn().mockImplementation(async () => approval),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), create: jest.fn() },
      tbl_credenciales_aprobacion: { findUnique: jest.fn().mockResolvedValue({ activo: true }), update: jest.fn() },
    };
    db.$transaction = (fn: any) => fn(db);
    service = new AprobacionesService(db);
  });
  const consume = () => service.consumir(db, 'ventas', 'doc', 'user', dto);

  it('consumes a bound token and only queries its hash', async () => {
    await consume();
    expect(db.tbl_autorizaciones.findUnique).toHaveBeenCalledWith({ where: {
      token_hash: createHash('sha256').update(token).digest('hex'),
    } });
    expect(db.tbl_autorizaciones.updateMany).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['recurso', 'compras'], ['id_documento', 'other'], ['id_solicitante', 'other'],
    ['accion', 'editar'], ['motivo', 'Otro motivo'], ['usada_en', new Date()],
    ['vence_en', new Date(0)],
  ])('rejects altered or expired binding %s', async (key, value) => {
    approval[key as string] = value;
    await expect(consume()).rejects.toThrow();
    expect(db.tbl_autorizaciones.updateMany).not.toHaveBeenCalled();
  });
  it('rejects an unknown token', async () => {
    approval = null;
    await expect(consume()).rejects.toThrow();
  });
  it('rejects an atomically consumed token', async () => {
    db.tbl_autorizaciones.updateMany.mockResolvedValue({ count: 0 });
    await expect(consume()).rejects.toThrow();
  });
  it('checks revoked permissions', async () => {
    db.tbl_usuarios.findFirst.mockResolvedValue({ roles: [] });
    await expect(consume()).rejects.toThrow();
    expect(db.tbl_autorizaciones.updateMany).not.toHaveBeenCalled();
  });
  it('checks disabled PINs', async () => {
    db.tbl_credenciales_aprobacion.findUnique.mockResolvedValue({ activo: false });
    await expect(consume()).rejects.toThrow();
  });
  it('rejects a document from another point of sale', async () => {
    db.tbl_usuarios.findFirst.mockResolvedValue({ id_punto_venta: 'other', roles: [{ rol: {
      estado: true, permisos: [{ permiso: { estado: true, modulo: 'ventas', accion: 'anular' } }],
    } }] });
    await expect(consume()).rejects.toThrow();
  });
  it('persists the fifth failed attempt before returning an error', async () => {
    db.tbl_credenciales_aprobacion.findUnique.mockResolvedValue({ id_usuario: 'supervisor', activo: true,
      pin_hash: await bcrypt.hash('123456', 4), intentos_fallidos: 4 });
    await expect(service.aprobar('user', { recurso: 'ventas', id_documento: 'doc',
      id_aprobador: 'supervisor', pin: '654321', motivo: dto.motivo })).rejects.toThrow('PIN incorrecto');
    expect(db.tbl_credenciales_aprobacion.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { intentos_fallidos: 5, bloqueado_hasta: expect.any(Date) },
    }));
    expect(db.tbl_autorizaciones.create).not.toHaveBeenCalled();
  });
  it('issues an expiring random token without storing the plaintext', async () => {
    db.tbl_credenciales_aprobacion.findUnique.mockResolvedValue({ id_usuario: 'supervisor', activo: true,
      pin_hash: await bcrypt.hash('123456', 4), intentos_fallidos: 0 });
    const result = await service.aprobar('user', { recurso: 'ventas', id_documento: 'doc',
      id_aprobador: 'supervisor', pin: '123456', motivo: dto.motivo });
    expect(result.autorizacion).toMatch(/^[a-f0-9]{64}$/);
    const stored = db.tbl_autorizaciones.create.mock.calls[0][0].data;
    expect(stored.token_hash).not.toBe(result.autorizacion);
    expect(result.vence_en.getTime() - Date.now()).toBeLessThanOrEqual(300000);
    expect(result.vence_en.getTime() - Date.now()).toBeGreaterThan(290000);
  });
});
