import Dexie, { type EntityTable } from 'dexie';
import type {
  AuthUser,
  ChecklistResponseDto,
  SignatureType,
  StatusHistoryDto,
  SyncOperationType,
  SyncStatus,
  WorkOrderDetail,
} from '@meca/shared';

/** OT descargada. `status`/`technicianNotes` pueden reflejar cambios locales aún no sincronizados. */
export interface LocalWorkOrder extends WorkOrderDetail {
  statusHistory: StatusHistoryDto[];
  downloadedAt: string;
}

export interface LocalResponse extends ChecklistResponseDto {
  workOrderId: string;
  /** Última versión confirmada por el servidor (base de la concurrencia optimista). */
  serverVersion: number;
  dirty: boolean;
}

export interface LocalEvidence {
  id: string;
  workOrderId: string;
  checklistResponseId: string | null;
  caption: string | null;
  capturedAt: string | null;
  createdAt: string;
  /** Archivo comprimido pendiente de subir (se libera tras sincronizar). */
  blob?: Blob;
  thumbBlob?: Blob;
  thumbnailUrl?: string;
  url?: string;
  syncStatus: SyncStatus;
}

export interface LocalSignature {
  id: string;
  workOrderId: string;
  signatureType: SignatureType;
  signerName: string;
  signerRole: string | null;
  signedAt: string;
  consentAccepted: boolean;
  pngBlob?: Blob;
  pngUrl?: string;
  strokes?: string;
  syncStatus: SyncStatus;
}

export type OutboxEntity = 'WORK_ORDER' | 'CHECKLIST_RESPONSE' | 'EVIDENCE' | 'SIGNATURE';

/** Outbox local (§24): cada cambio offline es una operación idempotente. */
export interface OutboxOperation {
  id: string; // clientOperationId / idempotency key
  operationType: SyncOperationType;
  entityType: OutboxEntity;
  entityId?: string;
  workOrderId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  status: SyncStatus;
  lastError?: string;
  errorCode?: string;
  errorData?: unknown;
  nextAttemptAt?: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class MecaDatabase extends Dexie {
  workOrders!: EntityTable<LocalWorkOrder, 'id'>;
  responses!: EntityTable<LocalResponse, 'id'>;
  evidence!: EntityTable<LocalEvidence, 'id'>;
  signatures!: EntityTable<LocalSignature, 'id'>;
  outbox!: EntityTable<OutboxOperation, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = 'mecaelectric-operaciones') {
    super(name);
    this.version(1).stores({
      workOrders: 'id, number, status, scheduledStart',
      responses: 'id, workOrderId, [workOrderId+order]',
      evidence: 'id, workOrderId, checklistResponseId, syncStatus',
      signatures: 'id, workOrderId, [workOrderId+signatureType], syncStatus',
      outbox: 'id, workOrderId, status, createdAt, [entityType+entityId]',
      meta: 'key',
    });
  }
}

export const db = new MecaDatabase();

const SESSION_KEY = 'session-user';

/** Último usuario autenticado (permite abrir la app sin señal). Nunca guarda tokens. */
export async function rememberUser(user: AuthUser) {
  await db.meta.put({ key: SESSION_KEY, value: user });
}

export async function cachedUser(): Promise<AuthUser | null> {
  return ((await db.meta.get(SESSION_KEY))?.value as AuthUser | undefined) ?? null;
}

/** Al cerrar sesión se eliminan los datos del dispositivo (A-24). */
export async function clearLocalData() {
  await db.transaction('rw', [db.workOrders, db.responses, db.evidence, db.signatures, db.outbox, db.meta], async () => {
    await Promise.all([db.workOrders.clear(), db.responses.clear(), db.evidence.clear(), db.signatures.clear(), db.outbox.clear(), db.meta.clear()]);
  });
}
