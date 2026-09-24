import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ApiErrorBody } from '@meca/shared';

/**
 * Excepción de dominio con el formato común de error de la API:
 * { code, message, details }. Los mensajes están pensados para el usuario final.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details: Record<string, unknown> = {},
  ) {
    super({ code, message, details } satisfies ApiErrorBody, status);
  }

  static notFound(entity: string) {
    return new AppException(ErrorCode.NOT_FOUND, `${entity} no existe o no tiene acceso.`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'No tiene permisos para realizar esta acción.') {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static conflict(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }

  static unprocessable(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    return new AppException(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }

  static badRequest(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, details);
  }
}
