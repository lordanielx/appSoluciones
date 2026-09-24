import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

const DEBOUNCE_MS = 300;

/** Búsqueda con debounce; el filtrado ocurre en el servidor. */
export function SearchInput({ value, onChange, placeholder, className, label = 'Buscar' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = window.setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded border border-border-strong bg-surface pl-9 pr-3 text-base placeholder:text-text-muted/70 hover:border-steel focus:border-electric"
      />
    </div>
  );
}
