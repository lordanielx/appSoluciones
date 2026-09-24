import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ErrorCode, type SyncOperationType, SyncStatus, type ChecklistResponseDto } from '@meca/shared';
import { db, type OutboxOperation } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/sync-engine';
import { fmtShort } from '@/lib/format';
import { useDocumentTitle, useOnline, useSyncState } from '@/lib/hooks';
import { formatValue } from '@/features/work-orders/components/BundleSections';
import { Alert, Button, EmptyState, Tag } from '@/ui';

const OP_LABELS: Record<SyncOperationType, string> = {
  WORK_ORDER_ACCEPT: 'Aceptación del servicio',
  WORK_ORDER_REJECT: 'Rechazo del servicio',
  WORK_ORDER_START: 'Inicio del servicio',
  WORK_ORDER_SUBMIT: 'Envío a revisión',
  WORK_ORDER_NOTES: 'Observaciones y conclusiones',
  CHECKLIST_RESPONSE_UPDATE: 'Respuesta de checklist',
  EVIDENCE_UPLOAD: 'Fotografía',
  EVIDENCE_DELETE: 'Retiro de fotografía',
  SIGNATURE_UPLOAD: 'Firma',
};

/** Actividad y sincronización (§24): estado de la cola, errores visibles y resolución de conflictos. */
export function SyncPage() {
  useDocumentTitle('Actividad');
  const online = useOnline();
  const sync = useSyncState();
  const data = useLiveQuery(async () => {
    const [ops, orders, responses] = await Promise.all([db.outbox.orderBy('createdAt').toArray(), db.workOrders.toArray(), db.responses.toArray()]);
    return { ops, numbers: new Map(orders.map((o) => [o.id, o.number])), labels: new Map(responses.map((r) => [r.id, r.label])) };
  }, []);
  const ops = data?.ops ?? [];
  const errors = ops.filter((o) => o.status === SyncStatus.ERROR);
  const pending = ops.filter((o) => o.status !== SyncStatus.ERROR);

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sincronización</h1>
          <p className="mt-1 text-sm text-text-muted">
            {!online ? 'Sin conexión. Los cambios se guardan en este dispositivo.' : sync.running ? 'Sincronizando…' : sync.lastSyncAt ? `Última sincronización ${fmtShort(new Date(sync.lastSyncAt))}` : 'Aún no se ha sincronizado en esta sesión.'}
          </p>
        </div>
        <Button variant="secondary" disabled={!online} loading={sync.running} icon={<RefreshCw className="h-4 w-4" />} onClick={() => void syncEngine.run()}>
          Sincronizar
        </Button>
      </header>

      {sync.authRequired && (
        <Alert tone="warning" title="La sesión expiró" action={<Link to="/login" className="text-sm font-semibold underline">Iniciar sesión</Link>}>
          Sus cambios siguen guardados en el dispositivo. Inicie sesión para enviarlos.
        </Alert>
      )}
      {sync.lastError && online && <Alert tone="warning">{sync.lastError}</Alert>}

      <section aria-label="Resumen" className="grid grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border">
        {[
          { label: 'Estado', value: online ? 'En línea' : 'Sin conexión' },
          { label: 'Pendientes', value: String(pending.length) },
          { label: 'Con error', value: String(errors.length) },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-3 py-3">
            <p className="text-2xs uppercase tracking-[0.08em] text-text-muted">{s.label}</p>
            <p className="tabular mt-1 text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </section>

      {errors.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.1em] text-danger">Requieren su atención</h2>
          <ul className="flex flex-col gap-2">
            {errors.map((o) => (
              <ErrorItem key={o.id} op={o} number={data?.numbers.get(o.workOrderId)} label={o.entityId ? data?.labels.get(o.entityId) : undefined} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.1em] text-text-muted">Cambios pendientes</h2>
        {pending.length ? (
          <ul className="divide-y divide-border rounded border border-border bg-surface">
            {pending.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {OP_LABELS[o.operationType]}
                    {o.entityId && data?.labels.get(o.entityId) ? `: ${data.labels.get(o.entityId)}` : ''}
                  </p>
                  <p className="text-xs text-text-muted"><span className="code">{data?.numbers.get(o.workOrderId) ?? ''}</span> · {fmtShort(new Date(o.createdAt))}{o.retryCount > 0 ? ` · ${o.retryCount} reintentos` : ''}</p>
                </div>
                <Tag tone={o.status === SyncStatus.SYNCING ? 'info' : 'warning'}>{o.status === SyncStatus.SYNCING ? 'Enviando' : 'En cola'}</Tag>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Todo está sincronizado" description="No hay cambios pendientes en este dispositivo." />
        )}
      </section>
    </div>
  );
}

function ErrorItem({ op, number, label }: { op: OutboxOperation; number?: string; label?: string }) {
  const conflict = op.errorCode === ErrorCode.VERSION_CONFLICT;
  const server = conflict ? (op.errorData as { server?: ChecklistResponseDto } | undefined)?.server : undefined;
  const mine = op.payload as { value?: unknown };
  return (
    <li className="rounded border border-danger/40 border-l-[3px] border-l-danger bg-surface px-3 py-3">
      <p className="text-sm font-semibold">
        {OP_LABELS[op.operationType]}
        {label ? `: ${label}` : ''} <span className="code ml-1 font-normal text-text-muted">{number}</span>
      </p>
      <p className="mt-1 text-sm text-text">{op.lastError}</p>
      {conflict && server && (
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="border border-border p-2"><dt className="text-text-muted">En este dispositivo</dt><dd className="font-semibold">{formatValue({ ...server, value: (mine.value ?? null) as ChecklistResponseDto['value'] }) ?? '—'}</dd></div>
          <div className="border border-border p-2"><dt className="text-text-muted">En el servidor</dt><dd className="font-semibold">{formatValue(server) ?? '—'}</dd></div>
        </dl>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {conflict ? (
          <>
            <Button size="sm" onClick={() => void syncEngine.resolveConflict(op.id, 'mine')}>Conservar mi valor</Button>
            <Button size="sm" variant="secondary" onClick={() => void syncEngine.resolveConflict(op.id, 'server')}>Usar valor del servidor</Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => void syncEngine.retry(op.id)}>Reintentar</Button>
            <Button size="sm" variant="danger" onClick={() => void syncEngine.discard(op.id)}>Descartar cambio</Button>
          </>
        )}
        <Link to={`/mobile/work-orders/${op.workOrderId}`} className="inline-flex h-8 items-center px-2 text-sm text-electric">Ver orden</Link>
      </div>
    </li>
  );
}
