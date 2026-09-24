import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { MobileScreenHeader } from '@/layouts/MobileLayout';
import { Alert, Button, IconButton, Spinner, StatusBadge } from '@/ui';
import type { LocalWorkOrder, OutboxOperation } from '@/lib/offline/db';

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <IconButton label="Volver" onClick={() => (to ? navigate(to) : navigate(-1))} className="-ml-2">
      <ChevronLeft className="h-5 w-5" />
    </IconButton>
  );
}

export function WorkOrderScreen({ wo, title, back, children, loading, error }: { wo: LocalWorkOrder | null; title: string; back: string; children: ReactNode; loading: boolean; error: string | null }) {
  if (loading) return <Spinner label="Cargando orden…" />;
  if (error || !wo) {
    return (
      <div className="p-4">
        <Alert tone="warning" title="Orden no disponible">{error}</Alert>
        <Link to="/mobile/work-orders" className="mt-4 block"><Button variant="secondary" block>Volver a mis órdenes</Button></Link>
      </div>
    );
  }
  return (
    <>
      <MobileScreenHeader back={<BackButton to={back} />} title={title} sub={<><span className="code">{wo.number}</span> · {wo.client.tradeName ?? wo.client.legalName}</>} right={<StatusBadge status={wo.status} />} />
      {children}
    </>
  );
}

/** Errores de sincronización de esta orden: nunca se ocultan (§24). */
export function SyncErrors({ ops }: { ops: OutboxOperation[] }) {
  if (!ops.length) return null;
  return (
    <div className="px-4 pt-3">
      <Alert tone="danger" title="Hay cambios que el servidor no aceptó" action={<Link to="/mobile/sync" className="text-sm font-semibold underline">Resolver</Link>}>
        <ul className="mt-1 list-disc pl-4">
          {ops.slice(0, 3).map((o) => <li key={o.id}>{o.lastError}</li>)}
        </ul>
      </Alert>
    </div>
  );
}

/** Barra de acciones fija sobre la navegación inferior (zona del pulgar). */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-0">
      <div className="mx-auto flex max-w-2xl gap-2">{children}</div>
    </div>
  );
}

export function ReadOnlyNotice() {
  return (
    <div className="flex items-start gap-2 border-b border-border bg-subtle px-4 py-2 text-xs text-text-muted">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      Solo lectura: el servicio no está en ejecución.
    </div>
  );
}
