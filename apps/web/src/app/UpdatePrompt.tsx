import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/offline/db';
import { Button } from '@/ui';

const CHECK_INTERVAL_MS = 30 * 60_000;

/**
 * Actualización controlada del service worker (§47): nunca recarga sola; el usuario decide.
 * Si hay cambios sin sincronizar se advierte antes de actualizar.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), CHECK_INTERVAL_MS);
    },
  });
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-3 border-b border-electric/40 bg-info-soft px-4 py-2 text-sm">
      <span>
        Hay una nueva versión de la aplicación.
        {pending > 0 && ' Sus cambios pendientes se conservan en el dispositivo.'}
      </span>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          Más tarde
        </Button>
      </div>
    </div>
  );
}
