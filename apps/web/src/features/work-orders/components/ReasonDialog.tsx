import { useEffect, useState } from 'react';
import { Button, FormField, Modal, Textarea } from '@/ui';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  placeholder?: string;
  tone?: 'primary' | 'danger' | 'accent';
  loading?: boolean;
  onConfirm: (text: string) => void;
}

const MIN = 5;

/** Diálogo que exige un texto (motivo, comentario de corrección). */
export function ReasonDialog({ open, onOpenChange, title, description, label, confirmLabel, placeholder, tone = 'primary', loading, onConfirm }: ReasonDialogProps) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open]);
  const invalid = text.trim().length < MIN;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant={tone}
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(text.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <FormField label={label} required error={touched && invalid ? `Escriba al menos ${MIN} caracteres.` : undefined}>
        <Textarea rows={4} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} autoFocus />
      </FormField>
    </Modal>
  );
}
