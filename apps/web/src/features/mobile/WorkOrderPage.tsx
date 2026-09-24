import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, CheckSquare, ChevronRight, FileSignature, MapPin, Phone, Send } from 'lucide-react';
import { WorkOrderStatus } from '@meca/shared';
import { acceptWorkOrder, rejectWorkOrder, startWorkOrder } from '@/lib/offline/actions';
import { fmtDateTime } from '@/lib/format';
import { useDocumentTitle, useOnline } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Alert, Button, FormField, KeyValue, Modal, PriorityBadge, Textarea, useToast } from '@/ui';
import { ActionBar, SyncErrors, WorkOrderScreen } from './common';
import { useLocalWorkOrder } from './useLocalWorkOrder';

/** Detalle del servicio para el técnico con la acción siguiente según el estado (§16). */
export function WorkOrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const { wo, responses, evidence, signatures, summary, loading, error, errorOps, pendingOps } = useLocalWorkOrder(id);
  useDocumentTitle(wo?.number ?? 'Servicio');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<void>, message: string, then?: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(online ? message : `${message} Se sincronizará al recuperar la conexión.`);
      if (then) navigate(then);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No fue posible registrar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const executing = wo?.status === WorkOrderStatus.IN_PROGRESS || wo?.status === WorkOrderStatus.CHANGES_REQUESTED;
  const answered = responses.filter((r) => r.value !== null && !(Array.isArray(r.value) && r.value.length === 0)).length;
  const photosRequired = responses.filter((r) => r.evidenceRequired).length;
  const steps = [
    { to: 'checklist', label: 'Checklist', detail: `${answered} de ${responses.length} actividades`, done: summary?.checklistComplete && summary.observationsComplete, icon: CheckSquare },
    { to: 'evidence', label: 'Evidencias', detail: `${evidence.length} fotos${photosRequired ? ` · ${photosRequired} actividades la exigen` : ''}`, done: summary?.evidenceComplete, icon: Camera },
    { to: 'signatures', label: 'Firmas', detail: `${signatures.length} de 2`, done: summary?.technicianSigned && summary.clientSigned, icon: FileSignature },
    { to: 'summary', label: 'Resumen y envío', detail: summary?.canSubmit ? 'Listo para enviar' : `${summary?.issues.length ?? 0} pendientes`, done: summary?.canSubmit, icon: Send },
  ];

  return (
    <WorkOrderScreen wo={wo} loading={loading} error={error} title="Servicio" back="/mobile/home">
      {wo && (
        <div className="pb-28">
          <SyncErrors ops={errorOps} />
          {wo.status === WorkOrderStatus.CHANGES_REQUESTED && wo.changesRequestedComment && (
            <div className="px-4 pt-3">
              <Alert tone="warning" title="Corrección solicitada por coordinación">{wo.changesRequestedComment}</Alert>
            </div>
          )}
          {wo.status === WorkOrderStatus.PENDING_REVIEW && (
            <div className="px-4 pt-3">
              <Alert tone="success" title="Servicio enviado a revisión">
                {pendingOps > 0 ? 'El envío se completará al sincronizar los cambios pendientes.' : 'La coordinación revisará el informe. Le notificaremos si requiere correcciones.'}
              </Alert>
            </div>
          )}

          <section className="border-b border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <PriorityBadge priority={wo.priority} />
              <span className="tabular text-sm text-text-muted">{fmtDateTime(wo.scheduledStart)}</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight">{wo.client.legalName}</h2>
            {wo.equipment && (
              <p className="mt-1 text-md">
                <span className="code mr-1.5">{wo.equipment.code}</span>
                {wo.equipment.name}
              </p>
            )}
            <p className="mt-1 text-sm text-text-muted">{wo.serviceType.name} · {wo.title}</p>
          </section>

          {executing && (
            <nav aria-label="Pasos del servicio" className="mt-3 border-y border-border bg-surface">
              <ol>
                {steps.map((s, i) => (
                  <li key={s.to} className="border-b border-border last:border-b-0">
                    <Link to={s.to} className="flex min-h-[60px] items-center gap-3 px-4 py-2 hover:bg-subtle">
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center border text-sm font-semibold', s.done ? 'border-success bg-success-soft text-success' : 'border-border-strong text-text-muted')}>
                        {s.done ? '✓' : String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.label}</span>
                        <span className="block text-xs text-text-muted">{s.detail}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <section className="mt-3 border-y border-border bg-surface px-4 py-3">
            <KeyValue
              columns={1}
              items={[
                { label: 'Alcance', value: wo.serviceScope ? <span className="whitespace-pre-line font-normal">{wo.serviceScope}</span> : null },
                ...(wo.description ? [{ label: 'Necesidad reportada', value: <span className="whitespace-pre-line font-normal">{wo.description}</span> }] : []),
                {
                  label: 'Dirección',
                  value: wo.address ? (
                    <span className="flex items-start gap-1.5"><MapPin className="mt-1 h-4 w-4 shrink-0 text-text-muted" aria-hidden />{wo.address}</span>
                  ) : null,
                },
                {
                  label: 'Contacto',
                  value: wo.contactName || wo.contactPhone ? (
                    <span className="flex flex-wrap items-center gap-x-3">
                      {wo.contactName}
                      {wo.contactPhone && (
                        <a href={`tel:${wo.contactPhone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-1 text-electric">
                          <Phone className="h-4 w-4" aria-hidden /> {wo.contactPhone}
                        </a>
                      )}
                    </span>
                  ) : null,
                },
                ...(wo.equipment ? [{ label: 'Equipo', value: [wo.equipment.brand, wo.equipment.model, wo.equipment.serial && `S/N ${wo.equipment.serial}`].filter(Boolean).join(' · ') || null }, { label: 'Ubicación en planta', value: wo.equipment.location }] : []),
              ]}
            />
          </section>

          {wo.status === WorkOrderStatus.ASSIGNED && (
            <ActionBar>
              <Button variant="secondary" size="lg" className="flex-1" disabled={busy} onClick={() => setRejectOpen(true)}>RECHAZAR</Button>
              <Button variant="accent" size="lg" className="flex-[2]" loading={busy} onClick={() => void act(() => acceptWorkOrder(id), 'Servicio aceptado.')}>ACEPTAR SERVICIO</Button>
            </ActionBar>
          )}
          {wo.status === WorkOrderStatus.ACCEPTED && (
            <ActionBar>
              <Button variant="accent" size="lg" block loading={busy} onClick={() => void act(() => startWorkOrder(id), 'Servicio iniciado.', `/mobile/work-orders/${id}/checklist`)}>
                INICIAR SERVICIO
              </Button>
            </ActionBar>
          )}
          {executing && (
            <ActionBar>
              <Button variant="accent" size="lg" block onClick={() => navigate(`/mobile/work-orders/${id}/checklist`)}>
                CONTINUAR CHECKLIST
              </Button>
            </ActionBar>
          )}

          <Modal
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            title="Rechazar servicio"
            description="La coordinación recibirá el motivo para reasignar la orden."
            footer={
              <>
                <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancelar</Button>
                <Button
                  variant="danger"
                  disabled={reason.trim().length < 5}
                  loading={busy}
                  onClick={() => void act(() => rejectWorkOrder(id, reason.trim()), 'Servicio rechazado.', '/mobile/home').then(() => setRejectOpen(false))}
                >
                  Rechazar servicio
                </Button>
              </>
            }
          >
            <FormField label="Motivo del rechazo" required hint="Mínimo 5 caracteres.">
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          </Modal>
        </div>
      )}
    </WorkOrderScreen>
  );
}
