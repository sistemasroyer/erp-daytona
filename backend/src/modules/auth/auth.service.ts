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
import { DispositivosService } from './dispositivos.service';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private dispositivos: DispositivosService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string, deviceCookie: string) {
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

      },
    });

    usuario.roles = usuario.roles.filter(ur => ur.rol.estado && !ur.rol.eliminado);
    const esSuperadmin = usuario.roles.some((ur) => ur.rol.es_superadmin);
    const deviceId = await this.dispositivos.acceso(usuario.id, esSuperadmin, deviceCookie, ip, userAgent, dto);
    await this.prisma.tbl_usuarios.update({ where: { id: usuario.id }, data: { ultimo_acceso: new Date() } });
    const permisos = esSuperadmin
      ? ['*']
      : [
          ...new Set(
            usuario.roles.flatMap((ur) =>
              ur.rol.permisos.filter(rp => rp.permiso.estado && !rp.permiso.eliminado).map((rp) => `${rp.permiso.modulo}:${rp.permiso.accion}`),
            ),
          ),
        ];

    const roles = usuario.roles.map((ur) => ur.rol.nombre);

    const payload = {
      deviceId,
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
      { sub: usuario.id, email: usuario.email, deviceId },
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
        detalle: deviceId,
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

  async refresh(userId: string, refreshToken: string, deviceId?: string, deviceCookie?: string) {
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

    await this.dispositivos.validar(userId, deviceId, deviceCookie);
    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) throw new UnauthorizedException();
    const tokenValido = await bcrypt.compare(refreshToken, usuario.refresh_token_hash);
    if (!tokenValido) throw new UnauthorizedException('Refresh token inválido');

    usuario.roles = usuario.roles.filter(ur => ur.rol.estado && !ur.rol.eliminado);
    const esSuperadmin = usuario.roles.some((ur) => ur.rol.es_superadmin);
    const permisos = esSuperadmin
      ? ['*']
      : [
          ...new Set(
            usuario.roles.flatMap((ur) =>
              ur.rol.permisos.filter(rp => rp.permiso.estado && !rp.permiso.eliminado).map((rp) => `${rp.permiso.modulo}:${rp.permiso.accion}`),
            ),
          ),
        ];

    const payload = {
      deviceId,
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
      { sub: usuario.id, email: usuario.email, deviceId },
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
