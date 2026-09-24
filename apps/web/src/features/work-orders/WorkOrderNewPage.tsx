import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { PRIORITY_LABELS, Priority, type CreateWorkOrderInput } from '@meca/shared';
import { brandsApi, checklistsApi, clientsApi, serviceTypesApi, usersApi, workOrdersApi } from '@/lib/api/endpoints';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { fmtDateTime, fromBogotaInput, nitWithDv } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Alert, Button, EmptyState, FormField, Input, KeyValue, PageHeader, Panel, SearchInput, Select, Spinner, Textarea, useToast } from '@/ui';

const STEPS = ['Cliente', 'Equipo', 'Servicio', 'Plantilla checklist', 'Fecha y hora', 'Técnico', 'Empresa representada', 'Descripción y alcance', 'Confirmación'] as const;

interface Draft {
  clientId: string;
  equipmentId: string | null;
  serviceTypeId: string;
  title: string;
  priority: Priority;
  checklistTemplateId: string;
  scheduledStart: string;
  scheduledEnd: string;
  assignedTechnicianId: string | null;
  representedCompanyId: string;
  description: string;
  serviceScope: string;
  address: string;
  contactName: string;
  contactPhone: string;
  internalNotes: string;
}

const EMPTY: Draft = {
  clientId: '',
  equipmentId: null,
  serviceTypeId: '',
  title: '',
  priority: Priority.MEDIUM,
  checklistTemplateId: '',
  scheduledStart: '',
  scheduledEnd: '',
  assignedTechnicianId: null,
  representedCompanyId: '',
  description: '',
  serviceScope: '',
  address: '',
  contactName: '',
  contactPhone: '',
  internalNotes: '',
};

