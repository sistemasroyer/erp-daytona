import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'ok' in data) return data;

        if (data && typeof data === 'object' && 'data' in data && 'total' in data) {
          const { data: items, total, page, limit } = data as any;
          return {
            ok: true,
            data: items,
            meta: {
              total,
              page,
              limit,
              totalPages: limit ? Math.ceil(total / limit) : undefined,
            },
          };
        }

        return { ok: true, data };
      }),
    );
  }
}
