import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { Permission, type EquipmentDto, type WorkOrderListItem } from '@meca/shared';
import { clientsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtDate, nitWithDv } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, DataTable, EmptyState, KeyValue, PageHeader, Panel, Spinner, StatusBadge, Tag, useToast, type Column } from '@/ui';

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const client = useQuery({ queryKey: ['client', id], queryFn: () => clientsApi.get(id) });
  const equipment = useQuery({ queryKey: ['client', id, 'equipment'], queryFn: () => clientsApi.equipment(id, { pageSize: 100 }) });
  const history = useQuery({
    queryKey: ['client', id, 'work-orders'],
    queryFn: () => clientsApi.workOrders(id, { pageSize: 15 }),
    enabled: can(Permission.WORK_ORDERS_READ_ALL),
  });
  useDocumentTitle(client.data?.legalName ?? 'Cliente');

  const toggle = useMutation({
    mutationFn: () => clientsApi.update(id, { active: !client.data?.active }),
    onSuccess: (c) => {
      qc.setQueryData(['client', id], c);
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(c.active ? 'Cliente activado.' : 'Cliente desactivado. Su historial se conserva.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (client.isLoading) return <Spinner />;
  if (client.error || !client.data) return <Alert tone="danger">{errorMessage(client.error)}</Alert>;
  const c = client.data;

  const eqColumns: Column<EquipmentDto>[] = [
    { key: 'code', header: 'Código', cell: (e) => <span className="code">{e.code}</span> },
    { key: 'name', header: 'Equipo', cell: (e) => <span className="font-medium">{e.name}</span> },
    { key: 'brand', header: 'Marca / modelo', cell: (e) => [e.brand, e.model].filter(Boolean).join(' ') || '—', hideBelow: 'lg' },
    { key: 'serial', header: 'Serial', cell: (e) => <span className="code text-text-muted">{e.serial ?? '—'}</span>, hideBelow: 'xl' },
    { key: 'st', header: '', cell: (e) => (!e.active ? <Tag>Inactivo</Tag> : null) },
  ];
  const woColumns: Column<WorkOrderListItem>[] = [
    { key: 'n', header: 'OT', cell: (w) => <span className="code">{w.number}</span> },
    { key: 't', header: 'Servicio', cell: (w) => <span className="line-clamp-1">{w.title}</span> },
    { key: 'e', header: 'Equipo', cell: (w) => w.equipment?.code ?? '—', hideBelow: 'lg' },
    { key: 'd', header: 'Fecha', cell: (w) => fmtDate(w.scheduledStart ?? w.createdAt), hideBelow: 'lg' },
    { key: 's', header: 'Estado', cell: (w) => <StatusBadge status={w.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={c.legalName}
        subtitle={c.tradeName ?? undefined}
        breadcrumb={[{ label: 'Clientes', to: '/clients' }, { label: c.legalName }]}
        meta={
          <>
            <span className="code text-text-muted">NIT {nitWithDv(c.nit, c.dv)}</span>
            {c.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>}
          </>
        }
        actions={
          can(Permission.CLIENTS_MANAGE) && (
            <>
              <Button variant="secondary" onClick={() => toggle.mutate()} loading={toggle.isPending}>
                {c.active ? 'Desactivar' : 'Activar'}
              </Button>
              <Link to={`/clients/${id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Editar</Button>
              </Link>
            </>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title={`Equipos (${equipment.data?.total ?? 0})`}
            flush
            actions={
              can(Permission.EQUIPMENT_MANAGE) && c.active && (
                <Link to={`/equipment/new?clientId=${id}`}>
                  <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />}>Registrar equipo</Button>
                </Link>
              )
            }
          >
            <DataTable
              columns={eqColumns}
              rows={equipment.data?.items}
              loading={equipment.isLoading}
              rowKey={(e) => e.id}
              onRowClick={(e) => navigate(`/equipment/${e.id}`)}
              mobileCard={(e) => (
                <div>
                  <p className="code">{e.code}</p>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-text-muted">{[e.brand, e.model].filter(Boolean).join(' ')}</p>
                </div>
              )}
              empty={<EmptyState title="Sin equipos registrados" />}
            />
          </Panel>
          {can(Permission.WORK_ORDERS_READ_ALL) && (
            <Panel title="Histórico de servicios" flush>
              <DataTable
                columns={woColumns}
                rows={history.data?.items}
                loading={history.isLoading}
                rowKey={(w) => w.id}
                onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
                mobileCard={(w) => (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="code">{w.number}</p>
                      <p className="text-sm">{w.title}</p>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                )}
                empty={<EmptyState title="Aún no hay servicios para este cliente" />}
              />
            </Panel>
          )}
        </div>
        <Panel title="Datos del cliente" as="aside">
          <KeyValue
            columns={1}
            items={[
              { label: 'Contacto principal', value: c.contactName },
              { label: 'Teléfono', value: c.phone },
              { label: 'Correo', value: c.email },
              { label: 'Dirección', value: [c.address, c.city, c.department].filter(Boolean).join(', ') || null },
              { label: 'Observaciones', value: c.notes ? <span className="whitespace-pre-line font-normal">{c.notes}</span> : null },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
