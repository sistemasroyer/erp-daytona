import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DEVICE_COOKIE, DispositivosService } from '../../modules/auth/dispositivos.service';

@Injectable()
export class DispositivoGuard implements CanActivate {
  constructor(private dispositivos: DispositivosService, private reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    if (!request.user) return false;
    await this.dispositivos.validar(request.user.sub, request.user.deviceId, request.cookies?.[DEVICE_COOKIE]);
    return true;
  }
}
