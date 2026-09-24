import {
  ResponseType,
  STATUS_VALUES_REQUIRING_OBSERVATION,
  SignatureType,
  StatusValue,
} from './enums';

/** Valor de respuesta según el tipo del ítem. `null` = sin responder. */
export type ChecklistValue = boolean | string | number | string[] | null;

export interface ChecklistItemRules {
  id: string;
  label: string;
  section?: string | null;
  responseType: ResponseType;
  required: boolean;
  evidenceRequired: boolean;
  minPhotos: number;
  observationRequired: boolean;
  options?: readonly string[] | null;
  minValue?: number | null;
  maxValue?: number | null;
}

export interface ChecklistItemState extends ChecklistItemRules {
  value: ChecklistValue;
  observation?: string | null;
  photoCount: number;
}

export function isValueAnswered(type: ResponseType, value: ChecklistValue): boolean {
  if (value === null || value === undefined) return false;
  switch (type) {
    case ResponseType.BOOLEAN:
      return typeof value === 'boolean';
    case ResponseType.NUMBER:
      return typeof value === 'number' && Number.isFinite(value);
    case ResponseType.MULTISELECT:
      return Array.isArray(value) && value.length > 0;
    case ResponseType.TEXT:
    case ResponseType.LONG_TEXT:
    case ResponseType.SELECT:
    case ResponseType.STATUS:
      return typeof value === 'string' && value.trim().length > 0;
  }
}

/**
 * Valida la forma del valor (no si es obligatorio). Devuelve mensaje de error o null.
 * La usa el backend antes de persistir y el frontend antes de guardar localmente.
 */
export function validateValueShape(item: ChecklistItemRules, value: ChecklistValue): string | null {
  if (value === null) return null;
  switch (item.responseType) {
    case ResponseType.BOOLEAN:
      return typeof value === 'boolean' ? null : 'Debe indicar Sí o No.';
    case ResponseType.NUMBER:
      return typeof value === 'number' && Number.isFinite(value) ? null : 'Debe ser un número.';
    case ResponseType.TEXT:
    case ResponseType.LONG_TEXT:
      if (typeof value !== 'string') return 'Debe ser texto.';
      return value.length > (item.responseType === ResponseType.TEXT ? 500 : 5000)
        ? 'El texto es demasiado largo.'
        : null;
    case ResponseType.SELECT:
      if (typeof value !== 'string') return 'Debe seleccionar una opción.';
      return (item.options ?? []).includes(value) ? null : 'La opción seleccionada no es válida.';
    case ResponseType.MULTISELECT:
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'Debe seleccionar opciones válidas.';
      }
      return value.every((v) => (item.options ?? []).includes(v))
        ? null
        : 'Alguna opción seleccionada no es válida.';
    case ResponseType.STATUS:
      return typeof value === 'string' && (Object.values(StatusValue) as string[]).includes(value)
        ? null
        : 'El estado seleccionado no es válido.';
  }
}

export function isOutOfRange(item: ChecklistItemRules, value: ChecklistValue): boolean {
  if (item.responseType !== ResponseType.NUMBER || typeof value !== 'number') return false;
  if (item.minValue !== null && item.minValue !== undefined && value < item.minValue) return true;
  if (item.maxValue !== null && item.maxValue !== undefined && value > item.maxValue) return true;
  return false;
}

/** RB-008 + A-10: ¿exige observación este ítem con el valor actual? */
export function isObservationRequired(item: ChecklistItemRules, value: ChecklistValue): boolean {
  if (item.observationRequired) return true;
  if (
    item.responseType === ResponseType.STATUS &&
    typeof value === 'string' &&
    (STATUS_VALUES_REQUIRING_OBSERVATION as readonly string[]).includes(value)
  ) {
    return true;
  }
  return isOutOfRange(item, value);
}

/** Fotos mínimas exigidas por un ítem (RB-007). No aplica si el ítem se marcó "No aplica". */
export function requiredPhotos(item: ChecklistItemRules, value: ChecklistValue): number {
  if (!item.evidenceRequired) return 0;
  if (item.responseType === ResponseType.STATUS && value === StatusValue.NOT_APPLICABLE) return 0;
  return Math.max(1, item.minPhotos);
}

