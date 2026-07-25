import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const usuario = await this.prisma.tbl_usuarios.findFirst({
      where: { email: dto.email, eliminado: false },
      include: {
        roles: {
          where: { eliminado: false, estado: true },
          include: {
            rol: {
              include: {
                permisos: {
                  where: { eliminado: false, estado: true },
                  include: { permiso: true },
                },
              },
            },
          },
        },
      },
    });

    await this.prisma.tbl_logs_acceso.create({
      data: {
        id_usuario: usuario?.id,
        email: dto.email,
        ip,
        accion: 'login',
        resultado: usuario ? 'intento' : 'no_encontrado',
        user_agent: userAgent,
      },
    });

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    if (!usuario.estado) throw new ForbiddenException('Usuario desactivado');

    if (usuario.bloqueado_hasta && new Date() < usuario.bloqueado_hasta) {
      const minutosRestantes = Math.ceil(
        (usuario.bloqueado_hasta.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Cuenta bloqueada. Intente en ${minutosRestantes} minutos`,
      );
    }

    const passwordValido = await bcrypt.compare(dto.password, usuario.password_hash);

    if (!passwordValido) {
      const intentos = usuario.intentos_fallidos + 1;
      const bloqueadoHasta =
        intentos >= MAX_INTENTOS
          ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000)
          : null;

      await this.prisma.tbl_usuarios.update({
        where: { id: usuario.id },
        data: {
          intentos_fallidos: intentos,
          bloqueado_hasta: bloqueadoHasta,
        },
      });

      await this.prisma.tbl_logs_acceso.create({
        data: {
          id_usuario: usuario.id,
          email: dto.email,
          ip,
          accion: 'login',
          resultado: 'password_incorrecto',
          detalle: `Intento ${intentos}/${MAX_INTENTOS}`,
          user_agent: userAgent,
        },
      });

      if (intentos >= MAX_INTENTOS) {
        throw new ForbiddenException(
          `Demasiados intentos fallidos. Cuenta bloqueada por ${BLOQUEO_MINUTOS} minutos`,
        );
      }

      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.tbl_usuarios.update({
      where: { id: usuario.id },
      data: {
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        ultimo_acceso: new Date(),
      },
    });

    const esSuperadmin = usuario.roles.some((ur) => ur.rol.es_superadmin);
    const permisos = esSuperadmin
      ? ['*']
      : [
          ...new Set(
            usuario.roles.flatMap((ur) =>
              ur.rol.permisos.map((rp) => `${rp.permiso.modulo}:${rp.permiso.accion}`),
            ),
          ),
        ];

    const roles = usuario.roles.map((ur) => ur.rol.nombre);

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      nombre: `${usuario.nombre} ${usuario.apellido}`,
      roles,
      permisos,
      esSuperadmin,
      idPuntoVenta: usuario.id_punto_venta,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(
      { sub: usuario.id, email: usuario.email },
      {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.tbl_usuarios.update({
      where: { id: usuario.id },
      data: { refresh_token_hash: refreshTokenHash },
    });

    await this.prisma.tbl_logs_acceso.create({
      data: {
        id_usuario: usuario.id,
        email: dto.email,
        ip,
        accion: 'login',
        resultado: 'exitoso',
        user_agent: userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: `${usuario.nombre} ${usuario.apellido}`,
        roles,
        permisos,
        esSuperadmin,
        idPuntoVenta: usuario.id_punto_venta,
      },
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const usuario = await this.prisma.tbl_usuarios.findFirst({
      where: { id: userId, eliminado: false, estado: true },
      include: {
        roles: {
          where: { eliminado: false, estado: true },
          include: {
            rol: {
              include: {
                permisos: {
                  where: { eliminado: false, estado: true },
                  include: { permiso: true },
                },
              },
            },
          },
        },
      },
    });

    if (!usuario || !usuario.refresh_token_hash) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const tokenValido = await bcrypt.compare(refreshToken, usuario.refresh_token_hash);
    if (!tokenValido) throw new UnauthorizedException('Refresh token inválido');

    const esSuperadmin = usuario.roles.some((ur) => ur.rol.es_superadmin);
    const permisos = esSuperadmin
      ? ['*']
      : [
          ...new Set(
            usuario.roles.flatMap((ur) =>
              ur.rol.permisos.map((rp) => `${rp.permiso.modulo}:${rp.permiso.accion}`),
            ),
          ),
        ];

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      nombre: `${usuario.nombre} ${usuario.apellido}`,
      roles: usuario.roles.map((ur) => ur.rol.nombre),
      permisos,
      esSuperadmin,
      idPuntoVenta: usuario.id_punto_venta,
    };

    const nuevoAccessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const nuevoRefreshToken = this.jwtService.sign(
      { sub: usuario.id, email: usuario.email },
      {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      },
    );

    const nuevoHash = await bcrypt.hash(nuevoRefreshToken, 10);
    await this.prisma.tbl_usuarios.update({
      where: { id: usuario.id },
      data: { refresh_token_hash: nuevoHash },
    });

    return { accessToken: nuevoAccessToken, refreshToken: nuevoRefreshToken };
  }

  async logout(userId: string) {
    await this.prisma.tbl_usuarios.update({
      where: { id: userId },
      data: { refresh_token_hash: null },
    });
    return { message: 'Sesión cerrada correctamente' };
  }

  async registrarDispositivo(userId: string, dto: RegisterDeviceDto, ip: string) {
    const existente = await this.prisma.tbl_dispositivos.findFirst({
      where: {
        id_usuario: userId,
        token_dispositivo: dto.token_dispositivo,
        eliminado: false,
      },
    });

    if (existente) {
      return {
        message: 'Dispositivo ya registrado',
        estado: existente.estado,
        dispositivo: existente,
      };
    }

    const dispositivo = await this.prisma.tbl_dispositivos.create({
      data: {
        id_usuario: userId,
        ip,
        navegador: dto.navegador,
        sistema_operativo: dto.sistema_operativo,
        user_agent: dto.user_agent,
        token_dispositivo: dto.token_dispositivo,
        estado: 'pendiente',
      },
    });

    return {
      message: 'Dispositivo registrado. Pendiente de aprobación por el administrador.',
      estado: 'pendiente',
      dispositivo,
    };
  }

  async aprobarDispositivo(dispositivoId: string, adminId: string) {
    const dispositivo = await this.prisma.tbl_dispositivos.findFirst({
      where: { id: dispositivoId, eliminado: false },
    });

    if (!dispositivo) throw new BadRequestException('Dispositivo no encontrado');

    return this.prisma.tbl_dispositivos.update({
      where: { id: dispositivoId },
      data: { estado: 'aprobado', usuario_modificacion: adminId },
    });
  }

  async bloquearDispositivo(dispositivoId: string, adminId: string) {
    return this.prisma.tbl_dispositivos.update({
      where: { id: dispositivoId },
      data: { estado: 'bloqueado', usuario_modificacion: adminId },
    });
  }

  async getDispositivosPendientes() {
    return this.prisma.tbl_dispositivos.findMany({
      where: { estado: 'pendiente', eliminado: false },
      include: { usuario: { select: { nombre: true, apellido: true, email: true } } },
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  async cambiarPassword(userId: string, passwordActual: string, passwordNuevo: string) {
    const usuario = await this.prisma.tbl_usuarios.findFirst({
      where: { id: userId, eliminado: false },
    });

    if (!usuario) throw new BadRequestException('Usuario no encontrado');

    const valido = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!valido) throw new BadRequestException('Contraseña actual incorrecta');

    const rounds = this.configService.get<number>('security.bcryptRounds') || 12;
    const nuevoHash = await bcrypt.hash(passwordNuevo, rounds);

    await this.prisma.tbl_usuarios.update({
      where: { id: userId },
      data: { password_hash: nuevoHash, refresh_token_hash: null },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
