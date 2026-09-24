import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TimelineItem {
  id: string;
  time: string;
  title: ReactNode;
  actor?: string | null;
  detail?: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'danger';
}

/** Línea de tiempo vertical con marcas cuadradas (historial de OT §50). */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative">
      {items.map((it, i) => (
        <li key={it.id} className="relative grid grid-cols-[88px_16px_1fr] gap-x-3 pb-4 last:pb-0">
          <time className="tabular pt-px text-right text-xs text-text-muted">{it.time}</time>
          <div className="relative flex justify-center">
            {i < items.length - 1 && <span className="absolute top-3 h-full w-px bg-border" aria-hidden />}
            <span
              className={cn(
                'relative mt-1 h-2.5 w-2.5 border-2 bg-surface',
                it.tone === 'accent' ? 'border-accent' : it.tone === 'success' ? 'border-success' : it.tone === 'danger' ? 'border-danger' : 'border-steel',
              )}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">{it.title}</p>
            {it.actor && <p className="text-xs text-text-muted">{it.actor}</p>}
            {it.detail && <div className="mt-1 text-xs text-text-muted">{it.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
