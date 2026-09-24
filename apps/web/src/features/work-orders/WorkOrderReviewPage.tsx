import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, CheckCircle2, Eye, MessageSquareWarning, X } from 'lucide-react';
import { Permission, WORK_ORDER_STATUS_LABELS, WorkOrderStatus, evaluateSubmission, type ChecklistValue } from '@meca/shared';
import { workOrdersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtDateTime, nitWithDv } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Alert, Button, KeyValue, Modal, PageHeader, Panel, Spinner, StatusBadge, useToast } from '@/ui';
import { ChecklistReadonly, EvidenceGallery, SignaturesView } from './components/BundleSections';
import { ReasonDialog } from './components/ReasonDialog';
import { openReportPreview } from './components/reports';

/** Revisión administrativa (§21): todo lo capturado en una sola vista + vista previa del PDF. */
export function WorkOrderReviewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const bundle = useQuery({ queryKey: ['work-order', id, 'bundle'], queryFn: () => workOrdersApi.bundle(id) });
  const wo = bundle.data?.workOrder;
  useDocumentTitle(wo ? `Revisión ${wo.number}` : 'Revisión');
  const [changesOpen, setChangesOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['work-order', id] });
    void qc.invalidateQueries({ queryKey: ['work-orders'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const approve = useMutation({
    mutationFn: () => workOrdersApi.approve(id),
    onSuccess: ({ report }) => {
      invalidate();
      setConfirmOpen(false);
      toast.success(`Informe ${report.reportNumber} aprobado y almacenado.`);
      navigate(`/work-orders/${id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const requestChanges = useMutation({
    mutationFn: (comment: string) => workOrdersApi.requestChanges(id, comment),
    onSuccess: () => {
      invalidate();
      setChangesOpen(false);
      toast.success('Corrección solicitada. El técnico verá el comentario en su aplicación.');
      navigate(`/work-orders/${id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (bundle.isLoading) return <Spinner />;
  if (bundle.error || !wo || !bundle.data) return <Alert tone="danger">{errorMessage(bundle.error)}</Alert>;
  const { checklist, evidence, signatures } = bundle.data;
  const reviewable = wo.status === WorkOrderStatus.PENDING_REVIEW && can(Permission.WORK_ORDERS_REVIEW);

  // Verificación independiente en la revisión (el servidor ya la exigió al enviar).
  const summary = evaluateSubmission({
    items: checklist.map((r) => ({ ...r, value: r.value as ChecklistValue, photoCount: evidence.filter((e) => e.checklistResponseId === r.id).length })),
    technicianNotes: wo.technicianNotes,
    signatureTypes: signatures.map((s) => s.signatureType),
    clientSignatureWaived: wo.clientSignatureWaived,
  });
  const checks = [
    { label: 'Checklist completo', ok: summary.checklistComplete },
    { label: 'Evidencias requeridas', ok: summary.evidenceComplete },
    { label: 'Observaciones obligatorias', ok: summary.observationsComplete },
    { label: 'Firma del técnico', ok: summary.technicianSigned },
    { label: wo.clientSignatureWaived ? 'Firma del cliente (excepción)' : 'Firma del cliente', ok: summary.clientSigned },
  ];

  const preview = async () => {
    setPreviewing(true);
    try {
      await openReportPreview(id, wo.number);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <>
      <PageHeader
        title={<>Revisión <span className="">{wo.number}</span></>}
        subtitle={`${wo.client.legalName} · ${wo.equipment ? `${wo.equipment.code} ${wo.equipment.name}` : wo.title}`}
        breadcrumb={[{ label: 'Órdenes', to: '/work-orders' }, { label: wo.number, to: `/work-orders/${id}` }, { label: 'Revisión' }]}
        meta={<StatusBadge status={wo.status} size="md" />}
        actions={
          <Button variant="secondary" icon={<Eye className="h-4 w-4" />} loading={previewing} onClick={() => void preview()}>
            Vista previa del informe
          </Button>
        }
      />

      {!reviewable && (
        <Alert tone="info" className="mb-4" title="Esta orden no está pendiente de revisión">
          Estado actual: {WORK_ORDER_STATUS_LABELS[wo.status]}. <Link to={`/work-orders/${id}`} className="underline">Ver detalle</Link>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Información del servicio">
            <KeyValue
              columns={3}
              items={[
                { label: 'Cliente', value: wo.client.legalName },
                { label: 'NIT', value: nitWithDv(wo.client.nit, wo.client.dv) },
                { label: 'Técnico', value: wo.technician?.fullName },
                { label: 'Equipo', value: wo.equipment ? `${wo.equipment.code} · ${wo.equipment.name}` : 'Sin equipo' },
                { label: 'Serial', value: wo.equipment?.serial },
                { label: 'Empresa del informe', value: wo.representedCompany.name },
                { label: 'Inicio', value: fmtDateTime(wo.startedAt) },
                { label: 'Enviado', value: fmtDateTime(wo.submittedAt) },
                { label: 'Servicio', value: wo.serviceType.name },
              ]}
            />
          </Panel>
          <Panel title="Checklist" flush>
            <ChecklistReadonly items={checklist} evidence={evidence} />
          </Panel>
          <Panel title="Observaciones y conclusiones técnicas">
            <p className="whitespace-pre-line text-sm">{wo.technicianNotes ?? <span className="text-danger">Sin conclusiones</span>}</p>
          </Panel>
          <Panel title={`Registro fotográfico (${evidence.length})`}>
            <EvidenceGallery evidence={evidence} items={checklist} />
          </Panel>
          <Panel title="Firmas">
            <SignaturesView signatures={signatures} waived={wo.clientSignatureWaived} waiverReason={wo.clientSignatureWaiverReason} />
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <Panel title="Verificación">
            <ul className="flex flex-col gap-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm">
                  <span className={cn('flex h-5 w-5 items-center justify-center border text-xs font-bold', c.ok ? 'border-success bg-success-soft text-success' : 'border-danger bg-danger-soft text-danger')} aria-hidden>
                    {c.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span>{c.label}</span>
                  <span className="sr-only">{c.ok ? 'completo' : 'pendiente'}</span>
                </li>
              ))}
            </ul>
            {summary.issues.length > 0 && (
              <ul className="mt-3 list-disc border-t border-border pl-5 pt-3 text-xs text-danger">
                {summary.issues.map((i) => <li key={i.message}>{i.message}</li>)}
              </ul>
            )}
          </Panel>
          {reviewable && (
            <Panel title="Decisión">
              <div className="flex flex-col gap-2">
                <Button variant="accent" size="lg" block icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => setConfirmOpen(true)}>
                  APROBAR INFORME
                </Button>
                <Button variant="secondary" size="lg" block icon={<MessageSquareWarning className="h-5 w-5" />} onClick={() => setChangesOpen(true)}>
                  SOLICITAR CORRECCIÓN
                </Button>
                <p className="mt-1 text-xs text-text-muted">Al aprobar se genera el PDF definitivo con la marca de {wo.representedCompany.name}. Las modificaciones posteriores crean una nueva versión.</p>
              </div>
            </Panel>
          )}
        </aside>
      </div>

      <ReasonDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        title="Solicitar corrección"
        description="El técnico recibirá este comentario y podrá corregir y reenviar el servicio."
        label="Comentario para el técnico"
        placeholder="Ej.: Agregar fotografía de placa del motor."
        confirmLabel="Enviar solicitud"
        loading={requestChanges.isPending}
        onConfirm={(c) => requestChanges.mutate(c)}
      />
      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Aprobar informe de ${wo.number}`}
        description="Se generará y almacenará el PDF definitivo. Esta versión no podrá modificarse; cualquier corrección posterior genera una nueva versión."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="accent" loading={approve.isPending} onClick={() => approve.mutate()}>Aprobar y generar PDF</Button>
          </>
        }
      />
    </>
  );
}

