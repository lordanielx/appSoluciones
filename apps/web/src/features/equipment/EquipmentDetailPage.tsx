import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImageOff, Pencil, Upload } from 'lucide-react';
import { Permission, type WorkOrderListItem } from '@meca/shared';
import { equipmentApi, workOrdersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtDate, fmtDateTime, nitWithDv } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { compressImage } from '@/lib/offline/image';
import { Alert, Button, DataTable, EmptyState, KeyValue, PageHeader, Panel, Spinner, StatusBadge, Tag, useToast, type Column } from '@/ui';

const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';

export function EquipmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const canManage = can(Permission.EQUIPMENT_MANAGE);
  const canHistory = can(Permission.WORK_ORDERS_READ_ALL);

  const equipment = useQuery({ queryKey: ['equipment-item', id], queryFn: () => equipmentApi.get(id) });
  const history = useQuery({
    queryKey: ['equipment-item', id, 'work-orders'],
    queryFn: () => workOrdersApi.list({ equipmentId: id, pageSize: 15 }),
    enabled: canHistory,
  });
  useDocumentTitle(equipment.data ? `${equipment.data.code} · ${equipment.data.name}` : 'Equipo');

  const onSaved = (active?: boolean) => {
    void qc.invalidateQueries({ queryKey: ['equipment'] });
    if (equipment.data) void qc.invalidateQueries({ queryKey: ['client', equipment.data.clientId] });
    if (active !== undefined) toast.success(active ? 'Equipo activado.' : 'Equipo desactivado. Su historial se conserva.');
  };

  const toggle = useMutation({
    mutationFn: () => equipmentApi.update(id, { active: !equipment.data?.active }),
    onSuccess: (e) => {
      qc.setQueryData(['equipment-item', id], e);
      onSaved(e.active);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { blob } = await compressImage(file);
      return equipmentApi.uploadPhoto(id, blob);
    },
    onSuccess: (e) => {
      qc.setQueryData(['equipment-item', id], e);
      onSaved();
      toast.success('Fotografía del equipo actualizada correctamente.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!ACCEPTED_IMAGES.split(',').includes(file.type)) {
      toast.error('Formato no admitido. Use una imagen JPG, PNG o WebP.');
      return;
    }
    upload.mutate(file);
  };

  if (equipment.isLoading) return <Spinner />;
  if (equipment.error || !equipment.data) return <Alert tone="danger">{errorMessage(equipment.error)}</Alert>;
  const e = equipment.data;

  const woColumns: Column<WorkOrderListItem>[] = [
    { key: 'n', header: 'OT', cell: (w) => <span className="code">{w.number}</span> },
    { key: 't', header: 'Servicio', cell: (w) => <span className="line-clamp-1">{w.title}</span> },
    { key: 'st', header: 'Tipo', cell: (w) => w.serviceType.name, hideBelow: 'xl' },
    { key: 'tec', header: 'Técnico', cell: (w) => w.technician?.fullName ?? '—', hideBelow: 'lg' },
    { key: 'd', header: 'Fecha', cell: (w) => fmtDate(w.scheduledStart ?? w.createdAt), hideBelow: 'lg' },
    { key: 's', header: 'Estado', cell: (w) => <StatusBadge status={w.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={e.name}
        subtitle={e.category ?? undefined}
        breadcrumb={[{ label: 'Equipos', to: '/equipment' }, { label: e.code }]}
        meta={
          <>
            <span className="code text-text-muted">{e.code}</span>
            {e.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>}
          </>
        }
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={() => toggle.mutate()} loading={toggle.isPending}>
                {e.active ? 'Desactivar' : 'Activar'}
              </Button>
              <Link to={`/equipment/${id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Editar</Button>
              </Link>
            </>
          )
        }
      />
      {!e.active && (
        <Alert tone="warning" className="mb-6">
          Equipo inactivo: no se puede seleccionar en nuevas órdenes de trabajo. Su historial se conserva.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Ficha técnica">
            <KeyValue
              items={[
                { label: 'Código interno', value: <span className="code">{e.code}</span> },
                { label: 'Categoría', value: e.category },
                { label: 'Marca', value: e.brand },
                { label: 'Modelo', value: e.model },
                { label: 'Serial', value: e.serial ? <span className="code">{e.serial}</span> : null },
                { label: 'Ubicación', value: e.location },
              ]}
            />
            {(e.description || e.specifications) && (
              <div className="mt-2 border-t border-border pt-2">
                <KeyValue
                  columns={1}
                  items={[
                    { label: 'Descripción', value: e.description ? <span className="whitespace-pre-line font-normal">{e.description}</span> : null },
                    {
                      label: 'Especificaciones técnicas',
                      value: e.specifications ? <span className="block whitespace-pre-line font-mono text-sm font-normal">{e.specifications}</span> : null,
                    },
                  ]}
                />
              </div>
            )}
          </Panel>
          {canHistory && (
            <Panel title="Histórico de servicios" flush>
              <DataTable
                caption="Órdenes de trabajo del equipo"
                columns={woColumns}
                rows={history.data?.items}
                loading={history.isLoading}
                rowKey={(w) => w.id}
                onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
                mobileCard={(w) => (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="code">{w.number}</p>
                      <p className="truncate text-sm">{w.title}</p>
                      <p className="text-xs text-text-muted">{fmtDate(w.scheduledStart ?? w.createdAt)}</p>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                )}
                empty={<EmptyState title="Aún no hay servicios para este equipo" />}
              />
              {history.error && <div className="p-4"><Alert tone="danger">{errorMessage(history.error)}</Alert></div>}
            </Panel>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Fotografía"
            actions={
              canManage && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_IMAGES}
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Seleccionar fotografía del equipo"
                    onChange={(ev) => onFile(ev.target.files)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Upload className="h-4 w-4" />}
                    loading={upload.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    {e.photoUrl ? 'Reemplazar' : 'Cargar foto'}
                  </Button>
                </>
              )
            }
          >
            {e.photoUrl ? (
              <img src={e.photoUrl} alt={`Fotografía del equipo ${e.code}`} className="aspect-[4/3] w-full rounded-sm border border-border bg-subtle object-contain" />
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border-strong bg-subtle text-text-muted">
                <ImageOff className="h-6 w-6 text-steel" aria-hidden />
                <span className="text-sm">Sin fotografía registrada</span>
              </div>
            )}
          </Panel>
          <Panel title="Cliente y registro" as="aside">
            <KeyValue
              columns={1}
              items={[
                {
                  label: 'Razón social',
                  value: e.client ? (
                    <Link to={`/clients/${e.clientId}`} className="text-electric hover:underline">
                      {e.client.legalName}
                    </Link>
                  ) : (
                    <Link to={`/clients/${e.clientId}`} className="text-electric hover:underline">Ver cliente</Link>
                  ),
                },
                { label: 'NIT', value: e.client ? <span className="code">{nitWithDv(e.client.nit, e.client.dv)}</span> : null },
                { label: 'Observaciones', value: e.notes ? <span className="whitespace-pre-line font-normal">{e.notes}</span> : null },
                { label: 'Registrado', value: fmtDateTime(e.createdAt) },
                { label: 'Última actualización', value: fmtDateTime(e.updatedAt) },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
