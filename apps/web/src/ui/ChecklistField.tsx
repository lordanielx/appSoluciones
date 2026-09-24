import { ResponseType, STATUS_VALUE_LABELS, StatusValue, isOutOfRange, type ChecklistValue } from '@meca/shared';
import { cn } from '@/lib/cn';
import { Input, Textarea } from './inputs';

interface ChecklistFieldProps {
  id: string;
  responseType: ResponseType;
  value: ChecklistValue;
  onChange: (v: ChecklistValue) => void;
  options: string[];
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  disabled?: boolean;
  labelledBy: string;
}

const STATUS_ORDER: StatusValue[] = [StatusValue.GOOD, StatusValue.FAIR, StatusValue.NEEDS_INTERVENTION, StatusValue.CRITICAL, StatusValue.NOT_APPLICABLE];
const STATUS_TONE: Record<StatusValue, string> = {
  GOOD: 'aria-checked:border-success aria-checked:bg-success-soft aria-checked:text-success',
  FAIR: 'aria-checked:border-warning aria-checked:bg-warning-soft aria-checked:text-[#7A5010]',
  NEEDS_INTERVENTION: 'aria-checked:border-[#C2410C] aria-checked:bg-[#FCEBDD] aria-checked:text-[#9A3412]',
  CRITICAL: 'aria-checked:border-danger aria-checked:bg-danger-soft aria-checked:text-danger',
  NOT_APPLICABLE: 'aria-checked:border-steel aria-checked:bg-subtle aria-checked:text-graphite',
};

/** Opciones grandes y tocables en vez de listas desplegables: menos escritura, menos errores. */
function Choice({ checked, onSelect, children, className, disabled, multi }: { checked: boolean; onSelect: () => void; children: React.ReactNode; className?: string; disabled?: boolean; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-[48px] items-center gap-3 rounded border border-border-strong bg-surface px-3 text-left text-md font-medium text-text transition-colors',
        'hover:border-steel disabled:cursor-not-allowed disabled:opacity-60 aria-checked:border-2 aria-checked:border-primary aria-checked:bg-info-soft',
        className,
      )}
    >
      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center border-2', checked ? 'border-current bg-current' : 'border-border-strong', multi ? 'rounded-sm' : '')} aria-hidden>
        {checked && <span className="h-1.5 w-1.5 bg-surface" />}
      </span>
      {children}
    </button>
  );
}

export function ChecklistField({ id, responseType, value, onChange, options, unit, minValue, maxValue, disabled, labelledBy }: ChecklistFieldProps) {
  switch (responseType) {
    case ResponseType.STATUS:
      return (
        <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STATUS_ORDER.map((s) => (
            <Choice key={s} checked={value === s} onSelect={() => onChange(s)} disabled={disabled} className={STATUS_TONE[s]}>
              {STATUS_VALUE_LABELS[s]}
            </Choice>
          ))}
        </div>
      );
    case ResponseType.BOOLEAN:
      return (
        <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2">
          <Choice checked={value === true} onSelect={() => onChange(true)} disabled={disabled}>
            Sí
          </Choice>
          <Choice checked={value === false} onSelect={() => onChange(false)} disabled={disabled}>
            No
          </Choice>
        </div>
      );
    case ResponseType.SELECT:
      return (
        <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-1 gap-2">
          {options.map((o) => (
            <Choice key={o} checked={value === o} onSelect={() => onChange(o)} disabled={disabled}>
              {o}
            </Choice>
          ))}
        </div>
      );
    case ResponseType.MULTISELECT: {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-1 gap-2">
          {options.map((o) => (
            <Choice
              key={o}
              multi
              checked={selected.includes(o)}
              disabled={disabled}
              onSelect={() => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])}
            >
              {o}
            </Choice>
          ))}
        </div>
      );
    }
    case ResponseType.NUMBER: {
      const out = typeof value === 'number' && isOutOfRange({ responseType, minValue, maxValue }, value);
      const range = minValue !== null || maxValue !== null ? `Rango esperado: ${minValue ?? '—'} a ${maxValue ?? '—'}${unit ? ` ${unit}` : ''}` : null;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-stretch">
            <Input
              id={id}
              touch
              type="text"
              inputMode="decimal"
              aria-labelledby={labelledBy}
              disabled={disabled}
              defaultValue={typeof value === 'number' ? String(value).replace('.', ',') : ''}
              key={typeof value === 'number' ? 'n' : 'e'}
              onBlur={(e) => {
                const raw = e.target.value.trim().replace(',', '.');
                if (raw === '') return onChange(null);
                const n = Number(raw);
                if (Number.isFinite(n)) onChange(n);
              }}
              className={cn('tabular text-xl font-semibold', unit && 'rounded-r-none', out && '!border-danger')}
            />
            {unit && <span className="flex items-center rounded-r border border-l-0 border-border-strong bg-subtle px-3 text-md font-medium text-text-muted">{unit}</span>}
          </div>
          {range && <p className={cn('text-xs', out ? 'font-semibold text-danger' : 'text-text-muted')}>{out ? `Fuera de rango. ${range}. Registre una observación.` : range}</p>}
        </div>
      );
    }
    case ResponseType.TEXT:
      return <Input id={id} touch aria-labelledby={labelledBy} disabled={disabled} defaultValue={typeof value === 'string' ? value : ''} onBlur={(e) => onChange(e.target.value.trim() || null)} maxLength={500} />;
    case ResponseType.LONG_TEXT:
      return <Textarea id={id} rows={4} aria-labelledby={labelledBy} disabled={disabled} defaultValue={typeof value === 'string' ? value : ''} onBlur={(e) => onChange(e.target.value.trim() || null)} maxLength={5000} />;
  }
}
