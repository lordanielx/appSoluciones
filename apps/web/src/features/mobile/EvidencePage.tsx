import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { requiredPhotos, type ChecklistValue } from '@meca/shared';
import { addEvidence, isEditable, removeEvidence } from '@/lib/offline/actions';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, EvidenceUploader, useToast } from '@/ui';
import { ActionBar, ReadOnlyNotice, SyncErrors, WorkOrderScreen } from './common';
import { useLocalWorkOrder } from './useLocalWorkOrder';

/** Evidencias del servicio: fotos por actividad y fotografías generales. */
export function EvidencePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { wo, responses, evidence, errorOps, loading, error } = useLocalWorkOrder(id);
  useDocumentTitle('Evidencias');
  const editable = wo ? isEditable(wo.status) : false;
  const general = evidence.filter((e) => !e.checklistResponseId);
  const withPhotos = responses.filter((r) => r.evidenceRequired || evidence.some((e) => e.checklistResponseId === r.id));

  const add = async (files: File[], responseId: string | null) => {
    try {
      for (const f of files) await addEvidence(id, f, responseId, null);
      toast.success(files.length === 1 ? 'Fotografía guardada en el dispositivo.' : `${files.length} fotografías guardadas en el dispositivo.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No fue posible guardar la fotografía.');
    }
  };

  return (
    <WorkOrderScreen wo={wo} loading={loading} error={error} title="Evidencias" back={`/mobile/work-orders/${id}`}>
      <div className="pb-32">
        {!editable && <ReadOnlyNotice />}
        <SyncErrors ops={errorOps} />
        {withPhotos.map((r) => (
          <section key={r.id} className="border-b border-border bg-surface px-4 py-4">
            <p className="mb-3 font-medium">
              <span className="code mr-2 text-text-muted">{String(r.order).padStart(2, '0')}</span>
              {r.label}
            </p>
            <EvidenceUploader
              items={evidence.filter((e) => e.checklistResponseId === r.id)}
              required={requiredPhotos(r, r.value as ChecklistValue)}
              disabled={!editable}
              onAdd={(files) => add(files, r.id)}
              onRemove={(evId) => void removeEvidence(id, evId)}
            />
          </section>
        ))}
        <section className="bg-surface px-4 py-4">
          <p className="mb-3 font-medium">Fotografías generales del servicio</p>
          <EvidenceUploader items={general} required={0} disabled={!editable} onAdd={(files) => add(files, null)} onRemove={(evId) => void removeEvidence(id, evId)} />
        </section>
        <ActionBar>
          <Button variant="accent" size="lg" block onClick={() => navigate(`/mobile/work-orders/${id}/signatures`)}>
            Continuar a firmas <ChevronRight className="h-5 w-5" />
          </Button>
        </ActionBar>
      </div>
    </WorkOrderScreen>
  );
}
