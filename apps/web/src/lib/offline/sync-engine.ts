import {
  BATCHABLE_SYNC_OPERATIONS,
  ErrorCode,
  SyncOperationType,
  SyncResultStatus,
  SyncStatus,
  type ChecklistResponseDto,
  type EvidenceDto,
  type SignatureDto,
  type SyncOperationResult,
  type WorkOrderBundle,
  type WorkOrderStatus,
} from '@meca/shared';
import { api } from '../api/client';
import { syncApi, workOrdersApi } from '../api/endpoints';
import { ApiError, NetworkError } from '../api/errors';
import { db, type LocalWorkOrder, type OutboxOperation } from './db';
import { onEnqueue } from './outbox';

const BATCH_SIZE = 50;
const DEBOUNCE_MS = 800;
const PERIODIC_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export interface SyncState {
  online: boolean;
  running: boolean;
  lastSyncAt: number | null;
  /** La sesión expiró: los cambios esperan a que el técnico vuelva a iniciar sesión. */
  authRequired: boolean;
  lastError: string | null;
}

type Listener = (s: SyncState) => void;

class StopRun extends Error {}

/**
 * Motor de sincronización del técnico (§24–25):
 * 1. Envía el outbox en orden FIFO (lotes JSON + subidas multipart), idempotente por clientOperationId.
 * 2. Descarga las órdenes activas y actualiza IndexedDB sin pisar cambios locales pendientes.
 * Nunca oculta errores: las operaciones rechazadas quedan en estado ERROR visibles al usuario.
 */
class SyncEngine {
  private state: SyncState = { online: navigator.onLine, running: false, lastSyncAt: null, authRequired: false, lastError: null };
  private listeners = new Set<Listener>();
  private timer: number | null = null;
  private started = false;
  private pullEnabled = false;
  private rerun = false;

