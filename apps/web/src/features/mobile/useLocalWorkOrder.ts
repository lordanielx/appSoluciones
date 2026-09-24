import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { evaluateSubmission, SyncStatus, type ChecklistValue } from '@meca/shared';
import { db } from '@/lib/offline/db';
import { storeBundle } from '@/lib/offline/sync-engine';
import { workOrdersApi } from '@/lib/api/endpoints';

/**
 * Datos de una OT desde IndexedDB (fuente de la interfaz del técnico, con o sin señal).
 * Si la orden aún no está en el dispositivo y hay conexión, se descarga.
 */
export function useLocalWorkOrder(id: string) {
  const [fetchError, setFetchError] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const [wo, responses, evidence, signatures, ops] = await Promise.all([
      db.workOrders.get(id),
      db.responses.where('workOrderId').equals(id).sortBy('order'),
      db.evidence.where('workOrderId').equals(id).sortBy('createdAt'),
      db.signatures.where('workOrderId').equals(id).toArray(),
      db.outbox.where('workOrderId').equals(id).toArray(),
    ]);
    return { wo: wo ?? null, responses, evidence, signatures, ops };
  }, [id]);

  useEffect(() => {
    if (data && !data.wo && navigator.onLine) {
      workOrdersApi
        .bundle(id)
        .then(storeBundle)
        .catch(() => setFetchError('La orden no está disponible en este dispositivo.'));
    }
  }, [data, id]);

  const summary = data?.wo
    ? evaluateSubmission({
        items: data.responses.map((r) => ({
          ...r,
          value: r.value as ChecklistValue,
          photoCount: data.evidence.filter((e) => e.checklistResponseId === r.id).length,
        })),
        technicianNotes: data.wo.technicianNotes,
        signatureTypes: data.signatures.map((s) => s.signatureType),
        clientSignatureWaived: data.wo.clientSignatureWaived,
      })
    : null;

  return {
    loading: data === undefined || (data !== undefined && !data.wo && !fetchError && navigator.onLine),
    error: data && !data.wo && (!navigator.onLine || fetchError) ? fetchError ?? 'La orden no está descargada en este dispositivo y no hay conexión.' : null,
    wo: data?.wo ?? null,
    responses: data?.responses ?? [],
    evidence: data?.evidence ?? [],
    signatures: data?.signatures ?? [],
    pendingOps: data?.ops.filter((o) => o.status !== SyncStatus.ERROR).length ?? 0,
    errorOps: data?.ops.filter((o) => o.status === SyncStatus.ERROR) ?? [],
    summary,
  };
}
