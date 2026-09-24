import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'meca-web';

/**
 * Los endpoints que usan la cookie de refresh exigen un encabezado personalizado.
 * Un formulario de otro sitio no puede enviarlo sin pasar por CORS (ASSUMPTIONS A-18).
 */
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
      throw AppException.forbidden('Solicitud rechazada por protección CSRF.');
    }
    return true;
  }
}
