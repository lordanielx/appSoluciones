import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { SyncStatus } from '@meca/shared';
import { db } from '@/lib/offline/db';
import { useOnline, useSyncState } from '@/lib/hooks';
import { cn } from '@/lib/cn';

/**
 * Estado de sincronización siempre visible (§24): Sincronizado / Sin conexión / N cambios pendientes.
 * Nunca oculta errores.
 */
export function SyncIndicator({ compact, className }: { compact?: boolean; className?: string }) {
  const online = useOnline();
  const sync = useSyncState();
  const counts = useLiveQuery(async () => {
    const all = await db.outbox.toArray();
    return {
      pending: all.filter((o) => o.status !== SyncStatus.ERROR).length,
      errors: all.filter((o) => o.status === SyncStatus.ERROR).length,
    };
  }, []);
  const pending = counts?.pending ?? 0;
  const errors = counts?.errors ?? 0;

  let tone: 'ok' | 'offline' | 'pending' | 'error' = 'ok';
  let text = 'Sincronizado';
  if (errors > 0) {
    tone = 'error';
    text = errors === 1 ? '1 cambio con error' : `${errors} cambios con error`;
  } else if (!online) {
    tone = 'offline';
    text = pending > 0 ? `Sin conexión · ${pending} pendiente${pending === 1 ? '' : 's'}` : 'Sin conexión';
  } else if (sync.authRequired && pending > 0) {
    tone = 'error';
    text = 'Inicie sesión para sincronizar';
  } else if (pending > 0) {
    tone = 'pending';
    text = sync.running ? 'Sincronizando…' : `${pending} cambio${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}`;
  }

  const dot = { ok: 'bg-success', offline: 'bg-steel', pending: 'bg-warning', error: 'bg-danger' }[tone];
  return (
    <Link
      to="/mobile/sync"
      aria-live="polite"
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-sm border px-2.5 text-xs font-medium',
        tone === 'ok' && 'border-white/15 text-white/85',
        tone === 'offline' && 'border-white/25 bg-white/10 text-white',
        tone === 'pending' && 'border-warning/60 bg-warning/20 text-white',
        tone === 'error' && 'border-danger bg-danger text-white',
        className,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0', dot, sync.running && tone === 'pending' && 'animate-pulse')} aria-hidden />
      <span className={cn(compact && 'max-w-[150px] truncate')}>{text}</span>
    </Link>
  );
}

/** Franja informativa cuando la administración pierde conexión (no trabaja offline). */
export function OfflineIndicator() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="border-b border-warning/50 bg-warning-soft px-4 py-2 text-sm text-text">
      <strong className="font-semibold">Sin conexión.</strong> Los datos mostrados pueden no estar actualizados; las acciones se habilitarán al recuperar la conexión.
    </div>
  );
}
