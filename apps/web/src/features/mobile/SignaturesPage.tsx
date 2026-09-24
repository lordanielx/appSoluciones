import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CLIENT_SIGNATURE_CONSENT_TEXT, SignatureType, SyncStatus } from '@meca/shared';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addSignature, isEditable } from '@/lib/offline/actions';
import type { LocalSignature } from '@/lib/offline/db';
import { fmtDateTime } from '@/lib/format';
import { useDocumentTitle, useObjectUrl } from '@/lib/hooks';
import { Alert, Button, Checkbox, FormField, Input, SignaturePad, Tag, useToast, type SignaturePadHandle } from '@/ui';
import { ActionBar, ReadOnlyNotice, SyncErrors, WorkOrderScreen } from './common';
import { useLocalWorkOrder } from './useLocalWorkOrder';

/** Firmas de conformidad del técnico y del responsable del cliente (§19). */
export function SignaturesPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wo, signatures, errorOps, loading, error } = useLocalWorkOrder(id);
  useDocumentTitle('Firmas');
  const editable = wo ? isEditable(wo.status) : false;
  const tech = signatures.find((s) => s.signatureType === SignatureType.TECHNICIAN);
  const client = signatures.find((s) => s.signatureType === SignatureType.CLIENT);

  return (
    <WorkOrderScreen wo={wo} loading={loading} error={error} title="Firmas" back={`/mobile/work-orders/${id}`}>
      {wo && (
        <div className="pb-32">
          {!editable && <ReadOnlyNotice />}
          <SyncErrors ops={errorOps} />
          <SignatureSection
            title="Firma del técnico"
            existing={tech}
            editable={editable}
            defaultName={user?.fullName ?? ''}
            type={SignatureType.TECHNICIAN}
            workOrderId={id}
          />
          {wo.clientSignatureWaived && !client ? (
            <section className="border-b border-border bg-surface px-4 py-4">
              <h2 className="label-caps mb-2">Firma del responsable del cliente</h2>
              <Alert tone="info" title="Excepción autorizada por coordinación">{wo.clientSignatureWaiverReason}</Alert>
            </section>
          ) : (
            <SignatureSection
              title="Firma del responsable del cliente"
              existing={client}
              editable={editable}
              defaultName={wo.contactName ?? ''}
              type={SignatureType.CLIENT}
              workOrderId={id}
              consent
            />
          )}
          <ActionBar>
            <Button variant="accent" size="lg" block onClick={() => navigate(`/mobile/work-orders/${id}/summary`)}>
              Continuar al resumen <ChevronRight className="h-5 w-5" />
            </Button>
          </ActionBar>
        </div>
      )}
    </WorkOrderScreen>
  );
}

function SignatureSection({ title, existing, editable, defaultName, type, workOrderId, consent }: { title: string; existing?: LocalSignature; editable: boolean; defaultName: string; type: SignatureType; workOrderId: string; consent?: boolean }) {
  const toast = useToast();
  const pad = useRef<SignaturePadHandle>(null);
  const [capturing, setCapturing] = useState(!existing);
  const [name, setName] = useState(existing?.signerName ?? defaultName);
  const [role, setRole] = useState(existing?.signerRole ?? '');
  const [accepted, setAccepted] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const localUrl = useObjectUrl(existing?.pngBlob ?? null);
  const img = localUrl ?? existing?.pngUrl ?? null;

  const save = async () => {
    setTouched(true);
    if (!name.trim() || empty || (consent && !accepted)) return;
    setSaving(true);
    try {
      const { png, strokes } = await pad.current!.export();
      await addSignature(workOrderId, {
        signatureType: type,
        signerName: name.trim(),
        signerRole: role.trim() || null,
        consentAccepted: consent ? accepted : true,
        png,
        strokes,
      });
      toast.success('Firma guardada.');
      setCapturing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No fue posible guardar la firma.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-b border-border bg-surface px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="label-caps !text-graphite">{title}</h2>
        {existing && (existing.syncStatus === SyncStatus.SYNCED ? <Tag tone="success">Registrada</Tag> : existing.syncStatus === SyncStatus.ERROR ? <Tag tone="danger">Error</Tag> : <Tag tone="warning">Pendiente de sincronizar</Tag>)}
      </div>

      {existing && !capturing ? (
        <div className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded border border-border bg-surface">
            {img ? <img src={img} alt={`Firma de ${existing.signerName}`} className="max-h-32 max-w-full" /> : <span className="text-sm text-text-muted">Firma registrada</span>}
          </div>
          <p className="text-sm">
            <span className="font-medium">{existing.signerName}</span>
            {existing.signerRole && <span className="text-text-muted"> · {existing.signerRole}</span>}
            <span className="block text-xs text-text-muted">{fmtDateTime(existing.signedAt)}</span>
          </p>
          {editable && <Button variant="secondary" onClick={() => setCapturing(true)}>Firmar nuevamente</Button>}
        </div>
      ) : editable ? (
        <div className="flex flex-col gap-4">
          <FormField label="Nombre del firmante" required error={touched && !name.trim() ? 'Escriba el nombre de quien firma.' : undefined}>
            <Input touch value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </FormField>
          <FormField label="Cargo">
            <Input touch value={role} onChange={(e) => setRole(e.target.value)} placeholder={consent ? 'Ej.: Jefe de mantenimiento' : 'Ej.: Técnico electromecánico'} />
          </FormField>
          <SignaturePad ref={pad} label={`${title}: área para firmar`} onChange={setEmpty} />
          {touched && empty && <p className="text-xs font-medium text-danger" role="alert">La firma está vacía.</p>}
          {consent && (
            <div className="rounded border border-border bg-subtle px-3 py-1">
              <Checkbox label="Firma de conformidad" description={CLIENT_SIGNATURE_CONSENT_TEXT} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              {touched && !accepted && <p className="pb-2 text-xs font-medium text-danger" role="alert">El responsable del cliente debe aceptar la declaración.</p>}
            </div>
          )}
          <p className="text-2xs text-text-muted">Firma electrónica capturada en el servicio. Se incluirá en el informe técnico de esta orden.</p>
          <div className="flex gap-2">
            {existing && <Button variant="secondary" className="flex-1" onClick={() => setCapturing(false)}>Cancelar</Button>}
            <Button size="lg" className="flex-[2]" loading={saving} onClick={() => void save()}>Guardar firma</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">Sin firma.</p>
      )}
    </section>
  );
}
