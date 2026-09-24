import { SyncOperationType, SyncStatus } from '@meca/shared';
import { db, type OutboxEntity, type OutboxOperation } from './db';

/** Operaciones que se fusionan si aún no se enviaron (solo cuenta el último valor). */
const COALESCE: readonly SyncOperationType[] = [SyncOperationType.CHECKLIST_RESPONSE_UPDATE, SyncOperationType.WORK_ORDER_NOTES];

export interface EnqueueInput {
  operationType: SyncOperationType;
  entityType: OutboxEntity;
  entityId?: string;
  workOrderId: string;
  payload?: Record<string, unknown>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
export const onEnqueue = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export async function enqueue(input: EnqueueInput): Promise<string> {
  const id = await db.transaction('rw', db.outbox, async () => {
    if (COALESCE.includes(input.operationType)) {
      const existing = await db.outbox
        .where('workOrderId')
        .equals(input.workOrderId)
        .filter((o) => o.operationType === input.operationType && o.entityId === input.entityId && o.status === SyncStatus.PENDING)
        .first();
      if (existing) {
        // Se conserva la baseVersion original: es la versión que el técnico vio antes de editar.
        const baseVersion = existing.payload.baseVersion;
        await db.outbox.update(existing.id, {
          payload: { ...existing.payload, ...input.payload, ...(baseVersion !== undefined ? { baseVersion } : {}) },
        });
        return existing.id;
      }
    }
    const op: OutboxOperation = {
      id: crypto.randomUUID(),
      operationType: input.operationType,
      entityType: input.entityType,
      entityId: input.entityId,
      workOrderId: input.workOrderId,
      payload: input.payload ?? {},
      createdAt: Date.now(),
      retryCount: 0,
      status: SyncStatus.PENDING,
    };
    await db.outbox.add(op);
    return op.id;
  });
  listeners.forEach((l) => l());
  return id;
}

/** Descarta una operación pendiente (p. ej. evidencia eliminada antes de subirla). */
export async function discardOperation(id: string) {
  await db.outbox.delete(id);
}

export async function pendingOperationsFor(workOrderId: string) {
  return db.outbox.where('workOrderId').equals(workOrderId).filter((o) => o.status !== SyncStatus.SYNCED).count();
}
