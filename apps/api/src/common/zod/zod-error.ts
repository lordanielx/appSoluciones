import type { ZodError } from 'zod';

/** Convierte un ZodError en { fields: { 'ruta.campo': 'mensaje' } }. */
export function zodErrorDetails(error: ZodError): Record<string, unknown> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return { fields };
}
