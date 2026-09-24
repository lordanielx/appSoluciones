import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type ApiErrorBody } from '@meca/shared';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ThrottlerException } from '@nestjs/throttler';
import { zodErrorDetails } from '../zod/zod-error';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.FILE_TOO_LARGE,
  429: ErrorCode.RATE_LIMITED,
};

const DEFAULT_MESSAGES: Partial<Record<number, string>> = {
  400: 'La solicitud no es válida.',
  401: 'Debe iniciar sesión para continuar.',
  403: 'No tiene permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  413: 'El archivo supera el tamaño permitido.',
  429: 'Demasiadas solicitudes. Espere un momento e intente nuevamente.',
};

/**
 * Traduce cualquier excepción al formato común. Nunca expone mensajes internos de
 * PostgreSQL/Prisma ni stack traces al cliente.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const { status, body } = this.toBody(exception);
    if (status >= 500) {
      this.logger.error({ err: exception, path: req.url }, 'Error no controlado');
    }
    res.status(status).json({ ...body, requestId: req.id });
  }

  private toBody(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Revise los datos ingresados.',
          details: zodErrorDetails(exception),
        },
      };
    }
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: { code: ErrorCode.RATE_LIMITED, message: DEFAULT_MESSAGES[429] as string, details: {} },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        return { status, body: response as ApiErrorBody };
      }
      return {
        status,
        body: {
          code: STATUS_CODES[status] ?? ErrorCode.INTERNAL_ERROR,
          message: DEFAULT_MESSAGES[status] ?? 'No fue posible procesar la solicitud.',
          details: {},
        },
      };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[] | undefined) ?? [];
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ErrorCode.DUPLICATE,
            message: 'Ya existe un registro con esos datos.',
            details: { fields: target },
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: ErrorCode.NOT_FOUND, message: DEFAULT_MESSAGES[404] as string, details: {} },
        };
      }
      if (exception.code === 'P2003') {
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          body: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Uno de los registros relacionados no existe.',
            details: {},
          },
        };
      }
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Ocurrió un error inesperado en el servidor. El equipo técnico fue notificado en el registro.',
        details: {},
      },
    };
  }
}
