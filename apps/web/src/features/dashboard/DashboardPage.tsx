import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Permission, WorkOrderStatus, type WorkOrderListItem } from '@meca/shared';
import { dashboardApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtLongDay, fmtShort } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Alert, Button, DataTable, EmptyState, PageHeader, Panel, SkeletonRows, StatusBadge, Timeline, type Column } from '@/ui';

interface Indicator {
  label: string;
  value: number | undefined;
  to: string;
  emphasis?: boolean;
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary, refetchInterval: 60_000 });
  const c = q.data?.counters;

  const indicators: Indicator[] = [
    { label: 'Órdenes abiertas', value: c?.open, to: '/work-orders?group=open' },
    { label: 'Asignadas', value: c?.assigned, to: `/work-orders?status=${WorkOrderStatus.ASSIGNED}&status=${WorkOrderStatus.ACCEPTED}` },
    { label: 'En ejecución', value: c?.inProgress, to: `/work-orders?status=${WorkOrderStatus.IN_PROGRESS}` },
    { label: 'Pendientes de revisión', value: c?.pendingReview, to: `/work-orders?status=${WorkOrderStatus.PENDING_REVIEW}`, emphasis: (c?.pendingReview ?? 0) > 0 },
    { label: 'Finalizadas hoy', value: c?.completedToday, to: `/work-orders?status=${WorkOrderStatus.APPROVED}&status=${WorkOrderStatus.CLOSED}` },
  ];

  const columns: Column<WorkOrderListItem>[] = [
    { key: 'n', header: 'OT', cell: (w) => <span className="code">{w.number}</span> },
    {
      key: 'c',
      header: 'Cliente',
      cell: (w) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{w.client.tradeName ?? w.client.legalName}</p>
          <p className="truncate text-xs text-text-muted">{w.equipment ? `${w.equipment.code} · ${w.equipment.name}` : w.title}</p>
        </div>
      ),
    },
    { key: 't', header: 'Técnico', cell: (w) => w.technician?.fullName ?? <span className="text-text-muted">Sin asignar</span>, hideBelow: 'lg' },
    { key: 'd', header: 'Programada', cell: (w) => <span className="tabular">{fmtShort(w.scheduledStart)}</span>, hideBelow: 'xl' },
    { key: 's', header: 'Estado', cell: (w) => <StatusBadge status={w.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={fmtLongDay()}
        actions={
          can(Permission.WORK_ORDERS_MANAGE) && (
            <Link to="/work-orders/new">
              <Button variant="accent" icon={<Plus className="h-4 w-4" />}>Nueva orden</Button>
            </Link>
          )
        }
      />
      {q.error && <Alert tone="danger" className="mb-4">{errorMessage(q.error)}</Alert>}

      {/* Indicadores en una sola franja (no una grilla de tarjetas). */}
      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {indicators.map((it, i) => (
          <Link
            key={it.label}
            to={it.to}
            className={cn('group flex flex-col gap-1 bg-surface px-4 py-4 hover:bg-subtle/60', i === indicators.length - 1 && 'col-span-2 lg:col-span-1')}
          >
            <span className="text-xs font-medium text-text-muted">{it.label}</span>
            <span className={cn('tabular text-3xl font-semibold', it.emphasis ? 'text-accent' : 'text-text')}>{it.value ?? '–'}</span>
            <span className="text-2xs uppercase tracking-[0.08em] text-text-muted group-hover:text-electric">Ver órdenes</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title="Órdenes recientes" flush actions={<Link to="/work-orders" className="text-sm text-electric hover:underline">Ver todas</Link>}>
          <DataTable
            caption="Órdenes recientes"
            columns={columns}
            rows={q.data?.recentWorkOrders}
            loading={q.isLoading}
            rowKey={(w) => w.id}
            onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
            mobileCard={(w) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="code text-text-muted">{w.number}</p>
                  <p className="truncate font-medium">{w.client.tradeName ?? w.client.legalName}</p>
                  <p className="truncate text-xs text-text-muted">{w.technician?.fullName ?? 'Sin asignar'}</p>
                </div>
                <StatusBadge status={w.status} />
              </div>
            )}
            empty={<EmptyState title="Aún no hay órdenes" description="Cree la primera orden de trabajo para iniciar la operación." />}
          />
        </Panel>
        <Panel title="Actividad reciente" as="aside">
          {q.isLoading ? (
            <SkeletonRows rows={6} />
          ) : q.data?.recentActivity.length ? (
            <Timeline
              items={q.data.recentActivity.map((a) => ({
                id: a.id,
                time: fmtShort(a.createdAt),
                title: (
                  <>
                    {a.workOrder && (
                      <Link to={`/work-orders/${a.workOrder.id}`} className="code mr-1.5 text-electric hover:underline">
                        {a.workOrder.number}
                      </Link>
                    )}
                    {a.description}
                  </>
                ),
                actor: a.actor?.fullName,
                tone: a.action === 'WORK_ORDER_SUBMITTED' ? 'accent' : a.action === 'WORK_ORDER_APPROVED' ? 'success' : a.action === 'CHANGES_REQUESTED' || a.action === 'WORK_ORDER_REJECTED' ? 'danger' : 'default',
              }))}
            />
          ) : (
            <p className="text-sm text-text-muted">Sin actividad registrada.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
