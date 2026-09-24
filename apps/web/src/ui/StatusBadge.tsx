import { PRIORITY_LABELS, WORK_ORDER_STATUS_LABELS, type Priority, type WorkOrderStatus } from '@meca/shared';
import { cn } from '@/lib/cn';

/** Color por estado (§44). El texto siempre acompaña al color. */
const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  DRAFT: 'border-l-steel bg-subtle text-graphite',
  ASSIGNED: 'border-l-electric bg-info-soft text-electric',
  ACCEPTED: 'border-l-primary bg-info-soft text-primary',
  REJECTED: 'border-l-danger bg-danger-soft text-danger',
  IN_PROGRESS: 'border-l-accent bg-[#FDEEE3] text-[#9A3D02]',
  PENDING_REVIEW: 'border-l-warning bg-warning-soft text-[#7A5010]',
  CHANGES_REQUESTED: 'border-l-[#C2410C] bg-[#FCEBDD] text-[#9A3412]',
  APPROVED: 'border-l-success bg-success-soft text-success',
  CLOSED: 'border-l-graphite bg-subtle text-graphite',
  CANCELLED: 'border-l-danger bg-surface text-danger line-through decoration-1',
};

interface BadgeBaseProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, className, size = 'sm' }: BadgeBaseProps & { status: WorkOrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm border-l-[3px] font-semibold uppercase tracking-[0.06em]',
        size === 'sm' ? 'h-6 px-2 text-2xs' : 'h-7 px-2.5 text-xs',
        STATUS_STYLE[status],
        className,
      )}
    >
      {WORK_ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, { bars: number; cls: string }> = {
  LOW: { bars: 1, cls: 'text-text-muted' },
  MEDIUM: { bars: 2, cls: 'text-electric' },
  HIGH: { bars: 3, cls: 'text-accent' },
  URGENT: { bars: 4, cls: 'text-danger' },
};

/** Prioridad: indicador de barras (tipo nivel de señal) + texto. */
export function PriorityBadge({ priority, className }: BadgeBaseProps & { priority: Priority }) {
  const { bars, cls } = PRIORITY_STYLE[priority];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cls, className)}>
      <span className="flex h-3 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('w-[3px] rounded-[1px]', i <= bars ? 'bg-current' : 'bg-border')} style={{ height: `${3 + i * 2}px` }} />
        ))}
      </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** Etiqueta neutra rectangular (activo/inactivo, tipos, etc.). */
export function Tag({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info'; className?: string }) {
  const tones = {
    neutral: 'bg-subtle text-graphite border-border',
    success: 'bg-success-soft text-success border-success/30',
    danger: 'bg-danger-soft text-danger border-danger/30',
    warning: 'bg-warning-soft text-[#7A5010] border-warning/30',
    info: 'bg-info-soft text-electric border-electric/30',
  } as const;
  return (
    <span className={cn('inline-flex h-6 items-center rounded-sm border px-2 text-2xs font-semibold uppercase tracking-[0.05em]', tones[tone], className)}>
      {children}
    </span>
  );
}
