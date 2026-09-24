import {
  type SignatureType,
  SyncOperationType,
  SyncStatus,
  WorkOrderAction,
  WorkOrderStatus,
  nextStatus,
  type ChecklistValue,
} from '@meca/shared';
import { db, type LocalEvidence } from './db';
import { discardOperation, enqueue } from './outbox';
import { compressImage } from './image';

/**
 * Acciones del técnico: se aplican primero en IndexedDB (la interfaz responde de inmediato,
 * con o sin señal) y se encolan en el outbox para sincronizar.
 */
async function transition(workOrderId: string, action: WorkOrderAction, operationType: SyncOperationType, payload: Record<string, unknown> = {}) {
  const wo = await db.workOrders.get(workOrderId);
  if (!wo) throw new Error('La orden no está disponible en este dispositivo.');
  const to = nextStatus(action, wo.status);
  if (!to) throw new Error('La acción no es válida en el estado actual de la orden.');
  await db.workOrders.update(workOrderId, {
    status: to,
    ...(action === WorkOrderAction.START && !wo.startedAt ? { startedAt: new Date().toISOString() } : {}),
    ...(action === WorkOrderAction.ACCEPT ? { acceptedAt: new Date().toISOString() } : {}),
    ...(action === WorkOrderAction.SUBMIT ? { submittedAt: new Date().toISOString() } : {}),
    ...(action === WorkOrderAction.REJECT ? { rejectionReason: String(payload.reason ?? '') } : {}),
    availableActions: [],
  });
  await enqueue({ operationType, entityType: 'WORK_ORDER', entityId: workOrderId, workOrderId, payload });
}

export const acceptWorkOrder = (id: string) => transition(id, WorkOrderAction.ACCEPT, SyncOperationType.WORK_ORDER_ACCEPT);
export const rejectWorkOrder = (id: string, reason: string) => transition(id, WorkOrderAction.REJECT, SyncOperationType.WORK_ORDER_REJECT, { reason });
export const startWorkOrder = (id: string) => transition(id, WorkOrderAction.START, SyncOperationType.WORK_ORDER_START);
export const submitWorkOrder = (id: string) => transition(id, WorkOrderAction.SUBMIT, SyncOperationType.WORK_ORDER_SUBMIT);

/** Guardado automático de una respuesta del checklist. */
export async function saveResponse(workOrderId: string, responseId: string, value: ChecklistValue, observation: string | null) {
  const current = await db.responses.get(responseId);
  if (!current) return;
  const same = JSON.stringify(current.value) === JSON.stringify(value) && (current.observation ?? null) === observation;
  if (same) return;
  await db.responses.update(responseId, { value, observation, dirty: true, answeredAt: new Date().toISOString() });
  await enqueue({
    operationType: SyncOperationType.CHECKLIST_RESPONSE_UPDATE,
    entityType: 'CHECKLIST_RESPONSE',
    entityId: responseId,
    workOrderId,
    payload: { value, observation, baseVersion: current.serverVersion },
  });
}

export async function saveTechnicianNotes(workOrderId: string, technicianNotes: string) {
  const wo = await db.workOrders.get(workOrderId);
  if (!wo || (wo.technicianNotes ?? '') === technicianNotes) return;
  await db.workOrders.update(workOrderId, { technicianNotes });
  await enqueue({
    operationType: SyncOperationType.WORK_ORDER_NOTES,
    entityType: 'WORK_ORDER',
    entityId: workOrderId,
    workOrderId,
    payload: { technicianNotes: technicianNotes.trim() ? technicianNotes : null },
  });
}

export async function addEvidence(workOrderId: string, file: File, checklistResponseId: string | null, caption: string | null) {
  const compressed = await compressImage(file);
  const evidence: LocalEvidence = {
    id: crypto.randomUUID(),
    workOrderId,
    checklistResponseId,
    caption,
    capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
    createdAt: new Date().toISOString(),
    blob: compressed.blob,
    thumbBlob: compressed.thumbnail,
    syncStatus: SyncStatus.PENDING,
  };
  await db.evidence.add(evidence);
  await enqueue({
    operationType: SyncOperationType.EVIDENCE_UPLOAD,
    entityType: 'EVIDENCE',
    entityId: evidence.id,
    workOrderId,
  });
  return evidence;
}

export async function removeEvidence(workOrderId: string, evidenceId: string) {
  const ev = await db.evidence.get(evidenceId);
  if (!ev) return;
  const pendingUpload = await db.outbox
    .where('[entityType+entityId]')
    .equals(['EVIDENCE', evidenceId])
    .filter((o) => o.operationType === SyncOperationType.EVIDENCE_UPLOAD && o.status !== SyncStatus.SYNCED)
    .first();
  await db.evidence.delete(evidenceId);
  if (pendingUpload && pendingUpload.status !== SyncStatus.SYNCING) {
    // Nunca llegó al servidor: basta con descartar la subida.
    await discardOperation(pendingUpload.id);
    return;
  }
  await enqueue({ operationType: SyncOperationType.EVIDENCE_DELETE, entityType: 'EVIDENCE', entityId: evidenceId, workOrderId });
}

export interface SignatureCapture {
  signatureType: SignatureType;
  signerName: string;
  signerRole: string | null;
  consentAccepted: boolean;
  png: Blob;
  strokes: string;
}

export async function addSignature(workOrderId: string, capture: SignatureCapture) {
  const id = crypto.randomUUID();
  await db.transaction('rw', db.signatures, async () => {
    await db.signatures.where('[workOrderId+signatureType]').equals([workOrderId, capture.signatureType]).delete();
    await db.signatures.add({
      id,
      workOrderId,
      signatureType: capture.signatureType,
      signerName: capture.signerName,
      signerRole: capture.signerRole,
      signedAt: new Date().toISOString(),
      consentAccepted: capture.consentAccepted,
      pngBlob: capture.png,
      strokes: capture.strokes,
      syncStatus: SyncStatus.PENDING,
    });
  });
  await enqueue({ operationType: SyncOperationType.SIGNATURE_UPLOAD, entityType: 'SIGNATURE', entityId: id, workOrderId });
}

export const isEditable = (status: WorkOrderStatus) =>
  status === WorkOrderStatus.IN_PROGRESS || status === WorkOrderStatus.CHANGES_REQUESTED;
