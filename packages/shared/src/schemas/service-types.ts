import { z } from 'zod';
import { optionalText, requiredText } from './common';

export const serviceTypeSchema = z.object({
  code: requiredText(20, 'El código')
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9_-]+$/, { message: 'Use letras, números, guion o guion bajo.' })),
  name: requiredText(120, 'El nombre'),
  description: optionalText(500),
  requiresEquipment: z.boolean().default(true),
});
export type ServiceTypeInput = z.infer<typeof serviceTypeSchema>;

export const updateServiceTypeSchema = serviceTypeSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateServiceTypeInput = z.infer<typeof updateServiceTypeSchema>;
