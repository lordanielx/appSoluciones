import { z } from 'zod';
import { booleanQuery, optionalEmail, optionalText, paginationQuerySchema, phoneSchema, requiredText } from './common';

export const nitSchema = z
  .string({ message: 'El NIT es obligatorio.' })
  .trim()
  .transform((v) => v.replace(/[.\s]/g, ''))
  .pipe(z.string().regex(/^\d{5,15}$/, { message: 'NIT inválido. Use solo números, sin dígito de verificación.' }));

export const clientSchema = z.object({
  legalName: requiredText(160, 'La razón social'),
  tradeName: optionalText(160),
  nit: nitSchema,
  dv: z
    .string()
    .trim()
    .regex(/^\d$/, { message: 'El DV es un solo dígito.' })
    .nullish()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  contactName: optionalText(120),
  phone: phoneSchema,
  email: optionalEmail,
  address: optionalText(200),
  city: optionalText(80),
  department: optionalText(80),
  notes: optionalText(2000),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const updateClientSchema = clientSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientListQuerySchema = paginationQuerySchema.extend({ active: booleanQuery });
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
