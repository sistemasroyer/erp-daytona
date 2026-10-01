import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

const CAMPOS_SENSIBLES = new Set([
  'password',
  'password_hash',
  'refresh_token_hash',
  'refresh_token',
  'access_token',
  'token',
  'secret',
  'pin',
  'pin_hash',
  'autorizacion',
  'token_hash',
]);

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, user, params } = request;

    const metodosAuditar = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!metodosAuditar.includes(method) || !user) return next.handle();

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const { tabla, accion } = this.extraerRuta(url);
          const operacion = this.metodToOperacion(method);
          // En acciones sobre un documento existente (PATCH /ventas/:id/anular, POST /ventas/:id/nota-credito)
          // el registro afectado es el de la URL, no el que devuelve la respuesta (ej. la NC nueva).
          const id_registro = params?.id || response?.data?.id || response?.id || 'N/A';

          await this.prisma.tbl_auditoria.create({
            data: {
              id_usuario: user.sub,
              tabla,
              id_registro: String(id_registro),
              operacion,
              accion,
              datos_nuevos: this.redactar(response?.data ?? response),
              ip: ip || 'unknown',
            },
          });
        } catch (e) {
          this.logger.warn(`Error registrando auditoría: ${e.message}`);
        }
      }),
    );
  }

  private redactar(valor: any, profundidad = 0): any {
    if (valor === null || valor === undefined || profundidad > 5) return valor;

    if (Array.isArray(valor)) {
      return valor.map((v) => this.redactar(v, profundidad + 1));
    }

    // Solo recorrer objetos "planos" (literales/DTOs de Prisma). Date, Decimal
    // y otras instancias con métodos propios (toJSON, etc.) se dejan intactas:
    // Object.entries() no ve sus datos reales y los convertiría en `{}`.
    const esObjetoPlano =
      typeof valor === 'object' &&
      (Object.getPrototypeOf(valor) === Object.prototype || Object.getPrototypeOf(valor) === null);

    if (esObjetoPlano) {
      const resultado: Record<string, any> = {};
      for (const [clave, val] of Object.entries(valor)) {
        resultado[clave] = CAMPOS_SENSIBLES.has(clave)
          ? '[REDACTADO]'
          : this.redactar(val, profundidad + 1);
      }
      return resultado;
    }

    return valor;
  }

  /** "/api/v1/ventas/<uuid>/anular?x=1" → { tabla: 'ventas', accion: 'anular' }. Los segmentos
   * que son ids (uuid) se descartan; lo que queda después del módulo es la acción. */
  private extraerRuta(url: string): { tabla: string; accion: string | null } {
    const partes = url.split('?')[0].split('/').filter(Boolean);
    const inicio = partes.findIndex((p) => /^v\d+$/.test(p));
    const resto = partes.slice(inicio + 1).filter((p) => !ES_UUID.test(p));
    return { tabla: resto[0] || 'desconocido', accion: resto.slice(1).join('/') || null };
  }

  private metodToOperacion(method: string): 'INSERT' | 'UPDATE' | 'DELETE' {
    if (method === 'POST') return 'INSERT';
    if (method === 'DELETE') return 'DELETE';
    return 'UPDATE';
  }
}
