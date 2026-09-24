import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, CloudOff, AlertTriangle } from 'lucide-react';
import { SyncStatus } from '@meca/shared';
import type { LocalEvidence } from '@/lib/offline/db';
import { useObjectUrl } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Button, IconButton } from './Button';

interface EvidenceUploaderProps {
  items: LocalEvidence[];
  required: number;
  disabled?: boolean;
  onAdd: (files: File[]) => Promise<void>;
  onRemove: (id: string) => void;
}

/**
 * Captura de evidencias (§18): cámara trasera directa (capture="environment") o galería.
 * Las fotos se comprimen en el dispositivo y quedan guardadas aunque no haya señal.
 */
export function EvidenceUploader({ items, required, disabled, onAdd, onRemove }: EvidenceUploaderProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const missing = Math.max(0, required - items.length);

  const handle = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      await onAdd(Array.from(list));
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className={cn('label-caps', missing > 0 && '!text-accent')}>
          {required > 0 ? (missing > 0 ? `Evidencia requerida · faltan ${missing}` : 'Evidencia requerida · completa') : 'Evidencia (opcional)'}
        </p>
        <span className="tabular text-xs text-text-muted">Fotos: {items.length}</span>
      </div>
      {!disabled && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant={missing > 0 ? 'primary' : 'secondary'} size="lg" loading={busy} icon={<Camera className="h-5 w-5" />} onClick={() => cameraRef.current?.click()}>
            Tomar foto
          </Button>
          <Button variant="secondary" size="lg" disabled={busy} icon={<ImagePlus className="h-5 w-5" />} onClick={() => galleryRef.current?.click()}>
            Galería
          </Button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files)} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-label="Seleccionar fotografías" onChange={(e) => void handle(e.target.files)} />
        </div>
      )}
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((ev) => (
            <EvidenceThumb key={ev.id} ev={ev} onRemove={disabled ? undefined : () => onRemove(ev.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceThumb({ ev, onRemove }: { ev: LocalEvidence; onRemove?: () => void }) {
  const local = useObjectUrl(ev.thumbBlob ?? null);
  const src = local ?? ev.thumbnailUrl ?? null;
  return (
    <li className="relative aspect-square overflow-hidden rounded-sm border border-border bg-subtle">
      {src ? <img src={src} alt={ev.caption ?? 'Evidencia fotográfica'} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-2xs text-text-muted">Sin vista previa</div>}
      {ev.syncStatus !== SyncStatus.SYNCED && (
        <span
          className={cn(
            'absolute left-0 top-0 flex items-center gap-1 px-1.5 py-0.5 text-2xs font-semibold text-white',
            ev.syncStatus === SyncStatus.ERROR ? 'bg-danger' : 'bg-primary/80',
          )}
        >
          {ev.syncStatus === SyncStatus.ERROR ? <AlertTriangle className="h-3 w-3" aria-hidden /> : <CloudOff className="h-3 w-3" aria-hidden />}
          {ev.syncStatus === SyncStatus.ERROR ? 'Error' : 'Pendiente'}
        </span>
      )}
      {onRemove && (
        <IconButton label="Retirar fotografía" size="sm" variant="secondary" className="absolute bottom-1 right-1 !h-8 !w-8 bg-surface/95" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-danger" />
        </IconButton>
      )}
    </li>
  );
}
