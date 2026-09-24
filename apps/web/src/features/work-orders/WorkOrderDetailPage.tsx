import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ClipboardCheck, Pencil, UserPlus } from 'lucide-react';
import { Permission, WorkOrderAction, WorkOrderStatus, type WorkOrderDetail } from '@meca/shared';
import { usersApi, workOrdersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtDateTime, nitWithDv } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, FormField, KeyValue, Modal, PageHeader, Panel, PriorityBadge, Select, Spinner, StatusBadge, useToast } from '@/ui';
import { ChecklistReadonly, EvidenceGallery, SignaturesView } from './components/BundleSections';
import { HistoryPanel } from './components/HistoryPanel';
import { ReasonDialog } from './components/ReasonDialog';
import { ReportsPanel } from './components/ReportsPanel';
import { EditWorkOrderDialog } from './components/EditWorkOrderDialog';

const LOCKED: WorkOrderStatus[] = [WorkOrderStatus.APPROVED, WorkOrderStatus.CLOSED, WorkOrderStatus.CANCELLED];
const WAIVABLE: WorkOrderStatus[] = [WorkOrderStatus.ASSIGNED, WorkOrderStatus.ACCEPTED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CHANGES_REQUESTED];

export function WorkOrderDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const bundle = useQuery({ queryKey: ['work-order', id, 'bundle'], queryFn: () => workOrdersApi.bundle(id) });
  const wo = bundle.data?.workOrder;
  useDocumentTitle(wo?.number ?? 'Orden de trabajo');
  const [dialog, setDialog] = useState<null | 'assign' | 'cancel' | 'waive' | 'edit'>(null);

  const refresh = (updated?: WorkOrderDetail) => {
    void qc.invalidateQueries({ queryKey: ['work-order', id] });
    void qc.invalidateQueries({ queryKey: ['work-orders'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    return updated;
  };
  const run = useMutation({
    mutationFn: async (fn: () => Promise<WorkOrderDetail>) => fn(),
    onSuccess: (w) => {
      refresh(w);
      setDialog(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (bundle.isLoading) return <Spinner />;
  if (bundle.error || !wo || !bundle.data) return <Alert tone="danger">{errorMessage(bundle.error)}</Alert>;
  const { checklist, evidence, signatures } = bundle.data;
  const has = (a: WorkOrderAction) => wo.availableActions.includes(a);

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{wo.number}</span>}
        subtitle={wo.title}
        breadcrumb={[{ label: 'Órdenes', to: '/work-orders' }, { label: wo.number }]}
        meta={
          <>
            <StatusBadge status={wo.status} size="md" />
            <PriorityBadge priority={wo.priority} />
            <span className="text-xs text-text-muted">Creada {fmtDateTime(wo.createdAt)} por {wo.createdBy.fullName}</span>
          </>
        }
        actions={
          <>
            {wo.status === WorkOrderStatus.PENDING_REVIEW && can(Permission.WORK_ORDERS_REVIEW) && (
              <Link to={`/work-orders/${id}/review`}>
                <Button variant="accent" icon={<ClipboardCheck className="h-4 w-4" />}>Revisar informe</Button>
              </Link>
            )}
            {has(WorkOrderAction.ASSIGN) && (
              <Button variant={wo.status === WorkOrderStatus.DRAFT || wo.status === WorkOrderStatus.REJECTED ? 'accent' : 'secondary'} icon={<UserPlus className="h-4 w-4" />} onClick={() => setDialog('assign')}>
                {wo.technician ? 'Reasignar' : 'Asignar técnico'}
              </Button>
            )}
            {!LOCKED.includes(wo.status) && can(Permission.WORK_ORDERS_MANAGE) && (
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog('edit')}>Editar</Button>
            )}
            {has(WorkOrderAction.CLOSE) && (
              <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate(() => workOrdersApi.close(id))}>Cerrar orden</Button>
            )}
            {has(WorkOrderAction.CANCEL) && <Button variant="danger" onClick={() => setDialog('cancel')}>Anular</Button>}
          </>
        }
      />

      {wo.status === WorkOrderStatus.REJECTED && wo.rejectionReason && (
        <Alert tone="danger" title="El técnico rechazó la asignación" className="mb-4">{wo.rejectionReason}</Alert>
      )}
      {wo.status === WorkOrderStatus.CHANGES_REQUESTED && wo.changesRequestedComment && (
        <Alert tone="warning" title="Corrección solicitada al técnico" className="mb-4">{wo.changesRequestedComment}</Alert>
      )}
      {wo.status === WorkOrderStatus.CANCELLED && <Alert tone="danger" title="Orden anulada" className="mb-4">{wo.cancellationReason}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Servicio">
            <KeyValue
              items={[
                { label: 'Cliente', value: <Link className="text-electric hover:underline" to={`/clients/${wo.client.id}`}>{wo.client.legalName}</Link> },
                { label: 'NIT', value: <span className="code">{nitWithDv(wo.client.nit, wo.client.dv)}</span> },
                { label: 'Equipo', value: wo.equipment ? <Link className="text-electric hover:underline" to={`/equipment/${wo.equipment.id}`}>{wo.equipment.code} · {wo.equipment.name}</Link> : 'Sin equipo específico' },
                { label: 'Marca / modelo / serial', value: wo.equipment ? [wo.equipment.brand, wo.equipment.model, wo.equipment.serial].filter(Boolean).join(' · ') || null : null },
                { label: 'Tipo de servicio', value: wo.serviceType.name },
                { label: 'Plantilla', value: `${wo.checklistTemplate.name} (v${wo.checklistTemplate.version})` },
                { label: 'Técnico', value: wo.technician?.fullName ?? 'Sin asignar' },
                { label: 'Empresa representada', value: wo.representedCompany.name },
                { label: 'Programada', value: fmtDateTime(wo.scheduledStart) },
                { label: 'Dirección', value: wo.address },
                { label: 'Contacto', value: [wo.contactName, wo.contactPhone].filter(Boolean).join(' · ') || null },
                { label: 'Inicio / envío', value: wo.startedAt ? `${fmtDateTime(wo.startedAt)} → ${wo.submittedAt ? fmtDateTime(wo.submittedAt) : 'en ejecución'}` : 'Sin iniciar' },
              ]}
            />
            {(wo.serviceScope || wo.description || wo.internalNotes) && (
              <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                {wo.serviceScope && <div><p className="label-caps mb-1">Alcance</p><p className="whitespace-pre-line text-sm">{wo.serviceScope}</p></div>}
                {wo.description && <div><p className="label-caps mb-1">Descripción</p><p className="whitespace-pre-line text-sm">{wo.description}</p></div>}
                {wo.internalNotes && <div className="md:col-span-2"><p className="label-caps mb-1">Notas internas</p><p className="whitespace-pre-line text-sm text-text-muted">{wo.internalNotes}</p></div>}
              </div>
            )}
          </Panel>

          <ReportsPanel wo={wo} />

          <Panel title={`Checklist · ${wo.checklistProgress.answered} de ${wo.checklistProgress.total}`} flush>
            <ChecklistReadonly items={checklist} evidence={evidence} strict={Boolean(wo.startedAt)} />
          </Panel>

          {wo.technicianNotes && (
            <Panel title="Observaciones y conclusiones del técnico">
              <p className="whitespace-pre-line text-sm">{wo.technicianNotes}</p>
            </Panel>
          )}

          <Panel title={`Evidencias (${evidence.length})`}>
            <EvidenceGallery evidence={evidence} items={checklist} />
          </Panel>

          <Panel
            title="Firmas de conformidad"
            actions={
              WAIVABLE.includes(wo.status) && !wo.clientSignatureWaived && can(Permission.WORK_ORDERS_WAIVE_CLIENT_SIGNATURE) && !signatures.some((s) => s.signatureType === 'CLIENT') && (
                <Button size="sm" variant="ghost" onClick={() => setDialog('waive')}>Autorizar sin firma del cliente</Button>
              )
            }
          >
            <SignaturesView signatures={signatures} waived={wo.clientSignatureWaived} waiverReason={wo.clientSignatureWaiverReason} />
          </Panel>
        </div>
        <HistoryPanel workOrderId={id} />
      </div>

      <AssignDialog
        open={dialog === 'assign'}
        current={wo.technician?.id ?? null}
        loading={run.isPending}
        onOpenChange={(o) => setDialog(o ? 'assign' : null)}
        onConfirm={(techId) => run.mutate(() => workOrdersApi.assign(id, techId).then((w) => (toast.success('Orden asignada correctamente.'), w)))}
      />
      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => setDialog(o ? 'cancel' : null)}
        title={`Anular ${wo.number}`}
        description="La orden no se elimina: queda anulada con su historial completo."
        label="Motivo de la anulación"
        confirmLabel="Anular orden"
        tone="danger"
        loading={run.isPending}
        onConfirm={(reason) => run.mutate(() => workOrdersApi.cancel(id, reason).then((w) => (toast.success('Orden anulada.'), w)))}
      />
      <ReasonDialog
        open={dialog === 'waive'}
        onOpenChange={(o) => setDialog(o ? 'waive' : null)}
        title="Excepción de firma del cliente"
        description="Permite finalizar sin la firma del responsable del cliente. Quedará registrada en la auditoría y en el informe."
        label="Motivo de la excepción"
        confirmLabel="Registrar excepción"
        loading={run.isPending}
        onConfirm={(reason) => run.mutate(() => workOrdersApi.waiveClientSignature(id, reason).then((w) => (toast.success('Excepción registrada.'), w)))}
      />
      <EditWorkOrderDialog wo={wo} open={dialog === 'edit'} onOpenChange={(o) => setDialog(o ? 'edit' : null)} />
    </>
  );
}

function AssignDialog({ open, onOpenChange, onConfirm, current, loading }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (id: string) => void; current: string | null; loading: boolean }) {
  const technicians = useQuery({ queryKey: ['technicians'], queryFn: usersApi.technicians, enabled: open });
  const [selected, setSelected] = useState('');
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar técnico"
      description="El técnico verá la orden en su aplicación y deberá aceptarla."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="accent" disabled={!selected || selected === current} loading={loading} onClick={() => onConfirm(selected)}>Asignar</Button>
        </>
      }
    >
      <FormField label="Técnico">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Seleccione…</option>
          {technicians.data?.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === current}>
              {t.fullName}{t.id === current ? ' (actual)' : ''}
            </option>
          ))}
        </Select>
      </FormField>
    </Modal>
  );
}
