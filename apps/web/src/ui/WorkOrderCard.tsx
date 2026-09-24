import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import type { WorkOrderListItem } from '@meca/shared';
import { fmtTime, fmtShort } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PriorityBadge, StatusBadge } from './StatusBadge';

type CardOrder = Pick<WorkOrderListItem, 'id' | 'number' | 'title' | 'status' | 'priority' | 'scheduledStart' | 'client' | 'equipment' | 'checklistProgress'> & { address?: string | null };

/** Tarjeta compacta de OT para el técnico: lo esencial para decidir y abrir el servicio. */
export function WorkOrderCard({ wo, to, pending, showDate }: { wo: CardOrder; to: string; pending?: number; showDate?: boolean }) {
  const { answered, total } = wo.checklistProgress;
  return (
    <Link to={to} className="group block rounded border border-border bg-surface transition-colors hover:border-steel">
      <div className="flex items-stretch">
        <div className="flex w-[68px] shrink-0 flex-col items-center justify-center border-r border-border bg-subtle/60 px-2 py-3">
          <span className="tabular text-lg font-semibold leading-none text-text">{wo.scheduledStart ? fmtTime(wo.scheduledStart) : '--:--'}</span>
          {showDate && wo.scheduledStart && <span className="mt-1 text-2xs text-text-muted">{fmtShort(wo.scheduledStart).split(',')[0]}</span>}
        </div>
        <div className="min-w-0 flex-1 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="code text-text-muted">{wo.number}</span>
            <StatusBadge status={wo.status} />
          </div>
          <p className="mt-1 truncate text-md font-semibold text-text">{wo.client.tradeName ?? wo.client.legalName}</p>
          <p className="truncate text-sm text-text-muted">
            {wo.equipment ? `${wo.equipment.code} · ${wo.equipment.name}` : wo.title}
          </p>
          {wo.address && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-text-muted">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {wo.address}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <PriorityBadge priority={wo.priority} />
            <span className={cn('tabular text-xs', pending ? 'font-semibold text-warning' : 'text-text-muted')}>
              {pending ? `${pending} sin sincronizar · ` : ''}
              {answered}/{total} actividades
            </span>
          </div>
        </div>
        <div className="flex items-center pr-2 text-text-muted group-hover:text-text">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
