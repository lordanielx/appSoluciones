import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { SyncStatus, WorkOrderStatus } from '@meca/shared';
import { useAuth } from '@/lib/auth/AuthProvider';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/sync-engine';
import { bogotaDayKey, fmtLongDay, fmtShort, greeting } from '@/lib/format';
import { useDocumentTitle, useOnline, useSyncState } from '@/lib/hooks';
import { Alert, Button, EmptyState, WorkOrderCard } from '@/ui';

const ACTIVE: WorkOrderStatus[] = [WorkOrderStatus.ASSIGNED, WorkOrderStatus.ACCEPTED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CHANGES_REQUESTED];

/** Pantalla principal del técnico (§16): saludo, servicios de hoy y lo que requiere atención. */
export function HomePage() {
  useDocumentTitle('Inicio');
  const { user, offlineSession } = useAuth();
  const online = useOnline();
  const sync = useSyncState();
  const data = useLiveQuery(async () => {
    const [orders, ops] = await Promise.all([db.workOrders.toArray(), db.outbox.toArray()]);
    return { orders, ops };
  }, []);
  const today = bogotaDayKey(new Date());
  const orders = (data?.orders ?? []).filter((w) => ACTIVE.includes(w.status));
  const sorted = [...orders].sort((a, b) => (a.scheduledStart ?? '9999').localeCompare(b.scheduledStart ?? '9999'));
  const todays = sorted.filter((w) => w.scheduledStart && bogotaDayKey(w.scheduledStart) === today);
  const corrections = sorted.filter((w) => w.status === WorkOrderStatus.CHANGES_REQUESTED);
  const others = sorted.filter((w) => !todays.includes(w) && !corrections.includes(w));
  const pendingFor = (id: string) => data?.ops.filter((o) => o.workOrderId === id && o.status !== SyncStatus.SYNCED).length ?? 0;
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <header>
        <p className="text-sm text-text-muted">{fmtLongDay()}</p>
        <h1 className="mt-0.5 text-2xl font-semibold">{greeting()}, {firstName}</h1>
      </header>

      {offlineSession && (
        <Alert tone="info" title="Trabajando con datos del dispositivo">Abrió la aplicación sin conexión. Sus cambios se guardan aquí y se sincronizarán al recuperar la señal.</Alert>
      )}

      <section aria-labelledby="hoy">
        <div className="mb-2 flex items-end justify-between border-b-2 border-primary pb-1.5">
          <h2 id="hoy" className="text-sm font-bold uppercase tracking-[0.12em]">Hoy</h2>
          <span className="tabular text-sm text-text-muted">
            {todays.length} {todays.length === 1 ? 'servicio asignado' : 'servicios asignados'}
          </span>
        </div>
        {todays.length ? (
          <ul className="flex flex-col gap-2">
            {todays.map((w) => (
              <li key={w.id}><WorkOrderCard wo={w} to={`/mobile/work-orders/${w.id}`} pending={pendingFor(w.id)} /></li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-text-muted">No tiene servicios programados para hoy.</p>
        )}
      </section>

      {corrections.length > 0 && (
        <section aria-labelledby="corr">
          <h2 id="corr" className="mb-2 border-b border-border pb-1.5 text-sm font-bold uppercase tracking-[0.12em] text-[#9A3412]">Correcciones solicitadas</h2>
          <ul className="flex flex-col gap-2">
            {corrections.map((w) => (
              <li key={w.id}><WorkOrderCard wo={w} to={`/mobile/work-orders/${w.id}`} pending={pendingFor(w.id)} showDate /></li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="prox">
          <h2 id="prox" className="mb-2 border-b border-border pb-1.5 text-sm font-bold uppercase tracking-[0.12em] text-text-muted">Próximos y sin fecha</h2>
          <ul className="flex flex-col gap-2">
            {others.map((w) => (
              <li key={w.id}><WorkOrderCard wo={w} to={`/mobile/work-orders/${w.id}`} pending={pendingFor(w.id)} showDate /></li>
            ))}
          </ul>
        </section>
      )}

      {data && orders.length === 0 && <EmptyState title="Sin órdenes activas" description="Cuando la coordinación le asigne un servicio aparecerá aquí." />}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-text-muted">
        <span>{sync.lastSyncAt ? `Última sincronización ${fmtShort(new Date(sync.lastSyncAt))}` : 'Sin sincronizar en esta sesión'}</span>
        <Button size="sm" variant="secondary" disabled={!online} loading={sync.running} icon={<RefreshCw className="h-4 w-4" />} onClick={() => void syncEngine.run()}>
          Actualizar
        </Button>
      </div>
    </div>
  );
}
