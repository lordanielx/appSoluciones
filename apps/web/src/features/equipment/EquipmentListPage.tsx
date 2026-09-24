import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Permission, type EquipmentDto } from '@meca/shared';
import { clientsApi, equipmentApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, DataTable, EmptyState, PageHeader, Pagination, Panel, SearchInput, Select, Tag, type Column } from '@/ui';

const PAGE_SIZE = 20;

export function EquipmentListPage() {
  useDocumentTitle('Equipos');
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [clientId, setClientId] = useState('');
  const [active, setActive] = useState<'true' | 'false' | ''>('true');
  const [page, setPage] = useState(1);

  const clients = useQuery({
    queryKey: ['clients', { active: 'true', pageSize: 100 }],
    queryFn: () => clientsApi.list({ active: 'true', pageSize: 100 }),
    staleTime: 60_000,
  });
  const query = useQuery({
    queryKey: ['equipment', { q, clientId, active, page }],
    queryFn: () =>
      equipmentApi.list({ q, clientId: clientId || undefined, active: active || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<EquipmentDto>[] = [
    { key: 'code', header: 'Código', cell: (e) => <span className="code">{e.code}</span> },
    {
      key: 'name',
      header: 'Equipo',
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{e.name}</p>
          {e.category && <p className="truncate text-xs text-text-muted">{e.category}</p>}
        </div>
      ),
    },
    { key: 'client', header: 'Cliente', cell: (e) => <span className="line-clamp-1">{e.client?.legalName ?? '—'}</span> },
    { key: 'brand', header: 'Marca / modelo', cell: (e) => [e.brand, e.model].filter(Boolean).join(' ') || '—', hideBelow: 'lg' },
    { key: 'serial', header: 'Serial', cell: (e) => <span className="code text-text-muted">{e.serial ?? '—'}</span>, hideBelow: 'xl' },
    { key: 'location', header: 'Ubicación', cell: (e) => <span className="line-clamp-1">{e.location ?? '—'}</span>, hideBelow: 'xl' },
    { key: 'status', header: 'Estado', cell: (e) => (e.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>) },
  ];

  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle="Activos de los clientes con su ficha técnica e historial de servicio."
        actions={
          can(Permission.EQUIPMENT_MANAGE) && (
            <Link to="/equipment/new">
              <Button variant="accent" icon={<Plus className="h-4 w-4" />}>Nuevo equipo</Button>
            </Link>
          )
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row">
          <SearchInput
            value={q}
            onChange={(v) => { setQ(v); setPage(1); }}
            placeholder="Buscar por código, nombre, serial o marca"
            className="flex-1"
          />
          <div className="md:w-64">
            <Select aria-label="Filtrar por cliente" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}>
              <option value="">Todos los clientes</option>
              {clients.data?.items.map((c) => (
                <option key={c.id} value={c.id}>{c.legalName}</option>
              ))}
            </Select>
          </div>
          <div className="md:w-40">
            <Select aria-label="Filtrar por estado" value={active} onChange={(e) => { setActive(e.target.value as typeof active); setPage(1); }}>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="">Todos</option>
            </Select>
          </div>
        </div>
        <DataTable
          caption="Listado de equipos"
          columns={columns}
          rows={query.data?.items}
          loading={query.isLoading}
          rowKey={(e) => e.id}
          onRowClick={(e) => navigate(`/equipment/${e.id}`)}
          mobileCard={(e) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="code">{e.code}</p>
                <p className="truncate font-medium">{e.name}</p>
                <p className="truncate text-xs text-text-muted">{e.client?.legalName ?? '—'}</p>
                {(e.brand || e.model) && <p className="truncate text-xs text-text-muted">{[e.brand, e.model].filter(Boolean).join(' ')}</p>}
              </div>
              {!e.active && <Tag>Inactivo</Tag>}
            </div>
          )}
          empty={<EmptyState title="No hay equipos con ese criterio" description="Ajuste los filtros o registre un equipo nuevo." />}
        />
        {query.data && query.data.total > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={setPage} />
        )}
      </Panel>
    </>
  );
}