/** Opción seleccionable de lista (radio accesible con área táctil amplia). */
function Option({ selected, onSelect, children, name }: { selected: boolean; onSelect: () => void; children: ReactNode; name: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-subtle/60', selected && 'bg-info-soft')}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="mt-1 h-4 w-4 accent-[rgb(var(--color-primary))]" />
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

export function WorkOrderNewPage() {
  useDocumentTitle('Nueva orden de trabajo');
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [clientQ, setClientQ] = useState('');
  const [allTemplates, setAllTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const clients = useQuery({ queryKey: ['clients', 'picker', clientQ], queryFn: () => clientsApi.list({ q: clientQ, active: 'true', pageSize: 10 }) });
  const client = useQuery({ queryKey: ['client', d.clientId], queryFn: () => clientsApi.get(d.clientId), enabled: Boolean(d.clientId) });
  const equipment = useQuery({ queryKey: ['client', d.clientId, 'equipment', 'active'], queryFn: () => clientsApi.equipment(d.clientId, { active: 'true', pageSize: 100 }), enabled: Boolean(d.clientId) });
  const serviceTypes = useQuery({ queryKey: ['service-types', 'active'], queryFn: () => serviceTypesApi.list(true) });
  const templates = useQuery({
    queryKey: ['checklist-templates', 'picker', allTemplates ? '' : d.serviceTypeId],
    queryFn: () => checklistsApi.list({ active: 'true', pageSize: 100, serviceTypeId: allTemplates ? undefined : d.serviceTypeId || undefined }),
    enabled: Boolean(d.serviceTypeId) || allTemplates,
  });
  const technicians = useQuery({ queryKey: ['technicians'], queryFn: usersApi.technicians });
  const brands = useQuery({ queryKey: ['brands', 'active'], queryFn: () => brandsApi.list(true) });

  const serviceType = serviceTypes.data?.find((s) => s.id === d.serviceTypeId);
  const selectedEquipment = equipment.data?.items.find((e) => e.id === d.equipmentId);

  // Valores sugeridos (evitan digitar lo que el sistema ya conoce).
  useEffect(() => {
    if (!d.representedCompanyId && brands.data?.length) set({ representedCompanyId: (brands.data.find((b) => b.isDefault) ?? brands.data[0])!.id });
  }, [brands.data, d.representedCompanyId]);
  useEffect(() => {
    if (client.data) {
      setD((prev) => ({
        ...prev,
        address: prev.address || [client.data.address, client.data.city, client.data.department].filter(Boolean).join(', '),
        contactName: prev.contactName || client.data.contactName || '',
        contactPhone: prev.contactPhone || client.data.phone || '',
      }));
    }
  }, [client.data]);
  useEffect(() => {
    if (templates.data?.items.length === 1 && !d.checklistTemplateId) set({ checklistTemplateId: templates.data.items[0]!.id });
  }, [templates.data, d.checklistTemplateId]);

  const stepError = useMemo((): string | null => {
    switch (step) {
      case 0:
        return d.clientId ? null : 'Seleccione el cliente.';
      case 1:
        return null;
      case 2:
        if (!d.serviceTypeId) return 'Seleccione el tipo de servicio.';
        if (serviceType?.requiresEquipment && !d.equipmentId) return 'Este tipo de servicio requiere un equipo. Vuelva al paso Equipo.';
        return d.title.trim() ? null : 'Escriba un título corto para la orden.';
      case 3:
        return d.checklistTemplateId ? null : 'Seleccione la plantilla de checklist.';
      case 4:
        if (d.scheduledStart && d.scheduledEnd && d.scheduledEnd < d.scheduledStart) return 'La hora final debe ser posterior al inicio.';
        return null;
      case 6:
        return d.representedCompanyId ? null : 'Seleccione la empresa representada.';
      default:
        return null;
    }
  }, [step, d, serviceType]);

  const create = useMutation({
    mutationFn: (assignNow: boolean) => {
      const body: CreateWorkOrderInput = {
        clientId: d.clientId,
        equipmentId: d.equipmentId,
        serviceTypeId: d.serviceTypeId,
        checklistTemplateId: d.checklistTemplateId,
        representedCompanyId: d.representedCompanyId,
        title: d.title,
        priority: d.priority,
        scheduledStart: fromBogotaInput(d.scheduledStart),
        scheduledEnd: fromBogotaInput(d.scheduledEnd),
        assignedTechnicianId: d.assignedTechnicianId,
        description: d.description || null,
        serviceScope: d.serviceScope || null,
        address: d.address || null,
        contactName: d.contactName || null,
        contactPhone: d.contactPhone || null,
        internalNotes: d.internalNotes || null,
        assignNow,
      };
      return workOrdersApi.create(body);
    },
    onSuccess: (wo, assignNow) => {
      toast.success(assignNow ? `Orden ${wo.number} creada y asignada correctamente.` : `Orden ${wo.number} guardada como borrador.`);
      navigate(`/work-orders/${wo.id}`);
    },
    onError: (e) => {
      const fields = e instanceof ApiError ? Object.values(e.fieldErrors) : [];
      setError(fields.length ? fields.join(' ') : errorMessage(e));
    },
  });

  const next = () => {
    if (stepError) return setError(stepError);
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const technician = technicians.data?.find((t) => t.id === d.assignedTechnicianId);
  const template = templates.data?.items.find((t) => t.id === d.checklistTemplateId);
  const brand = brands.data?.find((b) => b.id === d.representedCompanyId);

  return (
    <>
      <PageHeader title="Nueva orden de trabajo" breadcrumb={[{ label: 'Órdenes', to: '/work-orders' }, { label: 'Nueva' }]} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Pasos" className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-sm font-medium lg:hidden">
            Paso {step + 1} de {STEPS.length}: {STEPS[step]}
          </p>
          <div className="h-1 bg-border lg:hidden">
            <div className="h-1 bg-accent" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <ol className="hidden border-l border-border lg:block">
            {STEPS.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={cn(
                    '-ml-px flex h-10 w-full items-center gap-3 border-l-[3px] border-transparent pl-4 text-left text-sm',
                    i === step && 'border-accent font-semibold text-text',
                    i < step && 'text-text hover:bg-subtle',
                    i > step && 'cursor-default text-text-muted',
                  )}
                >
                  <span className="code w-5 text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                  {label}
                  {i < step && <Check className="ml-auto mr-2 h-4 w-4 text-success" aria-label="Completado" />}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={`${String(step + 1).padStart(2, '0')} · ${STEPS[step]}`} flush={step <= 3 || step === 5 || step === 6}>
            {step === 0 && (
              <div>
                <div className="border-b border-border p-3">
                  <SearchInput value={clientQ} onChange={setClientQ} placeholder="Buscar cliente por nombre o NIT" />
                </div>
                {clients.isLoading ? <Spinner /> : clients.data?.items.length ? (
                  clients.data.items.map((c) => (
                    <Option key={c.id} name="client" selected={d.clientId === c.id} onSelect={() => set({ clientId: c.id, equipmentId: null, address: '', contactName: '', contactPhone: '' })}>
                      <p className="font-medium">{c.legalName}</p>
                      <p className="text-xs text-text-muted">NIT {nitWithDv(c.nit, c.dv)} · {c.city ?? 'Sin ciudad'} · {c.equipmentCount ?? 0} equipos</p>
                    </Option>
                  ))
                ) : (
                  <div className="p-4"><EmptyState title="No se encontraron clientes activos" /></div>
                )}
              </div>
            )}
            {step === 1 && (
              <div>
                <Option name="equipment" selected={d.equipmentId === null} onSelect={() => set({ equipmentId: null })}>
                  <p className="font-medium">Sin equipo específico</p>
                  <p className="text-xs text-text-muted">Visita general o servicio que no se asocia a un equipo.</p>
                </Option>
                {equipment.data?.items.map((e) => (
                  <Option key={e.id} name="equipment" selected={d.equipmentId === e.id} onSelect={() => set({ equipmentId: e.id })}>
                    <p className="font-medium"><span className="code mr-2">{e.code}</span>{e.name}</p>
                    <p className="text-xs text-text-muted">{[e.brand, e.model, e.serial && `S/N ${e.serial}`, e.location].filter(Boolean).join(' · ')}</p>
                  </Option>
                ))}
              </div>
            )}
            {step === 2 && (
              <div>
                {serviceTypes.data?.map((s) => (
                  <Option
                    key={s.id}
                    name="serviceType"
                    selected={d.serviceTypeId === s.id}
                    onSelect={() => set({ serviceTypeId: s.id, checklistTemplateId: '', title: d.title || [s.name, selectedEquipment?.name].filter(Boolean).join(' — ') })}
                  >
                    <p className="font-medium">{s.name} <span className="code ml-1 text-text-muted">{s.code}</span></p>
                    <p className="text-xs text-text-muted">{s.description ?? ''}{s.requiresEquipment ? ' · Requiere equipo' : ''}</p>
                  </Option>
                ))}
                <div className="grid gap-4 border-t border-border p-4 md:grid-cols-[1fr_200px]">
                  <FormField label="Título de la orden" required>
                    <Input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} />
                  </FormField>
                  <FormField label="Prioridad">
                    <Select value={d.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                      {Object.values(Priority).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </Select>
                  </FormField>
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                {templates.data?.items.length ? (
                  templates.data.items.map((t) => (
                    <Option key={t.id} name="template" selected={d.checklistTemplateId === t.id} onSelect={() => set({ checklistTemplateId: t.id })}>
                      <p className="font-medium">{t.name} <span className="code ml-1 text-text-muted">v{t.version}</span></p>
                      <p className="text-xs text-text-muted">{t.itemCount} actividades{t.serviceType ? ` · ${t.serviceType.name}` : ''}</p>
                    </Option>
                  ))
                ) : (
                  <div className="p-4"><EmptyState title="No hay plantillas para este tipo de servicio" description="Puede mostrar todas las plantillas activas." /></div>
                )}
                <div className="border-t border-border px-4 py-2">
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input type="checkbox" checked={allTemplates} onChange={(e) => setAllTemplates(e.target.checked)} className="h-4 w-4" />
                    Mostrar plantillas de otros tipos de servicio
                  </label>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Inicio programado" hint="Hora de Colombia">
                  <Input type="datetime-local" value={d.scheduledStart} onChange={(e) => set({ scheduledStart: e.target.value })} />
                </FormField>
                <FormField label="Fin estimado">
                  <Input type="datetime-local" value={d.scheduledEnd} min={d.scheduledStart || undefined} onChange={(e) => set({ scheduledEnd: e.target.value })} />
                </FormField>
              </div>
            )}
            {step === 5 && (
              <div>
                <Option name="tech" selected={d.assignedTechnicianId === null} onSelect={() => set({ assignedTechnicianId: null })}>
                  <p className="font-medium">Asignar después</p>
                  <p className="text-xs text-text-muted">La orden quedará en borrador hasta seleccionar el técnico.</p>
                </Option>
                {technicians.data?.map((t) => (
                  <Option key={t.id} name="tech" selected={d.assignedTechnicianId === t.id} onSelect={() => set({ assignedTechnicianId: t.id })}>
                    <p className="font-medium">{t.fullName}</p>
                    <p className="text-xs text-text-muted">{[t.jobTitle, t.phone].filter(Boolean).join(' · ')}</p>
                  </Option>
                ))}
              </div>
            )}
            {step === 6 && (
              <div>
                {brands.data?.map((b) => (
                  <Option key={b.id} name="brand" selected={d.representedCompanyId === b.id} onSelect={() => set({ representedCompanyId: b.id })}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-3 shrink-0 flex-col" aria-hidden>
                        <span className="flex-[3]" style={{ background: b.primaryColor }} />
                        <span className="flex-1" style={{ background: b.secondaryColor }} />
                      </span>
                      <div>
                        <p className="font-medium">{b.name}{b.isDefault && <span className="ml-2 text-xs text-text-muted">(principal)</span>}</p>
                        <p className="text-xs text-text-muted">{b.legalName} · NIT {b.nit} · Define la marca del informe PDF</p>
                      </div>
                    </div>
                  </Option>
                ))}
              </div>
            )}
            {step === 7 && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Alcance del servicio" className="md:col-span-2" hint="Qué debe hacer el técnico. Aparece en el informe.">
                  <Textarea rows={3} value={d.serviceScope} onChange={(e) => set({ serviceScope: e.target.value })} />
                </FormField>
                <FormField label="Descripción / necesidad reportada" className="md:col-span-2">
                  <Textarea rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} />
                </FormField>
                <FormField label="Dirección del servicio" className="md:col-span-2">
                  <Input value={d.address} onChange={(e) => set({ address: e.target.value })} />
                </FormField>
                <FormField label="Contacto en sitio">
                  <Input value={d.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                </FormField>
                <FormField label="Teléfono de contacto">
                  <Input type="tel" value={d.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
                </FormField>
                <FormField label="Notas internas" className="md:col-span-2" hint="No visibles para el técnico ni en el informe.">
                  <Textarea rows={2} value={d.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} />
                </FormField>
              </div>
            )}
            {step === 8 && (
              <KeyValue
                items={[
                  { label: 'Cliente', value: client.data?.legalName },
                  { label: 'Equipo', value: selectedEquipment ? `${selectedEquipment.code} · ${selectedEquipment.name}` : 'Sin equipo específico' },
                  { label: 'Tipo de servicio', value: serviceType?.name },
                  { label: 'Título', value: d.title },
                  { label: 'Prioridad', value: PRIORITY_LABELS[d.priority] },
                  { label: 'Plantilla', value: template ? `${template.name} (v${template.version}, ${template.itemCount} actividades)` : null },
                  { label: 'Programada', value: d.scheduledStart ? fmtDateTime(fromBogotaInput(d.scheduledStart)) : 'Sin fecha' },
                  { label: 'Técnico', value: technician?.fullName ?? 'Por asignar' },
                  { label: 'Empresa representada', value: brand?.name },
                  { label: 'Dirección', value: d.address || null },
                ]}
              />
            )}
          </Panel>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={step === 0 ? () => navigate('/work-orders') : back} icon={step > 0 ? <ChevronLeft className="h-4 w-4" /> : undefined}>
              {step === 0 ? 'Cancelar' : 'Anterior'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continuar <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" loading={create.isPending && create.variables === false} onClick={() => create.mutate(false)}>
                  Guardar borrador
                </Button>
                <Button variant="accent" disabled={!d.assignedTechnicianId} loading={create.isPending && create.variables === true} onClick={() => create.mutate(true)}>
                  Crear y asignar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
