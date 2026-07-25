import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY, PermisoRequerido } from '../decorators/permisos.decorator';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<PermisoRequerido[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permisosRequeridos || permisosRequeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Sin autenticación');

    if (user.esSuperadmin) return true;

    const tienePermiso = permisosRequeridos.every(({ modulo, accion }) =>
      user.permisos?.includes(`${modulo}:${accion}`),
    );

    if (!tienePermiso) {
      throw new ForbiddenException('No tiene permiso para realizar esta acción');
    }

    return true;
  }
}
