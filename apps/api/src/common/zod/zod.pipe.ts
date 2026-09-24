import { type PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@meca/shared';
import type { ZodType } from 'zod';
import { AppException } from '../errors/app.exception';
import { zodErrorDetails } from './zod-error';

export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Revise los datos ingresados.',
        zodErrorDetails(result.error),
      );
    }
    return result.data;
  }
}
