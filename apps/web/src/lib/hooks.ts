import { useEffect, useState, useSyncExternalStore } from 'react';
import { syncEngine } from './offline/sync-engine';

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useSyncState() {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getState);
}

/** URL de objeto para un Blob, revocada automáticamente. */
export function useObjectUrl(blob: Blob | undefined | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Mecaelectric Operaciones`;
  }, [title]);
}
