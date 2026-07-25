import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? '',
    });
  }

  async validate(payload: any) {
    const usuario = await this.prisma.tbl_usuarios.findFirst({
      where: { id: payload.sub, eliminado: false, estado: true },
      select: { id: true, email: true, estado: true, bloqueado_hasta: true },
    });

    if (!usuario || !usuario.estado) {
      throw new UnauthorizedException('Usuario inactivo o eliminado');
    }

    if (usuario.bloqueado_hasta && new Date() < usuario.bloqueado_hasta) {
      throw new UnauthorizedException('Usuario bloqueado temporalmente');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      roles: payload.roles || [],
      permisos: payload.permisos || [],
      esSuperadmin: payload.esSuperadmin || false,
      idPuntoVenta: payload.idPuntoVenta,
    };
  }
}
