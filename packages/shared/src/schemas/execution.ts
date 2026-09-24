import { z } from 'zod';
import { SignatureType, SyncOperationType } from '../enums';
import { idSchema, optionalText, requiredText } from './common';

export const checklistValueSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().max(5000),
  z.array(z.string().max(80)).max(30),
  z.null(),
]);

export const updateChecklistResponseSchema = z.object({
  value: checklistValueSchema,
  observation: optionalText(2000),
  /** Versión de la respuesta sobre la que el usuario trabajó (optimistic concurrency). */
  baseVersion: z.number().int().min(1),
  /** Si es true se ignora el conflicto de versión (el técnico eligió conservar su valor). */
  force: z.boolean().default(false),
});
export type UpdateChecklistResponseInput = z.input<typeof updateChecklistResponseSchema>;

export const evidenceMetaSchema = z.object({
  id: idSchema,
  checklistResponseId: idSchema.nullish().transform((v) => v ?? null),
  caption: optionalText(300),
  capturedAt: z.coerce.date().nullish().transform((v) => v ?? null),
  clientOperationId: idSchema.optional(),
});
export type EvidenceMetaInput = z.input<typeof evidenceMetaSchema>;

export const signatureMetaSchema = z
  .object({
    id: idSchema,
    signatureType: z.enum(SignatureType),
    signerName: requiredText(120, 'El nombre del firmante'),
    signerRole: optionalText(120),
    signedAt: z.coerce.date(),
    consentAccepted: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((v) => v === true || v === 'true'),
    clientOperationId: idSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.signatureType === SignatureType.CLIENT && !v.consentAccepted) {
      ctx.addIssue({
        code: 'custom',
        path: ['consentAccepted'],
        message: 'El responsable del cliente debe aceptar la declaración de conformidad.',
      });
    }
  });
export type SignatureMetaInput = z.input<typeof signatureMetaSchema>;

/** Operación individual del outbox enviada en `POST /sync/batch`. */
export const syncOperationSchema = z.object({
  clientOperationId: idSchema,
  type: z.enum([
    SyncOperationType.WORK_ORDER_ACCEPT,
    SyncOperationType.WORK_ORDER_REJECT,
    SyncOperationType.WORK_ORDER_START,
    SyncOperationType.WORK_ORDER_SUBMIT,
    SyncOperationType.WORK_ORDER_NOTES,
    SyncOperationType.CHECKLIST_RESPONSE_UPDATE,
    SyncOperationType.EVIDENCE_DELETE,
  ]),
  workOrderId: idSchema,
  entityId: idSchema.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.coerce.date(),
});
export type SyncOperationInput = z.input<typeof syncOperationSchema>;

export const syncBatchSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(100),
});
export type SyncBatchInput = z.input<typeof syncBatchSchema>;

export const SyncResultStatus = {
  APPLIED: 'APPLIED',
  DUPLICATE: 'DUPLICATE',
  CONFLICT: 'CONFLICT',
  REJECTED: 'REJECTED',
} as const;
export type SyncResultStatus = (typeof SyncResultStatus)[keyof typeof SyncResultStatus];

export interface SyncOperationResult {
  clientOperationId: string;
  status: SyncResultStatus;
  errorCode?: string;
  message?: string;
  data?: unknown;
}

export const rejectPayloadSchema = z.object({ reason: requiredText(1000, 'El motivo del rechazo').min(5) });
