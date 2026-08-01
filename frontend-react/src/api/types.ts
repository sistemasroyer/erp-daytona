export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  ok: false;
  statusCode: number;
  message: string;
  errors: string[] | null;
  timestamp: string;
  path: string;
}

export type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

/** Respuesta ya "desenvuelta": los datos mas la paginacion, si la hay. */
export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

export class ApiError extends Error {
  status: number;
  errors: string[] | null;

  constructor(body: ApiErrorBody) {
    super(body.message || 'Error en la solicitud');
    this.name = 'ApiError';
    this.status = body.statusCode;
    this.errors = body.errors;
  }
}
