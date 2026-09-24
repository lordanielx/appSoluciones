import { z } from 'zod';
import { Priority, WorkOrderStatus } from '../enums';
import { idSchema, optionalText, paginationQuerySchema, phoneSchema, requiredText } from './common';

const dateTime = z.coerce.date({ message: 'Fecha inválida.' });

const workOrderBase = z.object({
  clientId: idSchema,
  equipmentId: idSchema.nullish().transform((v) => v ?? null),
  representedCompanyId: idSchema,
  checklistTemplateId: idSchema,
  serviceTypeId: idSchema,
  title: requiredText(160, 'El título'),
  description: optionalText(4000),
  serviceScope: optionalText(4000),
  priority: z.enum(Priority).default(Priority.MEDIUM),
  scheduledStart: dateTime.nullish().transform((v) => v ?? null),
  scheduledEnd: dateTime.nullish().transform((v) => v ?? null),
  assignedTechnicianId: idSchema.nullish().transform((v) => v ?? null),
  address: optionalText(200),
  contactName: optionalText(120),
  contactPhone: phoneSchema,
  internalNotes: optionalText(4000),
});

const scheduleRefinement = (
  v: { scheduledStart?: Date | null; scheduledEnd?: Date | null },
  ctx: z.RefinementCtx,
) => {
  if (v.scheduledStart && v.scheduledEnd && v.scheduledEnd < v.scheduledStart) {
    ctx.addIssue({ code: 'custom', path: ['scheduledEnd'], message: 'La hora final debe ser posterior al inicio.' });
  }
};

export const createWorkOrderSchema = workOrderBase
  .extend({
    /** Si es true, la orden se crea y asigna en un solo paso (requiere técnico). */
    assignNow: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    scheduleRefinement(v, ctx);
    if (v.assignNow && !v.assignedTechnicianId) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignedTechnicianId'],
        message: 'Seleccione el técnico para asignar la orden.',
      });
    }
  });
export type CreateWorkOrderInput = z.input<typeof createWorkOrderSchema>;
export type CreateWorkOrderData = z.output<typeof createWorkOrderSchema>;

export const updateWorkOrderSchema = workOrderBase
  .omit({ assignedTechnicianId: true })
  .partial()
  .extend({ version: z.number().int().min(1) })
  .superRefine(scheduleRefinement);
export type UpdateWorkOrderInput = z.input<typeof updateWorkOrderSchema>;
export type UpdateWorkOrderData = z.output<typeof updateWorkOrderSchema>;

export const assignWorkOrderSchema = z.object({ technicianId: idSchema });
export type AssignWorkOrderInput = z.infer<typeof assignWorkOrderSchema>;

export const reasonSchema = (label: string) =>
  z.object({ reason: requiredText(1000, label).min(5, { message: 'Describa el motivo (mínimo 5 caracteres).' }) });

export const rejectWorkOrderSchema = reasonSchema('El motivo del rechazo');
export const cancelWorkOrderSchema = reasonSchema('El motivo de la anulación');
export const clientSignatureWaiverSchema = reasonSchema('El motivo de la excepción');

export const requestChangesSchema = z.object({
  comment: requiredText(2000, 'El comentario').min(5, { message: 'Describa la corrección (mínimo 5 caracteres).' }),
});
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

export const technicianNotesSchema = z.object({ technicianNotes: optionalText(8000) });
export type TechnicianNotesInput = z.infer<typeof technicianNotesSchema>;

export const workOrderListQuerySchema = paginationQuerySchema.extend({
  status: z
    .union([z.enum(WorkOrderStatus), z.array(z.enum(WorkOrderStatus))])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  clientId: idSchema.optional(),
  equipmentId: idSchema.optional(),
  technicianId: idSchema.optional(),
  priority: z.enum(Priority).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['scheduledStart', 'createdAt', 'number', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type WorkOrderListQuery = z.infer<typeof workOrderListQuerySchema>;
