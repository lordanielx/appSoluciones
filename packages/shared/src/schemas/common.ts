import { z } from 'zod';

export const idSchema = z.string().uuid({ message: 'Identificador inválido.' });

/** Texto opcional: '' se normaliza a null para no guardar cadenas vacías. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Máximo ${max} caracteres.` })
    .nullish()
    .transform((v) => (v ? v : null));

export const requiredText = (max: number, label = 'Este campo') =>
  z
    .string({ message: `${label} es obligatorio.` })
    .trim()
    .min(1, { message: `${label} es obligatorio.` })
    .max(max, { message: `Máximo ${max} caracteres.` });

export const emailSchema = z
  .string({ message: 'El correo es obligatorio.' })
  .trim()
  .toLowerCase()
  .email({ message: 'Correo electrónico inválido.' })
  .max(160);

export const optionalEmail = z
  .union([emailSchema, z.literal('')])
  .nullish()
  .transform((v) => (v ? v : null));

export const phoneSchema = optionalText(40).refine((v) => v === null || /^[0-9+()\-\s.]{7,40}$/.test(v), {
  message: 'Teléfono inválido.',
});

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Color inválido. Use formato #RRGGBB.' });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
