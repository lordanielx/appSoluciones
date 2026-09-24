import { z } from 'zod';
import { hexColorSchema, optionalEmail, optionalText, phoneSchema, requiredText } from './common';
import { nitSchema } from './clients';

export const brandProfileSchema = z.object({
  name: requiredText(120, 'El nombre'),
  legalName: requiredText(160, 'La razón social'),
  nit: nitSchema,
  address: optionalText(200),
  phone: phoneSchema,
  email: optionalEmail,
  website: optionalText(160).refine((v) => v === null || /^https?:\/\/[^\s]+$/.test(v), {
    message: 'El sitio web debe iniciar con http:// o https://',
  }),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  footerText: optionalText(400),
});
export type BrandProfileInput = z.infer<typeof brandProfileSchema>;

export const updateBrandProfileSchema = brandProfileSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateBrandProfileInput = z.infer<typeof updateBrandProfileSchema>;