export const SubmissionIssueCode = {
  ITEM_UNANSWERED: 'ITEM_UNANSWERED',
  ITEM_EVIDENCE_MISSING: 'ITEM_EVIDENCE_MISSING',
  ITEM_OBSERVATION_MISSING: 'ITEM_OBSERVATION_MISSING',
  ITEM_INVALID_VALUE: 'ITEM_INVALID_VALUE',
  NOTES_MISSING: 'NOTES_MISSING',
  TECHNICIAN_SIGNATURE_MISSING: 'TECHNICIAN_SIGNATURE_MISSING',
  CLIENT_SIGNATURE_MISSING: 'CLIENT_SIGNATURE_MISSING',
} as const;
export type SubmissionIssueCode = (typeof SubmissionIssueCode)[keyof typeof SubmissionIssueCode];

export interface SubmissionIssue {
  code: SubmissionIssueCode;
  message: string;
  itemId?: string;
}

export interface SubmissionInput {
  items: readonly ChecklistItemState[];
  technicianNotes: string | null | undefined;
  signatureTypes: readonly SignatureType[];
  clientSignatureWaived: boolean;
}

/** Categorías del resumen de validación (sección 20 del RFP). */
export interface SubmissionSummary {
  checklistComplete: boolean;
  evidenceComplete: boolean;
  observationsComplete: boolean;
  technicianSigned: boolean;
  clientSigned: boolean;
  issues: SubmissionIssue[];
  canSubmit: boolean;
}

/**
 * Evalúa RB-006 a RB-010. Se ejecuta en el dispositivo (para mostrar pendientes
 * aun sin conexión) y en el servidor (fuente de verdad) antes de aceptar el envío.
 */
export function evaluateSubmission(input: SubmissionInput): SubmissionSummary {
  const issues: SubmissionIssue[] = [];
  let checklistComplete = true;
  let evidenceComplete = true;
  let observationsComplete = true;

  for (const item of input.items) {
    const answered = isValueAnswered(item.responseType, item.value);
    const shapeError = answered ? validateValueShape(item, item.value) : null;
    if (shapeError) {
      checklistComplete = false;
      issues.push({
        code: SubmissionIssueCode.ITEM_INVALID_VALUE,
        message: `Respuesta inválida en "${item.label}": ${shapeError}`,
        itemId: item.id,
      });
    } else if (item.required && !answered) {
      checklistComplete = false;
      issues.push({
        code: SubmissionIssueCode.ITEM_UNANSWERED,
        message: `Falta responder "${item.label}".`,
        itemId: item.id,
      });
    }

    const photos = requiredPhotos(item, item.value);
    if (photos > 0 && item.photoCount < photos) {
      evidenceComplete = false;
      issues.push({
        code: SubmissionIssueCode.ITEM_EVIDENCE_MISSING,
        message:
          photos === 1
            ? `Falta evidencia en "${item.label}".`
            : `Faltan fotografías en "${item.label}" (${item.photoCount} de ${photos}).`,
        itemId: item.id,
      });
    }

    if (isObservationRequired(item, item.value) && !item.observation?.trim()) {
      observationsComplete = false;
      issues.push({
        code: SubmissionIssueCode.ITEM_OBSERVATION_MISSING,
        message: `Falta la observación en "${item.label}".`,
        itemId: item.id,
      });
    }
  }

  if (!input.technicianNotes?.trim()) {
    observationsComplete = false;
    issues.push({
      code: SubmissionIssueCode.NOTES_MISSING,
      message: 'Faltan las observaciones y conclusiones técnicas del servicio.',
    });
  }

  const technicianSigned = input.signatureTypes.includes(SignatureType.TECHNICIAN);
  if (!technicianSigned) {
    issues.push({
      code: SubmissionIssueCode.TECHNICIAN_SIGNATURE_MISSING,
      message: 'Falta la firma del técnico.',
    });
  }

  const clientSigned =
    input.signatureTypes.includes(SignatureType.CLIENT) || input.clientSignatureWaived;
  if (!clientSigned) {
    issues.push({
      code: SubmissionIssueCode.CLIENT_SIGNATURE_MISSING,
      message: 'Falta la firma del cliente.',
    });
  }

  return {
    checklistComplete,
    evidenceComplete,
    observationsComplete,
    technicianSigned,
    clientSigned,
    issues,
    canSubmit: issues.length === 0,
  };
}

/** Progreso del checklist: ítems respondidos sobre total. */
export function checklistProgress(items: readonly Pick<ChecklistItemState, 'responseType' | 'value'>[]) {
  const answered = items.filter((i) => isValueAnswered(i.responseType, i.value)).length;
  return { answered, total: items.length };
}
