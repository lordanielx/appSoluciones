import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  OPEN_WORK_ORDER_STATUSES,
  Permission,
  PRIORITY_LABELS,
  Priority,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderStatus,
  type WorkOrderListItem,
} from '@meca/shared';
import { usersApi, workOrdersApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtShort } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, DataTable, EmptyState, PageHeader, Pagination, Panel, PriorityBadge, SearchInput, Select, StatusBadge, type Column } from '@/ui';

const PAGE_SIZE = 25;

export function WorkOrdersListPage() {
  useDocumentTitle('Órdenes de trabajo');
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const group = params.get('group');
  const statuses = group === 'open' ? [...OPEN_WORK_ORDER_STATUSES] : params.getAll('status');
  const technicianId = params.get('technicianId') ?? '';
  const priority = params.get('priority') ?? '';
  const sort = params.get('sort') ?? 'createdAt';

  const update = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const technicians = useQuery({ queryKey: ['technicians'], queryFn: usersApi.technicians, staleTime: 5 * 60_000 });
  const list = useQuery({
    queryKey: ['work-orders', { q, page, statuses, technicianId, priority, sort }],
    queryFn: () =>
      workOrdersApi.list({
        q,
        page,
        pageSize: PAGE_SIZE,
        status: statuses.length ? statuses : undefined,
        technicianId: technicianId || undefined,
        priority: priority || undefined,
        sort,
        order: sort === 'scheduledStart' ? 'asc' : 'desc',
      }),
    placeholderData: keepPreviousData,
  });

  const statusFilterValue = group === 'open' ? 'open' : statuses.length === 1 ? statuses[0] : statuses.length > 1 ? 'multi' : '';

  const columns: Column<WorkOrderListItem>[] = [
    { key: 'n', header: 'OT', cell: (w) => <span className="code">{w.number}</span>, className: 'w-[150px]' },
    {
      key: 'c',
      header: 'Cliente / equipo',
      cell: (w) => (
        <div className="min-w-0 max-w-[360px]">
          <p className="truncate font-medium">{w.client.tradeName ?? w.client.legalName}</p>
          <p className="truncate text-xs text-text-muted">{w.equipment ? `${w.equipment.code} · ${w.equipment.name}` : w.title}</p>
        </div>
      ),
    },
    { key: 'sv', header: 'Servicio', cell: (w) => <span className="line-clamp-1 max-w-[220px]">{w.serviceType.name}</span>, hideBelow: 'xl' },
    { key: 't', header: 'Técnico', cell: (w) => w.technician?.fullName ?? <span className="text-text-muted">Sin asignar</span>, hideBelow: 'lg' },
    { key: 'd', header: 'Programada', cell: (w) => <span className="tabular whitespace-nowrap">{fmtShort(w.scheduledStart)}</span>, hideBelow: 'lg' },
    { key: 'p', header: 'Prioridad', cell: (w) => <PriorityBadge priority={w.priority} />, hideBelow: 'xl' },
    {
      key: 'pr',
      header: 'Avance',
      cell: (w) => (
        <span className="tabular text-xs text-text-muted">
          {w.checklistProgress.answered}/{w.checklistProgress.total}
        </span>
      ),
      hideBelow: 'xl',
      align: 'right',
    },
    { key: 's', header: 'Estado', cell: (w) => <StatusBadge status={w.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Órdenes de trabajo"
        subtitle="Búsqueda por número de OT, cliente, equipo, serial o técnico."
        actions={
          can(Permission.WORK_ORDERS_MANAGE) && (
            <Link to="/work-orders/new">
              <Button variant="accent" icon={<Plus className="h-4 w-4" />}>Nueva orden</Button>
            </Link>
          )
        }
      />
      <Panel flush>
        <div className="grid gap-2 border-b border-border p-3 md:grid-cols-[1fr_190px_190px] xl:grid-cols-[1fr_190px_190px_150px_170px]">
          <SearchInput value={q} onChange={(v) => update({ q: v })} placeholder="OT-2026-000012, cliente, serial, técnico…" />
          <Select
            aria-label="Estado"
            value={statusFilterValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'open') update({ group: 'open', status: null });
              else update({ group: null, status: v && v !== 'multi' ? v : null });
            }}
          >
            <option value="">Todos los estados</option>
            <option value="open">Abiertas</option>
            {statusFilterValue === 'multi' && <option value="multi">Selección del dashboard</option>}
            {Object.values(WorkOrderStatus).map((s) => (
              <option key={s} value={s}>
                {WORK_ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Técnico" value={technicianId} onChange={(e) => update({ technicianId: e.target.value || null })}>
            <option value="">Todos los técnicos</option>
            {technicians.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
          <Select aria-label="Prioridad" value={priority} onChange={(e) => update({ priority: e.target.value || null })} className="hidden xl:block">
            <option value="">Prioridad</option>
            {Object.values(Priority).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select aria-label="Ordenar" value={sort} onChange={(e) => update({ sort: e.target.value })} className="hidden xl:block">
            <option value="createdAt">Más recientes</option>
            <option value="scheduledStart">Fecha programada</option>
            <option value="updatedAt">Última actividad</option>
            <option value="number">Número de OT</option>
          </Select>
        </div>
        <DataTable
          caption="Órdenes de trabajo"
          columns={columns}
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(w) => w.id}
          onRowClick={(w) => navigate(w.status === WorkOrderStatus.PENDING_REVIEW ? `/work-orders/${w.id}/review` : `/work-orders/${w.id}`)}
          mobileCard={(w) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="code text-text-muted">{w.number}</span>
                <StatusBadge status={w.status} />
              </div>
              <p className="truncate font-medium">{w.client.tradeName ?? w.client.legalName}</p>
              <p className="truncate text-xs text-text-muted">
                {w.equipment ? `${w.equipment.code} · ` : ''}
                {w.technician?.fullName ?? 'Sin asignar'} · {fmtShort(w.scheduledStart)}
              </p>
            </div>
          )}
          empty={<EmptyState title="No hay órdenes con estos filtros" description="Cambie los filtros o cree una nueva orden de trabajo." />}
        />
        {list.data && list.data.total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onChange={(p) => update({ page: String(p) })} />
        )}
      </Panel>
    </>
  );
}
