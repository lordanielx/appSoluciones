import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SubmissionIssueCode, WorkOrderStatus } from '@meca/shared';
import { isEditable, saveTechnicianNotes, submitWorkOrder } from '@/lib/offline/actions';
import { useDocumentTitle, useOnline } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Alert, Button, FormField, Modal, Textarea, useToast } from '@/ui';
import { ActionBar, ReadOnlyNotice, SyncErrors, WorkOrderScreen } from './common';
import { useLocalWorkOrder } from './useLocalWorkOrder';

/** Validación final y envío a revisión (§20): no se permite enviar si falta algo y se indica qué. */
export function SummaryPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const { wo, responses, summary, errorOps, loading, error } = useLocalWorkOrder(id);
  useDocumentTitle('Resumen y envío');
  const editable = wo ? isEditable(wo.status) : false;
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => setNotes(wo?.technicianNotes ?? ''), [wo?.id, wo?.technicianNotes]);

  const linkFor = (code: SubmissionIssueCode, itemId?: string) => {
    if (code === SubmissionIssueCode.TECHNICIAN_SIGNATURE_MISSING || code === SubmissionIssueCode.CLIENT_SIGNATURE_MISSING) return `/mobile/work-orders/${id}/signatures`;
    if (code === SubmissionIssueCode.NOTES_MISSING) return null;
    const idx = responses.findIndex((r) => r.id === itemId);
    return `/mobile/work-orders/${id}/checklist?item=${idx + 1}`;
  };

  const checks = summary
    ? [
        { label: 'Checklist completo', ok: summary.checklistComplete },
        { label: 'Evidencias requeridas', ok: summary.evidenceComplete },
        { label: 'Observaciones obligatorias', ok: summary.observationsComplete },
        { label: 'Firma del técnico', ok: summary.technicianSigned },
        { label: 'Firma del cliente', ok: summary.clientSigned },
      ]
    : [];

  const send = async () => {
    setSending(true);
    try {
      await saveTechnicianNotes(id, notes);
      await submitWorkOrder(id);
      toast.success(online ? 'Servicio enviado a revisión.' : 'Servicio listo. Se enviará a revisión al recuperar la conexión.');
      navigate(`/mobile/work-orders/${id}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No fue posible enviar el servicio.');
    } finally {
      setSending(false);
      setConfirm(false);
    }
  };

  return (
    <WorkOrderScreen wo={wo} loading={loading} error={error} title="Resumen y envío" back={`/mobile/work-orders/${id}`}>
      {wo && summary && (
        <div className="pb-32">
          {!editable && <ReadOnlyNotice />}
          <SyncErrors ops={errorOps} />
          <section className="border-b border-border bg-surface px-4 py-4">
            <FormField label="Observaciones y conclusiones técnicas" required hint="Resultado del servicio, hallazgos y recomendaciones. Aparece en el informe.">
              <Textarea rows={5} value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} onBlur={() => void saveTechnicianNotes(id, notes)} />
            </FormField>
          </section>

          <section className="border-b border-border bg-surface px-4 py-4">
            <h2 className="label-caps mb-3 !text-graphite">Validación del servicio</h2>
            <ul className="flex flex-col gap-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-3 text-md">
                  <span className={cn('flex h-6 w-6 items-center justify-center border text-sm font-bold', c.ok ? 'border-success bg-success-soft text-success' : 'border-danger bg-danger-soft text-danger')} aria-hidden>
                    {c.ok ? '✓' : '✕'}
                  </span>
                  {c.label}
                  <span className="sr-only">{c.ok ? ': completo' : ': pendiente'}</span>
                </li>
              ))}
            </ul>
          </section>

          {summary.issues.length > 0 && (
            <div className="px-4 pt-4">
              <Alert tone="danger" title="No es posible enviar el servicio.">
                <p className="mb-1">Pendientes:</p>
                <ul className="flex flex-col gap-1">
                  {summary.issues.map((i) => {
                    const to = linkFor(i.code, i.itemId);
                    return (
                      <li key={i.message}>
                        {to ? <Link to={to} className="underline decoration-danger/50 underline-offset-2">– {i.message}</Link> : <>– {i.message}</>}
                      </li>
                    );
                  })}
                </ul>
              </Alert>
            </div>
          )}

          {wo.status === WorkOrderStatus.PENDING_REVIEW && (
            <div className="px-4 pt-4"><Alert tone="success" title="Servicio enviado a revisión" /></div>
          )}

          {editable && (
            <ActionBar>
              <Button
                variant="accent"
                size="lg"
                block
                disabled={!notes.trim() || summary.issues.some((i) => i.code !== SubmissionIssueCode.NOTES_MISSING)}
                onClick={() => setConfirm(true)}
              >
                ENVIAR A REVISIÓN
              </Button>
            </ActionBar>
          )}

          <Modal
            open={confirm}
            onOpenChange={setConfirm}
            title="Enviar servicio a revisión"
            description={online ? 'Después de enviarlo no podrá modificar la información, salvo que coordinación solicite una corrección.' : 'No hay conexión: el envío quedará en cola y se completará automáticamente al recuperar la señal.'}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
                <Button variant="accent" loading={sending} onClick={() => void send()}>Enviar</Button>
              </>
            }
          />
        </div>
      )}
    </WorkOrderScreen>
  );
}
