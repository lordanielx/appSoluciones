import { useState } from 'react';
import {
  ResponseType,
  SIGNATURE_TYPE_LABELS,
  STATUS_VALUE_LABELS,
  StatusValue,
  isObservationRequired,
  isOutOfRange,
  type ChecklistResponseDto,
  type EvidenceDto,
  type SignatureDto,
} from '@meca/shared';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EmptyState, Modal, Tag } from '@/ui';

export function formatValue(r: Pick<ChecklistResponseDto, 'responseType' | 'value' | 'unit'>): string | null {
  const v = r.value;
  if (v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
  switch (r.responseType) {
    case ResponseType.BOOLEAN:
      return v ? 'Sí' : 'No';
    case ResponseType.NUMBER:
      return `${String(v).replace('.', ',')}${r.unit ? ` ${r.unit}` : ''}`;
    case ResponseType.STATUS:
      return STATUS_VALUE_LABELS[v as StatusValue] ?? String(v);
    case ResponseType.MULTISELECT:
      return (v as string[]).join(', ');
    default:
      return String(v);
  }
}

const STATUS_TONE: Partial<Record<StatusValue, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  GOOD: 'success',
  FAIR: 'warning',
  NEEDS_INTERVENTION: 'danger',
  CRITICAL: 'danger',
  NOT_APPLICABLE: 'neutral',
};

/** Checklist en solo lectura, agrupado por sección, con fotos por actividad. */
/** `strict`: resalta faltantes (servicio ya iniciado o en revisión). */
export function ChecklistReadonly({ items, evidence, strict = true }: { items: ChecklistResponseDto[]; evidence: EvidenceDto[]; strict?: boolean }) {
  let section: string | null | undefined;
  return (
    <ol className="divide-y divide-border">
      {items.map((r) => {
        const header = r.section !== section ? (section = r.section) : undefined;
        const value = formatValue(r);
        const photos = evidence.filter((e) => e.checklistResponseId === r.id);
        const out = typeof r.value === 'number' && isOutOfRange(r, r.value);
        const obsMissing = strict && isObservationRequired(r, r.value) && !r.observation;
        return (
          <li key={r.id}>
            {header && <p className="bg-subtle/70 px-4 py-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-primary">{header}</p>}
            <div className="grid gap-2 px-4 py-3 md:grid-cols-[32px_1fr_220px]">
              <span className="code text-text-muted">{String(r.order).padStart(2, '0')}</span>
              <div className="min-w-0">
                <p className="font-medium">
                  {r.label}
                  {r.required && <span className="sr-only"> (obligatoria)</span>}
                </p>
                {r.observation && <p className="mt-1 whitespace-pre-line text-sm text-text-muted">{r.observation}</p>}
                {obsMissing && <p className="mt-1 text-xs font-medium text-danger">Observación requerida sin diligenciar</p>}
                {photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {photos.map((p) => <Thumb key={p.id} ev={p} />)}
                  </div>
                )}
                {strict && r.evidenceRequired && photos.length < Math.max(1, r.minPhotos) && r.value !== StatusValue.NOT_APPLICABLE && (
                  <p className="mt-1 text-xs font-medium text-danger">Falta evidencia fotográfica</p>
                )}
              </div>
              <div className="md:text-right">
                {value === null ? (
                  <span className={cn('text-sm', strict && r.required ? 'font-medium text-danger' : 'text-text-muted')}>{r.required ? 'Sin responder' : '—'}</span>
                ) : r.responseType === ResponseType.STATUS ? (
                  <Tag tone={STATUS_TONE[r.value as StatusValue] ?? 'neutral'}>{value}</Tag>
                ) : (
                  <span className={cn('tabular font-semibold', out && 'text-danger')}>
                    {value}
                    {out && <span className="block text-xs font-medium">Fuera de rango</span>}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Thumb({ ev, size = 'sm' }: { ev: EvidenceDto; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('overflow-hidden rounded-sm border border-border bg-subtle hover:border-steel', size === 'sm' ? 'h-16 w-16' : 'aspect-[4/3] w-full')} aria-label={`Ver fotografía${ev.caption ? `: ${ev.caption}` : ''}`}>
        <img src={ev.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </button>
      <Modal open={open} onOpenChange={setOpen} title={ev.caption ?? 'Evidencia fotográfica'} description={`${fmtDateTime(ev.capturedAt ?? ev.uploadedAt)} · ${ev.createdBy.fullName}`} size="lg">
        <img src={ev.url} alt={ev.caption ?? 'Evidencia'} className="mx-auto max-h-[70vh] w-auto" />
      </Modal>
    </>
  );
}

export function EvidenceGallery({ evidence, items }: { evidence: EvidenceDto[]; items: ChecklistResponseDto[] }) {
  if (!evidence.length) return <EmptyState title="Sin evidencias registradas" />;
  const label = (id: string | null) => items.find((i) => i.id === id)?.label ?? 'General';
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {evidence.map((e, i) => (
        <li key={e.id} className="flex flex-col gap-1">
          <Thumb ev={e} size="md" />
          <p className="text-xs"><span className="code mr-1 text-text-muted">F{i + 1}</span>{label(e.checklistResponseId)}</p>
          {e.caption && <p className="text-xs text-text-muted">{e.caption}</p>}
        </li>
      ))}
    </ul>
  );
}

export function SignaturesView({ signatures, waived, waiverReason }: { signatures: SignatureDto[]; waived: boolean; waiverReason: string | null }) {
  const types = ['TECHNICIAN', 'CLIENT'] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {types.map((t) => {
        const s = signatures.find((x) => x.signatureType === t);
        return (
          <div key={t} className="rounded border border-border">
            <p className="border-b border-border px-3 py-2 label-caps">{SIGNATURE_TYPE_LABELS[t]}</p>
            <div className="flex h-28 items-center justify-center bg-surface px-3">
              {s ? (
                <img src={s.pngUrl} alt={`Firma de ${s.signerName}`} className="max-h-24 max-w-full" />
              ) : t === 'CLIENT' && waived ? (
                <p className="text-center text-sm text-text-muted">Excepción autorizada: {waiverReason}</p>
              ) : (
                <p className="text-sm font-medium text-danger">Sin firma</p>
              )}
            </div>
            {s && (
              <div className="border-t border-border px-3 py-2 text-sm">
                <p className="font-medium">{s.signerName}</p>
                <p className="text-xs text-text-muted">{[s.signerRole, fmtDateTime(s.signedAt)].filter(Boolean).join(' · ')}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
