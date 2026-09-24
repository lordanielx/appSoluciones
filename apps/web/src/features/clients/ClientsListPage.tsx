import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Permission, type ClientDto } from '@meca/shared';
import { clientsApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useDocumentTitle } from '@/lib/hooks';
import { nitWithDv } from '@/lib/format';
import { Button, DataTable, EmptyState, PageHeader, Pagination, Panel, SearchInput, Select, Tag, type Column } from '@/ui';

const PAGE_SIZE = 20;

export function ClientsListPage() {
  useDocumentTitle('Clientes');
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<'true' | 'false' | ''>('true');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['clients', { q, active, page }],
    queryFn: () => clientsApi.list({ q, active: active || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<ClientDto>[] = [
    {
      key: 'name',
      header: 'Razón social',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{c.legalName}</p>
          {c.tradeName && <p className="truncate text-xs text-text-muted">{c.tradeName}</p>}
        </div>
      ),
    },
    { key: 'nit', header: 'NIT', cell: (c) => <span className="code">{nitWithDv(c.nit, c.dv)}</span> },
    { key: 'city', header: 'Ciudad', cell: (c) => [c.city, c.department].filter(Boolean).join(', ') || '—', hideBelow: 'lg' },
    { key: 'contact', header: 'Contacto', cell: (c) => c.contactName ?? '—', hideBelow: 'xl' },
    { key: 'equipment', header: 'Equipos', cell: (c) => <span className="tabular">{c.equipmentCount ?? 0}</span>, align: 'right' },
    { key: 'status', header: 'Estado', cell: (c) => (c.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>) },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Empresas atendidas y sus plantas."
        actions={
          can(Permission.CLIENTS_MANAGE) && (
            <Link to="/clients/new">
              <Button variant="accent" icon={<Plus className="h-4 w-4" />}>Nuevo cliente</Button>
            </Link>
          )
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por razón social, NIT o ciudad" className="flex-1" />
          <div className="sm:w-44">
            <Select aria-label="Filtrar por estado" value={active} onChange={(e) => { setActive(e.target.value as typeof active); setPage(1); }}>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="">Todos</option>
            </Select>
          </div>
        </div>
        <DataTable
          caption="Listado de clientes"
          columns={columns}
          rows={query.data?.items}
          loading={query.isLoading}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/clients/${c.id}`)}
          mobileCard={(c) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.legalName}</p>
                <p className="code text-text-muted">NIT {nitWithDv(c.nit, c.dv)}</p>
                <p className="text-xs text-text-muted">{c.city ?? '—'} · {c.equipmentCount ?? 0} equipos</p>
              </div>
              {!c.active && <Tag>Inactivo</Tag>}
            </div>
          )}
          empty={<EmptyState title="No hay clientes con ese criterio" description="Ajuste la búsqueda o registre un cliente nuevo." />}
        />
        {query.data && query.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={setPage} />}
      </Panel>
    </>
  );
}
