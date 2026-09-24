import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XOctagon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const toneStyle: Record<Tone, string> = {
  info: 'border-electric/40 bg-info-soft text-text',
  success: 'border-success/40 bg-success-soft text-text',
  warning: 'border-warning/50 bg-warning-soft text-text',
  danger: 'border-danger/40 bg-danger-soft text-text',
};
const toneIcon: Record<Tone, ReactNode> = {
  info: <Info className="h-4 w-4 text-electric" aria-hidden />,
  success: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />,
  danger: <XOctagon className="h-4 w-4 text-danger" aria-hidden />,
};

export function Alert({ tone = 'info', title, children, action, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded border border-l-[3px] px-3 py-3', toneStyle[tone], className)}>
      <div className="pt-0.5">{toneIcon[tone]}</div>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-text/90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-border-strong px-5 py-8 sm:items-center sm:text-center">
      {icon && <div className="text-steel">{icon}</div>}
      <p className="text-md font-semibold text-text">{title}</p>
      {description && <p className="max-w-md text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-subtle', className)} aria-hidden />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4" role="status" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm text-text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}