  getState = () => this.state;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  /** Inicia el motor para el técnico. `pull` descarga sus órdenes asignadas. */
  start({ pull }: { pull: boolean }) {
    this.pullEnabled = pull;
    if (this.started) return this.schedule(0);
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibility);
    onEnqueue(() => this.schedule(DEBOUNCE_MS));
    window.setInterval(() => this.schedule(0), PERIODIC_MS);
    this.schedule(0);
  }

  stop() {
    this.pullEnabled = false;
  }

  private handleOnline = () => {
    this.set({ online: true });
    this.schedule(0);
  };
  private handleOffline = () => this.set({ online: false });
  private handleVisibility = () => {
    if (document.visibilityState === 'visible') this.schedule(0);
  };

  schedule(delay: number) {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.run();
    }, delay);
  }

  /** Ejecuta un ciclo completo. Seguro de llamar varias veces (se serializa). */
  async run(): Promise<void> {
    if (this.state.running) {
      this.rerun = true;
      return;
    }
    if (!navigator.onLine) {
      this.set({ online: false });
      return;
    }
    this.set({ running: true, online: true, lastError: null });
    try {
      if (!api.hasToken()) {
        const session = await api.refresh();
        if (!session) {
          this.set({ authRequired: true });
          return;
        }
      }
      this.set({ authRequired: false });
      await this.pushOutbox();
      if (this.pullEnabled) await this.pull();
      this.set({ lastSyncAt: Date.now() });
    } catch (error) {
      if (error instanceof NetworkError) this.set({ online: navigator.onLine, lastError: error.message });
      else if (error instanceof ApiError && error.status === 401) this.set({ authRequired: true });
      else if (!(error instanceof StopRun)) this.set({ lastError: error instanceof Error ? error.message : 'Error de sincronización.' });
    } finally {
      this.set({ running: false });
      if (this.rerun) {
        this.rerun = false;
        this.schedule(DEBOUNCE_MS);
      }
    }
  }

  // ---------------------------------------------------------------- push

  private async pushOutbox() {
    const now = Date.now();
    // Operaciones que quedaron "SYNCING" por un cierre abrupto vuelven a intentarse (son idempotentes).
    const ops = await db.outbox.orderBy('createdAt').filter((o) => o.status === SyncStatus.PENDING || o.status === SyncStatus.SYNCING).toArray();
    const blocked = new Set((await db.outbox.where('status').equals(SyncStatus.ERROR).toArray()).map((o) => o.workOrderId));

    let i = 0;
    while (i < ops.length) {
      const op = ops[i] as OutboxOperation;
      if (blocked.has(op.workOrderId) || (op.nextAttemptAt && op.nextAttemptAt > now)) {
        // Se respeta el orden: nada posterior de esa orden se envía antes.
        blocked.add(op.workOrderId);
        i++;
        continue;
      }
      if (BATCHABLE_SYNC_OPERATIONS.includes(op.operationType)) {
        const batch: OutboxOperation[] = [];
        while (i < ops.length && batch.length < BATCH_SIZE) {
          const next = ops[i] as OutboxOperation;
          if (!BATCHABLE_SYNC_OPERATIONS.includes(next.operationType)) break;
          if (!blocked.has(next.workOrderId)) batch.push(next);
          i++;
        }
        await this.sendBatch(batch, blocked);
      } else {
        await this.sendUpload(op, blocked);
        i++;
      }
    }
  }

  private async markSyncing(ops: OutboxOperation[]) {
    await db.outbox.bulkUpdate(ops.map((o) => ({ key: o.id, changes: { status: SyncStatus.SYNCING } })));
  }

  private async retryLater(ops: OutboxOperation[]) {
    await db.outbox.bulkUpdate(
      ops.map((o) => ({
        key: o.id,
        changes: {
          status: SyncStatus.PENDING,
          retryCount: o.retryCount + 1,
          nextAttemptAt: Date.now() + Math.min(MAX_BACKOFF_MS, 2 ** o.retryCount * 2000),
        },
      })),
    );
  }

  private async sendBatch(batch: OutboxOperation[], blocked: Set<string>) {
    if (batch.length === 0) return;
    await this.markSyncing(batch);
    let results: SyncOperationResult[];
    try {
      const res = await syncApi.batch(
        batch.map((o) => ({
          clientOperationId: o.id,
          type: o.operationType as never,
          workOrderId: o.workOrderId,
          entityId: o.entityId,
          payload: o.payload,
          createdAt: new Date(o.createdAt).toISOString(),
        })),
      );
      results = res.results;
    } catch (error) {
      await this.retryLater(batch);
      if (error instanceof ApiError && error.status < 500 && error.status !== 401 && error.status !== 429) {
        await this.fail(batch, error.code, error.message, error.details, blocked);
        return;
      }
      throw error;
    }
    for (const result of results) {
      const op = batch.find((o) => o.id === result.clientOperationId);
      if (!op) continue;
      if (result.status === SyncResultStatus.APPLIED || result.status === SyncResultStatus.DUPLICATE) {
        await this.applied(op, result.data);
      } else {
        await this.fail([op], result.errorCode ?? ErrorCode.CONFLICT, result.message ?? 'Operación rechazada por el servidor.', result.data, blocked);
      }
    }
  }

  private async sendUpload(op: OutboxOperation, blocked: Set<string>) {
    const form = new FormData();
    form.append('id', op.entityId ?? '');
    form.append('clientOperationId', op.id);
    if (op.operationType === SyncOperationType.EVIDENCE_UPLOAD) {
      const ev = await db.evidence.get(op.entityId ?? '');
      if (!ev?.blob) {
        await db.outbox.delete(op.id);
        return;
      }
      if (ev.checklistResponseId) form.append('checklistResponseId', ev.checklistResponseId);
      if (ev.caption) form.append('caption', ev.caption);
      if (ev.capturedAt) form.append('capturedAt', ev.capturedAt);
      form.append('file', ev.blob, `${ev.id}.jpg`);
    } else {
      const sig = await db.signatures.get(op.entityId ?? '');
      if (!sig?.pngBlob) {
        await db.outbox.delete(op.id);
        return;
      }
      form.append('signatureType', sig.signatureType);
      form.append('signerName', sig.signerName);
      if (sig.signerRole) form.append('signerRole', sig.signerRole);
      form.append('signedAt', sig.signedAt);
      form.append('consentAccepted', String(sig.consentAccepted));
      form.append('strokes', sig.strokes ?? '');
      form.append('file', sig.pngBlob, `${sig.id}.png`);
    }
    await this.markSyncing([op]);
    try {
      const data =
        op.operationType === SyncOperationType.EVIDENCE_UPLOAD
          ? await syncApi.uploadEvidence(op.workOrderId, form)
          : await syncApi.uploadSignature(op.workOrderId, form);
      await this.applied(op, data);
    } catch (error) {
      if (error instanceof ApiError && error.status < 500 && error.status !== 401 && error.status !== 429) {
        await this.fail([op], error.code, uploadMessage(op, error), error.details, blocked);
        return;
      }
      await this.retryLater([op]);
      throw error;
    }
  }

  private async applied(op: OutboxOperation, data: unknown) {
    await db.transaction('rw', [db.outbox, db.responses, db.workOrders, db.evidence, db.signatures], async () => {
      await db.outbox.delete(op.id);
      switch (op.operationType) {
        case SyncOperationType.CHECKLIST_RESPONSE_UPDATE: {
          const server = data as ChecklistResponseDto | undefined;
          if (!server?.version || !op.entityId) break;
          const stillPending = await db.outbox.where('[entityType+entityId]').equals(['CHECKLIST_RESPONSE', op.entityId]).count();
          await db.responses.update(op.entityId, { serverVersion: server.version, version: server.version, dirty: stillPending > 0 });
          // Si hay una edición posterior en cola, su base pasa a ser la versión recién confirmada.
          if (stillPending > 0) {
            await db.outbox
              .where('[entityType+entityId]')
              .equals(['CHECKLIST_RESPONSE', op.entityId])
              .modify((o) => {
                o.payload = { ...o.payload, baseVersion: server.version };
              });
          }
          break;
        }
        case SyncOperationType.EVIDENCE_UPLOAD: {
          const ev = data as EvidenceDto;
          await db.evidence.update(op.entityId ?? '', { syncStatus: SyncStatus.SYNCED, url: ev.url, thumbnailUrl: ev.thumbnailUrl, blob: undefined });
          break;
        }
        case SyncOperationType.SIGNATURE_UPLOAD: {
          const sig = data as SignatureDto;
          await db.signatures.update(op.entityId ?? '', { syncStatus: SyncStatus.SYNCED, pngUrl: sig.pngUrl });
          break;
        }
        case SyncOperationType.WORK_ORDER_ACCEPT:
        case SyncOperationType.WORK_ORDER_REJECT:
        case SyncOperationType.WORK_ORDER_START:
        case SyncOperationType.WORK_ORDER_SUBMIT: {
          const status = (data as { status?: WorkOrderStatus } | undefined)?.status;
          if (status) await db.workOrders.update(op.workOrderId, { status });
          break;
        }
        default:
          break;
      }
    });
  }

  private async fail(ops: OutboxOperation[], code: string, message: string, details: unknown, blocked: Set<string>) {
    await db.outbox.bulkUpdate(
      ops.map((o) => ({ key: o.id, changes: { status: SyncStatus.ERROR, errorCode: code, lastError: message, errorData: details } })),
    );
    for (const o of ops) {
      blocked.add(o.workOrderId);
      if (o.entityType === 'EVIDENCE') await db.evidence.update(o.entityId ?? '', { syncStatus: SyncStatus.ERROR });
      if (o.entityType === 'SIGNATURE') await db.signatures.update(o.entityId ?? '', { syncStatus: SyncStatus.ERROR });
      // Una transición rechazada: se recupera el estado real de la orden desde el servidor.
      if (o.entityType === 'WORK_ORDER' && code !== ErrorCode.VERSION_CONFLICT) {
        const wo = await workOrdersApi.get(o.workOrderId).catch(() => null);
        if (wo) await db.workOrders.update(o.workOrderId, { status: wo.status, availableActions: wo.availableActions });
      }
    }
  }

  // ---------------------------------------------------------------- pull

  private async pull() {
    const { bundles } = await syncApi.pull();
    const pendingWorkOrders = new Set((await db.outbox.toArray()).map((o) => o.workOrderId));
    const serverIds = new Set(bundles.map((b) => b.workOrder.id));

    for (const bundle of bundles) {
      if (pendingWorkOrders.has(bundle.workOrder.id)) continue; // no pisar cambios locales
      await storeBundle(bundle);
    }
    // Órdenes que ya no están activas (aprobadas, reasignadas): se retiran si no tienen cambios pendientes.
    const local = await db.workOrders.toArray();
    for (const wo of local) {
      if (!serverIds.has(wo.id) && !pendingWorkOrders.has(wo.id)) await removeWorkOrder(wo.id);
    }
    await db.meta.put({ key: 'last-pull', value: new Date().toISOString() });
    void prefetchThumbnails();
  }

  // ---------------------------------------------------------------- acciones del usuario

  async retry(opId: string) {
    await db.outbox.update(opId, { status: SyncStatus.PENDING, lastError: undefined, errorCode: undefined, errorData: undefined, nextAttemptAt: undefined });
    this.schedule(0);
  }

  /** Conflicto de versión: conservar el valor del dispositivo o aceptar el del servidor. */
  async resolveConflict(opId: string, choice: 'mine' | 'server') {
    const op = await db.outbox.get(opId);
    if (!op) return;
    if (choice === 'mine') {
      await db.outbox.update(opId, { status: SyncStatus.PENDING, payload: { ...op.payload, force: true }, lastError: undefined, errorCode: undefined });
    } else {
      const server = (op.errorData as { server?: ChecklistResponseDto } | undefined)?.server;
      if (server && op.entityId) {
        await db.responses.update(op.entityId, { value: server.value, observation: server.observation, version: server.version, serverVersion: server.version, dirty: false });
      }
      await db.outbox.delete(opId);
    }
    this.schedule(0);
  }

  /** Descarta un cambio local rechazado y recupera la versión del servidor. */
  async discard(opId: string) {
    const op = await db.outbox.get(opId);
    if (!op) return;
    await db.outbox.delete(opId);
    if (op.operationType === SyncOperationType.EVIDENCE_UPLOAD) await db.evidence.delete(op.entityId ?? '');
    if (op.operationType === SyncOperationType.SIGNATURE_UPLOAD) await db.signatures.delete(op.entityId ?? '');
    const remaining = await db.outbox.where('workOrderId').equals(op.workOrderId).count();
    if (remaining === 0 && navigator.onLine) {
      const bundle = await workOrdersApi.bundle(op.workOrderId).catch(() => null);
      if (bundle) await storeBundle(bundle);
    }
    this.schedule(0);
  }
}

