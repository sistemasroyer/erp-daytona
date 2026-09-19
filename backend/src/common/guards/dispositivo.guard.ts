import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class DispositivoGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rutas @Public() (login, refresh) todavía no tienen request.user: no aplica bloqueo de dispositivo ahí.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const tokenDispositivo = request.headers['x-device-token'] as string;
    if (!tokenDispositivo) return true;

    const dispositivo = await this.prisma.tbl_dispositivos.findFirst({
      where: {
        id_usuario: user.sub,
        token_dispositivo: tokenDispositivo,
        eliminado: false,
      },
    });

    if (!dispositivo) return true;

    if (dispositivo.estado === 'bloqueado') {
      throw new ForbiddenException('Dispositivo bloqueado. Contacte al administrador.');
    }

    if (dispositivo.estado === 'pendiente') {
      throw new ForbiddenException('Dispositivo pendiente de aprobación por el administrador.');
    }

    await this.prisma.tbl_dispositivos.update({
      where: { id: dispositivo.id },
      data: { ultimo_uso: new Date() },
    });

    return true;
  }
}
