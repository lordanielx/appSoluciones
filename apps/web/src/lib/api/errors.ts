import { ErrorCode, type ApiErrorBody } from '@meca/shared';

/** Error de la API con el formato común { code, message, details }. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromBody(status: number, body: Partial<ApiErrorBody> | null): ApiError {
    return new ApiError(
      status,
      body?.code ?? ErrorCode.INTERNAL_ERROR,
      body?.message ?? `El servidor respondió con un error (${status}).`,
      body?.details ?? {},
    );
  }

  get fieldErrors(): Record<string, string> {
    const f = this.details.fields;
    return f && typeof f === 'object' ? (f as Record<string, string>) : {};
  }
}

/** Sin conexión o servidor inalcanzable: la operación puede reintentarse. */
export class NetworkError extends Error {
  constructor() {
    super('No hay conexión con el servidor. Verifique la señal e intente nuevamente.');
    this.name = 'NetworkError';
  }
}

export const isNetworkError = (e: unknown): e is NetworkError => e instanceof NetworkError;

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError || e instanceof NetworkError) return e.message;
  return 'No fue posible completar la operación. Intente nuevamente.';
}
