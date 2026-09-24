import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Permission, type ChecklistTemplateDto } from '@meca/shared';
import { checklistsApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, DataTable, EmptyState, PageHeader, Pagination, Panel, SearchInput, Select, Tag, type Column } from '@/ui';

const PAGE_SIZE = 20;

export function ChecklistsListPage() {
  useDocumentTitle('Checklists');
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<'true' | 'false' | ''>('true');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['checklists', { q, active, page }],
    queryFn: () => checklistsApi.list({ q, active: active || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<ChecklistTemplateDto>[] = [
    {
      key: 'name',
      header: 'Plantilla',
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{t.name}</p>
          {t.description && <p className="truncate text-xs text-text-muted">{t.description}</p>}
        </div>
      ),
    },
    { key: 'serviceType', header: 'Tipo de servicio', cell: (t) => t.serviceType?.name ?? '—', hideBelow: 'lg' },
    { key: 'items', header: 'Actividades', cell: (t) => <span className="tabular">{t.itemCount}</span>, align: 'right' },
    { key: 'version', header: 'Versión', cell: (t) => <span className="code">v{t.version}</span> },
    { key: 'status', header: 'Estado', cell: (t) => (t.active ? <Tag tone="success">Activa</Tag> : <Tag>Inactiva</Tag>) },
  ];

  return (
    <>
      <PageHeader
        title="Checklists"
        subtitle="Plantillas de actividades que el técnico diligencia en cada orden de trabajo."
        actions={
          can(Permission.CHECKLISTS_MANAGE) && (
            <Link to="/checklists/new">
              <Button variant="accent" icon={<Plus className="h-4 w-4" />}>Nueva plantilla</Button>
            </Link>
          )
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre de plantilla" className="flex-1" />
          <div className="sm:w-44">
            <Select aria-label="Filtrar por estado" value={active} onChange={(e) => { setActive(e.target.value as typeof active); setPage(1); }}>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
              <option value="">Todas</option>
            </Select>
          </div>
        </div>
        <DataTable
          caption="Listado de plantillas de checklist"
          columns={columns}
          rows={query.data?.items}
          loading={query.isLoading}
          rowKey={(t) => t.id}
          onRowClick={(t) => navigate(`/checklists/${t.id}`)}
          mobileCard={(t) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-text-muted">
                  {t.serviceType?.name ?? 'Sin tipo de servicio'} · <span className="tabular">{t.itemCount}</span> actividades
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="code text-text-muted">v{t.version}</span>
                {!t.active && <Tag>Inactiva</Tag>}
              </div>
            </div>
          )}
          empty={<EmptyState title="No hay plantillas con ese criterio" description="Ajuste la búsqueda o cree una plantilla nueva." />}
        />
        {query.data && query.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={setPage} />}
      </Panel>
    </>
  );
}
