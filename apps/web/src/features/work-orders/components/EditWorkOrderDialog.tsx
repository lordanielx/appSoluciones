import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PRIORITY_LABELS, Priority, type WorkOrderDetail } from '@meca/shared';
import { brandsApi, workOrdersApi } from '@/lib/api/endpoints';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { fromBogotaInput, toBogotaInput } from '@/lib/format';
import { Alert, Button, FormField, Input, Modal, Select, Textarea, useToast } from '@/ui';

/** Edición de datos de programación y alcance (concurrencia optimista por `version`). */
export function EditWorkOrderDialog({ wo, open, onOpenChange }: { wo: WorkOrderDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const brands = useQuery({ queryKey: ['brands', 'active'], queryFn: () => brandsApi.list(true), enabled: open });
  const initial = () => ({
    title: wo.title,
    priority: wo.priority,
    scheduledStart: toBogotaInput(wo.scheduledStart),
    scheduledEnd: toBogotaInput(wo.scheduledEnd),
    representedCompanyId: wo.representedCompany.id,
    serviceScope: wo.serviceScope ?? '',
    description: wo.description ?? '',
    address: wo.address ?? '',
    contactName: wo.contactName ?? '',
    contactPhone: wo.contactPhone ?? '',
    internalNotes: wo.internalNotes ?? '',
  });
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(initial());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (p: Partial<typeof f>) => setF((prev) => ({ ...prev, ...p }));

  const save = useMutation({
    mutationFn: () =>
      workOrdersApi.update(wo.id, {
        version: wo.version,
        title: f.title,
        priority: f.priority,
        scheduledStart: fromBogotaInput(f.scheduledStart),
        scheduledEnd: fromBogotaInput(f.scheduledEnd),
        representedCompanyId: f.representedCompanyId,
        serviceScope: f.serviceScope || null,
        description: f.description || null,
        address: f.address || null,
        contactName: f.contactName || null,
        contactPhone: f.contactPhone || null,
        internalNotes: f.internalNotes || null,
      }),
    onSuccess: () => {
      toast.success('Orden actualizada correctamente.');
      void qc.invalidateQueries({ queryKey: ['work-order', wo.id] });
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
        void qc.invalidateQueries({ queryKey: ['work-order', wo.id] });
        setError(`${e.message} Se recargó la información; revise y vuelva a guardar.`);
      } else setError(e instanceof ApiError && Object.keys(e.fieldErrors).length ? Object.values(e.fieldErrors).join(' ') : errorMessage(e));
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Editar ${wo.number}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Guardar cambios</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {error && <Alert tone="danger" className="md:col-span-2">{error}</Alert>}
        <FormField label="Título" required className="md:col-span-2">
          <Input value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </FormField>
        <FormField label="Prioridad">
          <Select value={f.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
            {Object.values(Priority).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </Select>
        </FormField>
        <FormField label="Empresa representada">
          <Select value={f.representedCompanyId} onChange={(e) => set({ representedCompanyId: e.target.value })}>
            {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Inicio programado">
          <Input type="datetime-local" value={f.scheduledStart} onChange={(e) => set({ scheduledStart: e.target.value })} />
        </FormField>
        <FormField label="Fin estimado">
          <Input type="datetime-local" value={f.scheduledEnd} onChange={(e) => set({ scheduledEnd: e.target.value })} />
        </FormField>
        <FormField label="Alcance" className="md:col-span-2">
          <Textarea rows={3} value={f.serviceScope} onChange={(e) => set({ serviceScope: e.target.value })} />
        </FormField>
        <FormField label="Descripción" className="md:col-span-2">
          <Textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </FormField>
        <FormField label="Dirección" className="md:col-span-2">
          <Input value={f.address} onChange={(e) => set({ address: e.target.value })} />
        </FormField>
        <FormField label="Contacto en sitio">
          <Input value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </FormField>
        <FormField label="Teléfono de contacto">
          <Input value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
        </FormField>
        <FormField label="Notas internas" className="md:col-span-2">
          <Textarea rows={2} value={f.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} />
        </FormField>
      </div>
    </Modal>
  );
}
