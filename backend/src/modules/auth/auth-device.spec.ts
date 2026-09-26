import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('Login y renovacion con dispositivo aprobado', () => {
  let service: AuthService;
  let db: any;
  let devices: any;
  let jwt: any;
  beforeEach(async () => {
    db = { tbl_usuarios: {
      findFirst: jest.fn().mockResolvedValue({ id: 'dummy', email: 'dummy@example.test', estado: true,
        password_hash: await bcrypt.hash('dummy-password', 4), refresh_token_hash: await bcrypt.hash('dummy-refresh', 4),
        roles: [], nombre: 'Dummy', apellido: 'User', intentos_fallidos: 0 }),
      update: jest.fn(),
    }, tbl_logs_acceso: { create: jest.fn() } };
    devices = { acceso: jest.fn().mockResolvedValue('device'), validar: jest.fn() };
    jwt = { sign: jest.fn().mockReturnValue('dummy-signed-token') };
    service = new AuthService(db, jwt, { get: () => 'dummy-config' } as any, devices);
  });
  it('never issues tokens to a pending device', async () => {
    devices.acceso.mockRejectedValue(new Error('pending'));
    await expect(service.login({ email: 'dummy@example.test', password: 'dummy-password' }, '192.0.2.1', 'dummy-agent', 'cookie')).rejects.toThrow('pending');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  it('checks the password before registering devices', async () => {
    await expect(service.login({ email: 'dummy@example.test', password: 'incorrect' }, '192.0.2.1', 'dummy-agent', 'cookie')).rejects.toThrow();
    expect(devices.acceso).not.toHaveBeenCalled();
  });
  it('binds both issued tokens to the approved device', async () => {
    await service.login({ email: 'dummy@example.test', password: 'dummy-password' }, '192.0.2.1', 'dummy-agent', 'cookie');
    expect(jwt.sign).toHaveBeenCalledTimes(2);
    for (const [payload] of jwt.sign.mock.calls) expect(payload.deviceId).toBe('device');
  });
  it('rejects refresh after a device is blocked', async () => {
    devices.validar.mockRejectedValue(new Error('blocked'));
    await expect(service.refresh('dummy', 'dummy-refresh', 'device', 'cookie')).rejects.toThrow('blocked');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  it('preserves device binding during refresh', async () => {
    await service.refresh('dummy', 'dummy-refresh', 'device', 'cookie');
    expect(devices.validar).toHaveBeenCalledWith('dummy', 'device', 'cookie');
    for (const [payload] of jwt.sign.mock.calls) expect(payload.deviceId).toBe('device');
  });
});
