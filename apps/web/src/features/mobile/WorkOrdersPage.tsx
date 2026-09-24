import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from '@tanstack/react-query';
import { SyncStatus, WorkOrderStatus } from '@meca/shared';
import { db } from '@/lib/offline/db';
import { workOrdersApi } from '@/lib/api/endpoints';
import { useDocumentTitle, useOnline } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { EmptyState, Spinner, WorkOrderCard } from '@/ui';

type Tab = 'active' | 'sent' | 'history';
const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Activas' },
  { key: 'sent', label: 'En revisión' },
  { key: 'history', label: 'Historial' },
];

export function WorkOrdersPage() {
  useDocumentTitle('Mis órdenes');
  const [tab, setTab] = useState<Tab>('active');
  const online = useOnline();
  const data = useLiveQuery(async () => ({ orders: (await db.workOrders.toArray()).sort((a, b) => (a.scheduledStart ?? '9999').localeCompare(b.scheduledStart ?? '9999')), ops: await db.outbox.toArray() }), []);
  // El historial (aprobadas/cerradas) se consulta en línea; no se descarga al dispositivo.
  const history = useQuery({
    queryKey: ['my-history'],
    queryFn: () => workOrdersApi.list({ status: [WorkOrderStatus.APPROVED, WorkOrderStatus.CLOSED, WorkOrderStatus.REJECTED], pageSize: 30, sort: 'updatedAt' }),
    enabled: tab === 'history' && online,
  });

  const orders = (data?.orders ?? []).filter((w) =>
    tab === 'active' ? w.status !== WorkOrderStatus.PENDING_REVIEW : w.status === WorkOrderStatus.PENDING_REVIEW,
  );
  const pending = (id: string) => data?.ops.filter((o) => o.workOrderId === id && o.status !== SyncStatus.SYNCED).length ?? 0;

  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Filtro de órdenes" className="sticky top-14 z-10 grid grid-cols-3 border-b border-border bg-surface">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('h-12 border-b-[3px] text-sm font-medium', tab === t.key ? 'border-accent text-text' : 'border-transparent text-text-muted')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 px-4 py-4">
        {tab !== 'history' ? (
          orders.length ? (
            orders.map((w) => <WorkOrderCard key={w.id} wo={w} to={`/mobile/work-orders/${w.id}`} pending={pending(w.id)} showDate />)
          ) : (
            <EmptyState title={tab === 'active' ? 'No tiene órdenes activas' : 'No hay servicios en revisión'} />
          )
        ) : !online ? (
          <EmptyState title="Historial no disponible sin conexión" description="Las órdenes activas siguen disponibles en la pestaña Activas." />
        ) : history.isLoading ? (
          <Spinner />
        ) : history.data?.items.length ? (
          history.data.items.map((w) => <WorkOrderCard key={w.id} wo={w} to={`/mobile/work-orders/${w.id}`} showDate />)
        ) : (
          <EmptyState title="Aún no tiene servicios finalizados" />
        )}
      </div>
    </div>
  );
}
