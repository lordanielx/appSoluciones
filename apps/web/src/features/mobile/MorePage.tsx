import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, LogOut } from 'lucide-react';
import { ROLE_LABELS } from '@meca/shared';
import { useAuth } from '@/lib/auth/AuthProvider';
import { db } from '@/lib/offline/db';
import { fmtBytes } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, KeyValue, Modal, Panel } from '@/ui';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function MorePage() {
  useDocumentTitle('Más');
  const { user, logout } = useAuth();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const installed = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    void navigator.storage?.estimate?.().then((s) => setStorage({ usage: s.usage ?? 0, quota: s.quota ?? 0 }));
    // Solicita almacenamiento persistente para que el navegador no borre datos offline.
    void navigator.storage?.persist?.();
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-semibold">Más</h1>
      <Panel title="Mi cuenta">
        <KeyValue columns={1} items={[{ label: 'Nombre', value: user?.fullName }, { label: 'Correo', value: user?.email }, { label: 'Rol', value: user ? ROLE_LABELS[user.role] : null }]} />
      </Panel>
      <Panel title="Aplicación">
        <KeyValue
          columns={1}
          items={[
            { label: 'Instalación', value: installed ? 'Instalada en el dispositivo' : 'Abierta en el navegador' },
            { label: 'Datos en el dispositivo', value: storage ? `${fmtBytes(storage.usage)} usados` : null },
            { label: 'Versión', value: `MVP ${__APP_VERSION__}` },
          ]}
        />
        {!installed && installEvent && (
          <Button className="mt-3" block icon={<Download className="h-4 w-4" />} onClick={() => void installEvent.prompt().then(() => setInstallEvent(null))}>
            Instalar aplicación
          </Button>
        )}
        {!installed && !installEvent && <p className="mt-3 text-xs text-text-muted">Para instalar: en el menú del navegador elija “Agregar a pantalla de inicio”.</p>}
      </Panel>
      <Button variant="danger" size="lg" block icon={<LogOut className="h-5 w-5" />} onClick={() => (pending > 0 ? setConfirm(true) : void logout())}>
        Cerrar sesión
      </Button>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Hay cambios sin sincronizar"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Volver</Button>
            <Button variant="danger" onClick={() => void logout()}>Cerrar sesión y descartar</Button>
          </>
        }
      >
        <Alert tone="danger">
          Tiene {pending} {pending === 1 ? 'cambio' : 'cambios'} que aún no llegan al servidor. Si cierra sesión se eliminarán de este dispositivo. Conéctese y sincronice primero.
        </Alert>
      </Modal>
    </div>
  );
}
