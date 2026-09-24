import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from '../api/errors';

/**
 * Traslada los errores de validación del servidor (details.fields) a los campos del formulario.
 * El frontend valida por UX; el backend es la fuente de verdad (§53).
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): string {
  if (error instanceof ApiError) {
    const fields = error.fieldErrors;
    for (const [name, message] of Object.entries(fields)) {
      setError(name as Path<T>, { type: 'server', message });
    }
    return Object.keys(fields).length ? 'Revise los campos marcados.' : error.message;
  }
  return errorMessage(error);
}
