import { z } from 'zod';
import { ResponseType } from '../enums';
import { booleanQuery, idSchema, optionalText, paginationQuerySchema, requiredText } from './common';

const OPTION_TYPES: readonly ResponseType[] = [ResponseType.SELECT, ResponseType.MULTISELECT];

export const MAX_PHOTOS_PER_ITEM = 10;

export const checklistItemTemplateSchema = z
  .object({
    id: idSchema.optional(),
    section: optionalText(80),
    label: requiredText(200, 'La actividad'),
    description: optionalText(1000),
    responseType: z.enum(ResponseType),
    required: z.boolean().default(true),
    evidenceRequired: z.boolean().default(false),
    minPhotos: z.number().int().min(0).max(MAX_PHOTOS_PER_ITEM).default(0),
    observationRequired: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    unit: optionalText(20),
    minValue: z.number().finite().nullish().transform((v) => v ?? null),
    maxValue: z.number().finite().nullish().transform((v) => v ?? null),
  })
  .superRefine((item, ctx) => {
    if (OPTION_TYPES.includes(item.responseType)) {
      if (item.options.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Defina al menos dos opciones.' });
      }
      if (new Set(item.options).size !== item.options.length) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Las opciones no pueden repetirse.' });
      }
    }
    if (item.minValue !== null && item.maxValue !== null && item.minValue > item.maxValue) {
      ctx.addIssue({ code: 'custom', path: ['maxValue'], message: 'El máximo debe ser mayor o igual al mínimo.' });
    }
  })
  .transform((item) => ({
    ...item,
    options: OPTION_TYPES.includes(item.responseType) ? item.options : [],
    unit: item.responseType === ResponseType.NUMBER ? item.unit : null,
    minValue: item.responseType === ResponseType.NUMBER ? item.minValue : null,
    maxValue: item.responseType === ResponseType.NUMBER ? item.maxValue : null,
    minPhotos: item.evidenceRequired ? Math.max(1, item.minPhotos) : 0,
  }));
export type ChecklistItemTemplateInput = z.input<typeof checklistItemTemplateSchema>;
export type ChecklistItemTemplateData = z.output<typeof checklistItemTemplateSchema>;

export const checklistTemplateSchema = z.object({
  name: requiredText(160, 'El nombre'),
  serviceTypeId: idSchema.nullish().transform((v) => v ?? null),
  description: optionalText(1000),
  items: z
    .array(checklistItemTemplateSchema)
    .min(1, { message: 'La plantilla debe tener al menos una actividad.' })
    .max(200),
});
export type ChecklistTemplateInput = z.input<typeof checklistTemplateSchema>;
export type ChecklistTemplateData = z.output<typeof checklistTemplateSchema>;

export const updateChecklistTemplateSchema = z.object({
  name: requiredText(160, 'El nombre').optional(),
  serviceTypeId: idSchema.nullish(),
  description: optionalText(1000).optional(),
  active: z.boolean().optional(),
  items: checklistTemplateSchema.shape.items.optional(),
});
export type UpdateChecklistTemplateInput = z.input<typeof updateChecklistTemplateSchema>;

export const checklistTemplateListQuerySchema = paginationQuerySchema.extend({
  active: booleanQuery,
  serviceTypeId: idSchema.optional(),
});
export type ChecklistTemplateListQuery = z.infer<typeof checklistTemplateListQuerySchema>;
