import { DispositivosService, deviceKey } from './dispositivos.service';
import { DispositivoGuard } from '../../common/guards/dispositivo.guard';

describe('Aprobacion de dispositivos nuevos', () => {
  let db: any;
  let service: DispositivosService;
  const cookie = 'b'.repeat(64);
  const dto = { email: 'dummy@example.test', password: 'dummy-password', zona_horaria: 'America/Lima' };
  beforeEach(() => {
    db = {
      $executeRaw: jest.fn(),
      tbl_dispositivos: {
        findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'device', ...data })),
        update: jest.fn().mockResolvedValue({ id: 'device', estado: 'aprobado' }),
      },
      tbl_logs_acceso: { create: jest.fn() },
      tbl_usuarios: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    db.$transaction = (fn: any) => fn(db);
    service = new DispositivosService(db);
  });
  const login = (admin = false) => service.acceso('user', admin, cookie, '192.0.2.1', 'Mozilla Windows Chrome/100', dto);

  it('registers an ordinary new device as pending without granting access', async () => {
    await expect(login()).rejects.toThrow('pendiente');
    expect(db.tbl_dispositivos.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      estado: 'pendiente', aprobado_en: null, token_dispositivo: deviceKey(cookie, 'user'), ip: '192.0.2.1',
    }) });
    expect(db.tbl_logs_acceso.create).toHaveBeenCalled();
  });
  it('bootstraps only the first superadmin device', async () => {
    await expect(login(true)).resolves.toBe('device');
    expect(db.tbl_dispositivos.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estado: 'aprobado', aprobado_en: expect.any(Date) }) });
  });
  it('requires approval of subsequent administrator devices', async () => {
    db.tbl_dispositivos.findFirst.mockResolvedValue({ id: 'initial-admin-device', estado: 'bloqueado' });
    await expect(login(true)).rejects.toThrow('pendiente');
  });
  it('allows an approved device to return without requesting approval again', async () => {
    db.tbl_dispositivos.findUnique.mockResolvedValue({ id: 'device', estado_registro: true, estado: 'aprobado' });
    await expect(login()).resolves.toBe('device');
    expect(db.tbl_dispositivos.create).not.toHaveBeenCalled();
    expect(db.tbl_dispositivos.update).toHaveBeenCalledWith(expect.objectContaining({ data: { ultima_ip: '192.0.2.1', ultimo_uso: expect.any(Date) } }));
  });
  it.each(['pendiente', 'bloqueado'])('does not auto-approve an existing %s device', async estado => {
    db.tbl_dispositivos.findUnique.mockResolvedValue({ id: 'device', estado_registro: true, estado });
    db.tbl_dispositivos.update.mockResolvedValue({ id: 'device', estado });
    await expect(login(true)).rejects.toThrow();
    expect(db.tbl_dispositivos.create).not.toHaveBeenCalled();
  });
  it('does not resurrect deleted devices', async () => {
    db.tbl_dispositivos.findUnique.mockResolvedValue({ id: 'device', eliminado: true });
    await expect(login(true)).rejects.toThrow('deshabilitado');
  });
  it.each([[undefined, cookie], ['device', undefined], ['device', 'invalid']])('rejects missing or invalid device bindings %#', async (id, value) => {
    await expect(service.validar('user', id, value)).rejects.toThrow();
    expect(db.tbl_dispositivos.findFirst).not.toHaveBeenCalled();
  });
  it('requires an approved record bound to both account and browser', async () => {
    await expect(service.validar('user', 'device', cookie)).rejects.toThrow();
    expect(db.tbl_dispositivos.findFirst).toHaveBeenCalledWith({ where: {
      id: 'device', id_usuario: 'user', token_dispositivo: deviceKey(cookie, 'user'),
      estado: 'aprobado', eliminado: false, estado_registro: true,
    } });
    expect(deviceKey(cookie, 'user')).not.toBe(deviceKey(cookie, 'another-user'));
  });
  it('allows valid bound requests', async () => {
    db.tbl_dispositivos.findFirst.mockResolvedValue({ id: 'device' });
    await expect(service.validar('user', 'device', cookie)).resolves.toBeUndefined();
  });
  it('checks current administrative permissions before approving', async () => {
    await expect(service.decidir('device', 'ordinary-user', 'aprobado', '192.0.2.1')).rejects.toThrow();
    expect(db.tbl_dispositivos.update).not.toHaveBeenCalled();
  });
  it('does not accept a caller-supplied device header instead of the signed session binding', async () => {
    const validar = jest.fn().mockRejectedValue(new Error('missing binding'));
    const guard = new DispositivoGuard({ validar } as any, { getAllAndOverride: () => false } as any);
    const request = { user: { sub: 'user' }, headers: { 'x-device-token': cookie }, cookies: {} };
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request }) };
    await expect(guard.canActivate(context as any)).rejects.toThrow();
    expect(validar).toHaveBeenCalledWith('user', undefined, undefined);
  });
});
