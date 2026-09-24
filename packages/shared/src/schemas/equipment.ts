import { z } from 'zod';
import { booleanQuery, idSchema, optionalText, paginationQuerySchema, requiredText } from './common';

export const equipmentSchema = z.object({
  clientId: idSchema,
  code: requiredText(40, 'El código interno').transform((v) => v.toUpperCase()),
  name: requiredText(160, 'El nombre'),
  category: optionalText(80),
  brand: optionalText(80),
  model: optionalText(80),
  serial: optionalText(80),
  location: optionalText(200),
  description: optionalText(2000),
  specifications: optionalText(4000),
  notes: optionalText(2000),
});
export type EquipmentInput = z.infer<typeof equipmentSchema>;

export const updateEquipmentSchema = equipmentSchema
  .omit({ clientId: true })
  .partial()
  .extend({ active: z.boolean().optional() });
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;

export const equipmentListQuerySchema = paginationQuerySchema.extend({
  clientId: idSchema.optional(),
  active: booleanQuery,
});
export type EquipmentListQuery = z.infer<typeof equipmentListQuerySchema>;
