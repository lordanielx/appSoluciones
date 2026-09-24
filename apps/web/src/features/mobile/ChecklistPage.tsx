import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import {
  RESPONSE_TYPE_LABELS,
  isObservationRequired,
  isValueAnswered,
  requiredPhotos,
  type ChecklistValue,
} from '@meca/shared';
import { addEvidence, isEditable, removeEvidence, saveResponse } from '@/lib/offline/actions';
import { useDocumentTitle } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Button, ChecklistField, Drawer, EvidenceUploader, FormField, Textarea, useToast } from '@/ui';
import { ActionBar, ReadOnlyNotice, SyncErrors, WorkOrderScreen } from './common';
import { useLocalWorkOrder } from './useLocalWorkOrder';

/**
 * Ejecución del checklist como flujo de trabajo, una actividad a la vez (§17).
 * Cada cambio se guarda automáticamente en el dispositivo y entra a la cola de sincronización.
 */
export function ChecklistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { wo, responses, evidence, errorOps, loading, error } = useLocalWorkOrder(id);
  useDocumentTitle('Checklist');
  const [listOpen, setListOpen] = useState(false);

  const total = responses.length;
  const index = Math.min(Math.max(0, Number(params.get('item') ?? 1) - 1), Math.max(0, total - 1));
  const item = responses[index];
  const editable = wo ? isEditable(wo.status) : false;
  const photos = useMemo(() => evidence.filter((e) => e.checklistResponseId === item?.id), [evidence, item?.id]);
  const answered = responses.filter((r) => isValueAnswered(r.responseType, r.value as ChecklistValue)).length;

  const [observation, setObservation] = useState('');
  useEffect(() => setObservation(item?.observation ?? ''), [item?.id, item?.observation]);

  const go = (i: number) => {
    setParams({ item: String(i + 1) }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const save = async (value: ChecklistValue, obs: string | null = observation.trim() || null) => {
    if (!item || !editable) return;
    await saveResponse(id, item.id, value, obs);
  };

  const flushObservation = async () => {
    if (!item || !editable) return;
    const obs = observation.trim() || null;
    if (obs !== (item.observation ?? null)) await saveResponse(id, item.id, item.value as ChecklistValue, obs);
  };

  const next = async () => {
    await flushObservation();
    if (index < total - 1) go(index + 1);
    else navigate(`/mobile/work-orders/${id}/evidence`);
  };

  if (!item && !loading && wo) {
    return (
      <WorkOrderScreen wo={wo} loading={false} error={null} title="Checklist" back={`/mobile/work-orders/${id}`}>
        <p className="p-4 text-sm text-text-muted">Esta orden no tiene actividades de checklist.</p>
      </WorkOrderScreen>
    );
  }

  const value = (item?.value ?? null) as ChecklistValue;
  const needsObs = item ? isObservationRequired(item, value) : false;
  const needPhotos = item ? requiredPhotos(item, value) : 0;
  const labelId = `item-${item?.id}-label`;

  return (
    <WorkOrderScreen wo={wo} loading={loading} error={error} title="Checklist" back={`/mobile/work-orders/${id}`}>
      {item && (
        <div className="pb-32">
          {!editable && <ReadOnlyNotice />}
          <SyncErrors ops={errorOps} />
          <div className="border-b border-border bg-surface px-4 pb-3 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                <span className="label-caps mr-2">Servicio</span>
                <span className="tabular">{index + 1} de {total} actividades</span>
              </p>
              <Button size="sm" variant="ghost" icon={<List className="h-4 w-4" />} onClick={() => setListOpen(true)}>Ver todas</Button>
            </div>
            <div className="mt-2 flex h-1.5 gap-[2px]" aria-hidden>
              {responses.map((r, i) => (
                <span key={r.id} className={cn('flex-1', isValueAnswered(r.responseType, r.value as ChecklistValue) ? 'bg-success' : 'bg-border', i === index && 'bg-accent')} />
              ))}
            </div>
            <p className="mt-1 text-2xs text-text-muted">{answered} respondidas · guardado automático</p>
          </div>

          <article className="px-4 py-5">
            {item.section && <p className="label-caps mb-1">{item.section}</p>}
            <div className="flex items-start gap-3">
              <span className="font-mono text-3xl font-semibold leading-none text-accent">{String(item.order).padStart(2, '0')}</span>
              <div className="min-w-0">
                <h2 id={labelId} className="text-xl font-semibold leading-snug">
                  {item.label}
                  {item.required && <span className="ml-1 text-danger" aria-label="obligatoria">*</span>}
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">{RESPONSE_TYPE_LABELS[item.responseType]}{item.unit ? ` · ${item.unit}` : ''}</p>
              </div>
            </div>
            {item.description && <p className="mt-3 border-l-2 border-electric bg-info-soft px-3 py-2 text-sm">{item.description}</p>}

            <div className="mt-5">
              <ChecklistField
                key={item.id}
                id={`field-${item.id}`}
                labelledBy={labelId}
                responseType={item.responseType}
                value={value}
                options={item.options}
                unit={item.unit}
                minValue={item.minValue}
                maxValue={item.maxValue}
                disabled={!editable}
                onChange={(v) => void save(v)}
              />
            </div>

            <div className="mt-5">
              <FormField
                label={needsObs ? 'Observación (obligatoria)' : 'Observación'}
                error={needsObs && !observation.trim() && isValueAnswered(item.responseType, value) ? 'Describa el hallazgo para esta actividad.' : undefined}
              >
                <Textarea rows={3} value={observation} disabled={!editable} onChange={(e) => setObservation(e.target.value)} onBlur={() => void flushObservation()} placeholder="Hallazgos, mediciones adicionales, acciones realizadas…" />
              </FormField>
            </div>

            {(item.evidenceRequired || photos.length > 0 || editable) && (
              <div className="mt-5 border-t border-border pt-4">
                <EvidenceUploader
                  items={photos}
                  required={needPhotos}
                  disabled={!editable}
                  onAdd={async (files) => {
                    try {
                      for (const f of files) await addEvidence(id, f, item.id, null);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'No fue posible guardar la fotografía.');
                    }
                  }}
                  onRemove={(evId) => void removeEvidence(id, evId)}
                />
              </div>
            )}
          </article>

          <ActionBar>
            <Button variant="secondary" size="lg" className="flex-1" disabled={index === 0} icon={<ChevronLeft className="h-5 w-5" />} onClick={() => void flushObservation().then(() => go(index - 1))}>
              Anterior
            </Button>
            <Button variant={editable ? 'accent' : 'primary'} size="lg" className="flex-[2]" onClick={() => void next()}>
              {index < total - 1 ? 'Guardar y continuar' : 'Continuar a evidencias'}
              <ChevronRight className="h-5 w-5" />
            </Button>
          </ActionBar>

          <Drawer open={listOpen} onOpenChange={setListOpen} title="Actividades">
            <ol className="-mx-5 divide-y divide-border">
              {responses.map((r, i) => {
                const done = isValueAnswered(r.responseType, r.value as ChecklistValue);
                const ph = evidence.filter((e) => e.checklistResponseId === r.id).length;
                const missingPhotos = requiredPhotos(r, r.value as ChecklistValue) > ph;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setListOpen(false);
                        go(i);
                      }}
                      className={cn('flex min-h-[52px] w-full items-center gap-3 px-5 py-2 text-left hover:bg-subtle', i === index && 'bg-info-soft')}
                    >
                      <span className="code w-6 text-text-muted">{String(r.order).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.label}</span>
                        {r.section && <span className="block truncate text-2xs text-text-muted">{r.section}</span>}
                      </span>
                      <span className={cn('text-2xs font-semibold uppercase', done && !missingPhotos ? 'text-success' : r.required || missingPhotos ? 'text-accent' : 'text-text-muted')}>
                        {done ? (missingPhotos ? 'Falta foto' : 'Lista') : r.required ? 'Pendiente' : 'Opcional'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Drawer>
        </div>
      )}
    </WorkOrderScreen>
  );
}