export async function storeBundle(bundle: WorkOrderBundle) {
  const woId = bundle.workOrder.id;
  const existingEvidence = new Map((await db.evidence.where('workOrderId').equals(woId).toArray()).map((e) => [e.id, e]));
  const localWo: LocalWorkOrder = { ...bundle.workOrder, statusHistory: bundle.statusHistory, downloadedAt: new Date().toISOString() };
  await db.transaction('rw', [db.workOrders, db.responses, db.evidence, db.signatures], async () => {
    await db.workOrders.put(localWo);
    await db.responses.where('workOrderId').equals(woId).delete();
    await db.responses.bulkPut(bundle.checklist.map((r) => ({ ...r, workOrderId: woId, serverVersion: r.version, dirty: false })));
    // Evidencias: se conservan las locales no sincronizadas y los thumbnails ya descargados.
    const serverIds = new Set(bundle.evidence.map((e) => e.id));
    for (const [id, ev] of existingEvidence) {
      if (!serverIds.has(id) && ev.syncStatus === SyncStatus.SYNCED) await db.evidence.delete(id);
    }
    await db.evidence.bulkPut(
      bundle.evidence.map((e) => ({
        id: e.id,
        workOrderId: woId,
        checklistResponseId: e.checklistResponseId,
        caption: e.caption,
        capturedAt: e.capturedAt,
        createdAt: e.uploadedAt,
        url: e.url,
        thumbnailUrl: e.thumbnailUrl,
        thumbBlob: existingEvidence.get(e.id)?.thumbBlob,
        syncStatus: SyncStatus.SYNCED,
      })),
    );
    const localPendingSigs = await db.signatures.where('workOrderId').equals(woId).filter((s) => s.syncStatus !== SyncStatus.SYNCED).toArray();
    await db.signatures.where('workOrderId').equals(woId).filter((s) => s.syncStatus === SyncStatus.SYNCED).delete();
    await db.signatures.bulkPut(
      bundle.signatures
        .filter((s) => !localPendingSigs.some((l) => l.signatureType === s.signatureType))
        .map((s) => ({
          id: s.id,
          workOrderId: woId,
          signatureType: s.signatureType,
          signerName: s.signerName,
          signerRole: s.signerRole,
          signedAt: s.signedAt,
          consentAccepted: s.consentAccepted,
          pngUrl: s.pngUrl,
          syncStatus: SyncStatus.SYNCED,
        })),
    );
  });
}

async function removeWorkOrder(id: string) {
  await db.transaction('rw', [db.workOrders, db.responses, db.evidence, db.signatures], async () => {
    await db.workOrders.delete(id);
    await db.responses.where('workOrderId').equals(id).delete();
    await db.evidence.where('workOrderId').equals(id).delete();
    await db.signatures.where('workOrderId').equals(id).delete();
  });
}

/** Descarga los thumbnails para verlos sin conexión (las URLs firmadas expiran). */
async function prefetchThumbnails() {
  const missing = await db.evidence.filter((e) => !e.thumbBlob && Boolean(e.thumbnailUrl)).limit(40).toArray();
  for (const ev of missing) {
    try {
      const res = await fetch(ev.thumbnailUrl as string);
      if (res.ok) await db.evidence.update(ev.id, { thumbBlob: await res.blob() });
    } catch {
      return;
    }
  }
}

function uploadMessage(op: OutboxOperation, error: ApiError) {
  const what = op.operationType === SyncOperationType.EVIDENCE_UPLOAD ? 'la evidencia' : 'la firma';
  return `No fue posible guardar ${what}: ${error.message}`;
}

export const syncEngine = new SyncEngine();
