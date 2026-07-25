import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, user } = request;

    const metodosAuditar = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!metodosAuditar.includes(method) || !user) return next.handle();

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const tabla = this.extraerTabla(url);
          const operacion = this.metodToOperacion(method);
          const id_registro = response?.data?.id || response?.id || 'N/A';

          await this.prisma.tbl_auditoria.create({
            data: {
              id_usuario: user.sub,
              tabla,
              id_registro: String(id_registro),
              operacion,
              datos_nuevos: response?.data || response,
              ip: ip || 'unknown',
            },
          });
        } catch (e) {
          this.logger.warn(`Error registrando auditoría: ${e.message}`);
        }
      }),
    );
  }

  private extraerTabla(url: string): string {
    const partes = url.split('/').filter(Boolean);
    return partes[1] || partes[0] || 'desconocido';
  }

  private metodToOperacion(method: string): 'INSERT' | 'UPDATE' | 'DELETE' {
    if (method === 'POST') return 'INSERT';
    if (method === 'DELETE') return 'DELETE';
    return 'UPDATE';
  }
}
