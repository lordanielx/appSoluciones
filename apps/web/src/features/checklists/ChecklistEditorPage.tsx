import { useEffect, useId, useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import { z } from 'zod';
import {
  MAX_PHOTOS_PER_ITEM,
  Permission,
  RESPONSE_TYPE_LABELS,
  ResponseType,
  checklistTemplateSchema,
  type ChecklistTemplateDto,
} from '@meca/shared';
import { checklistsApi, serviceTypesApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthProvider';
import { applyServerErrors } from '@/lib/forms/useApiForm';
import { useDocumentTitle } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Alert, Button, Checkbox, EmptyState, FormField, IconButton, Input, PageHeader, Panel, Select, Spinner, Tag, Textarea, useToast } from '@/ui';

const editorSchema = checklistTemplateSchema.extend({ active: z.boolean().optional() });
type FormValues = z.input<typeof editorSchema>;
type FormData = z.output<typeof editorSchema>;
type ItemValues = FormValues['items'][number];

const RESPONSE_TYPES = Object.keys(RESPONSE_TYPE_LABELS) as ResponseType[];
const OPTION_TYPES: readonly ResponseType[] = [ResponseType.SELECT, ResponseType.MULTISELECT];

const toNumberOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toInt = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const num = (i: number) => String(i + 1).padStart(2, '0');
const sectionOf = (s: string | null | undefined) => (s ?? '').trim();

function newItem(section?: string | null): ItemValues {
  return {
    section: section ?? '',
    label: '',
    description: '',
    responseType: ResponseType.BOOLEAN,
    required: true,
    evidenceRequired: false,
    minPhotos: 0,
    observationRequired: false,
    options: [],
    unit: '',
    minValue: null,
    maxValue: null,
  };
}

function toFormValues(t: ChecklistTemplateDto): FormValues {
  return {
    name: t.name,
    serviceTypeId: t.serviceTypeId,
    description: t.description ?? '',
    active: t.active,
    items: [...(t.items ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((it) => ({
        id: it.id,
        section: it.section ?? '',
        label: it.label,
        description: it.description ?? '',
        responseType: it.responseType,
        required: it.required,
        evidenceRequired: it.evidenceRequired,
        minPhotos: it.minPhotos,
        observationRequired: it.observationRequired,
        options: it.options,
        unit: it.unit ?? '',
        minValue: it.minValue,
        maxValue: it.maxValue,
      })),
  };
}

export function ChecklistEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Plantilla de checklist' : 'Nueva plantilla');
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useAuth();
  const readOnly = !can(Permission.CHECKLISTS_MANAGE);

  const existing = useQuery({ queryKey: ['checklist', id], queryFn: () => checklistsApi.get(id as string), enabled: editing });
  const serviceTypes = useQuery({ queryKey: ['service-types', { active: true }], queryFn: () => serviceTypesApi.list(true) });

  const form = useForm<FormValues, unknown, FormData>({
    resolver: zodResolver(editorSchema),
    defaultValues: { name: '', serviceTypeId: null, description: '', items: [newItem()] },
  });
  const { register, handleSubmit, formState, reset, setError, control, getValues } = form;
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: 'items', keyName: 'key' });
  const items = useWatch({ control, name: 'items' });

  useEffect(() => {
    if (existing.data) reset(toFormValues(existing.data));
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (d: FormData) => {
      const body = { name: d.name, serviceTypeId: d.serviceTypeId, description: d.description, items: d.items };
      return editing ? checklistsApi.update(id as string, { ...body, active: d.active }) : checklistsApi.create(body);
    },
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ['checklists'] });
      qc.setQueryData(['checklist', t.id], t);
      toast.success(`Plantilla guardada (versión ${t.version}).`);
      if (editing) reset(toFormValues(t));
      else navigate(`/checklists/${t.id}`, { replace: true });
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });

  const sections = useMemo(
    () => Array.from(new Set((items ?? []).map((it) => sectionOf(it?.section)).filter(Boolean))),
    [items],
  );
  const datalistId = useId();

  if (editing && existing.isLoading) return <Spinner />;
  if (editing && existing.isError) {
    return (
      <>
        <PageHeader title="Plantilla de checklist" breadcrumb={[{ label: 'Checklists', to: '/checklists' }, { label: 'Plantilla' }]} />
        <Alert tone="danger" title="No fue posible cargar la plantilla.">Verifique la conexión e intente de nuevo.</Alert>
      </>
    );
  }

  const err = formState.errors;
  const version = existing.data?.version ?? 0;
  const serviceTypeOptions = [...(serviceTypes.data ?? [])];
  const current = existing.data?.serviceType;
  if (current && !serviceTypeOptions.some((s) => s.id === current.id)) {
    serviceTypeOptions.push({ ...current, description: null, requiresEquipment: false, active: false });
  }
  const itemsError = err.items?.message ?? err.items?.root?.message;
  const title = editing ? existing.data?.name ?? 'Plantilla' : 'Nueva plantilla';

  const duplicate = (i: number) => {
    const { id: _omit, ...rest } = getValues(`items.${i}`);
    void _omit;
    insert(i + 1, { ...rest, options: [...(rest.options ?? [])] });
  };

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={[{ label: 'Checklists', to: '/checklists' }, { label: editing ? existing.data?.name ?? 'Plantilla' : 'Nueva' }]}
        meta={
          editing && existing.data ? (
            <>
              <span className="code text-text-muted">Versión v{existing.data.version}</span>
              {existing.data.active ? <Tag tone="success">Activa</Tag> : <Tag>Inactiva</Tag>}
              {readOnly && <Tag tone="info">Solo lectura</Tag>}
            </>
          ) : undefined
        }
      />
      <form onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
          <legend className="sr-only">Datos de la plantilla</legend>
          {editing && !readOnly && (
            <Alert tone="info" title="Control de versiones">
              Modificar las actividades crea una nueva versión (v{version + 1}). Las órdenes ya creadas conservan la versión con la que fueron generadas.
            </Alert>
          )}

          <Panel title="Datos generales">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nombre de la plantilla" required error={err.name?.message} className="md:col-span-2">
                <Input {...register('name')} autoFocus={!editing && !readOnly} placeholder="Ej.: Mantenimiento preventivo tablero de baja tensión" />
              </FormField>
              <FormField label="Tipo de servicio" error={err.serviceTypeId?.message} hint="Opcional. Sugiere esta plantilla al crear órdenes de ese tipo.">
                <Select {...register('serviceTypeId', { setValueAs: (v: unknown) => (v ? String(v) : null) })}>
                  <option value="">Sin tipo de servicio</option>
                  {serviceTypeOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.active ? '' : ' (inactivo)'}
                    </option>
                  ))}
                </Select>
              </FormField>
              {editing && (
                <div className="flex items-end">
                  <Checkbox label="Plantilla activa" description="Solo las plantillas activas pueden asignarse a nuevas órdenes." {...register('active')} />
                </div>
              )}
              <FormField label="Descripción" error={err.description?.message} className="md:col-span-2">
                <Textarea rows={3} {...register('description')} placeholder="Alcance, equipos a los que aplica, normas de referencia." />
              </FormField>
            </div>
          </Panel>

          <Panel
            title={`Actividades (${fields.length})`}
            actions={
              !readOnly && (
                <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => append(newItem(items?.[items.length - 1]?.section))}>
                  Agregar actividad
                </Button>
              )
            }
          >
            <datalist id={datalistId}>
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {itemsError && (
              <p role="alert" className="mb-3 text-xs font-medium text-danger">
                {itemsError}
              </p>
            )}
            {fields.length === 0 ? (
              <EmptyState title="La plantilla no tiene actividades" description="Agregue al menos una actividad para que el técnico pueda diligenciarla." />
            ) : (
              <ol className="flex flex-col gap-3">
                {fields.map((field, i) => {
                  const section = sectionOf(items?.[i]?.section);
                  const prevSection = i > 0 ? sectionOf(items?.[i - 1]?.section) : null;
                  const showHeading = i === 0 || section !== prevSection;
                  return (
                    <li key={field.key} className="flex flex-col gap-2">
                      {showHeading && (
                        <div className={cn('flex items-center gap-2 border-b border-border pb-1', i > 0 && 'mt-3')}>
                          <span className="label-caps !text-graphite">{section || 'Sin sección'}</span>
                        </div>
                      )}
                      <ItemEditor
                        index={i}
                        total={fields.length}
                        control={control}
                        register={register}
                        errors={err}
                        readOnly={readOnly}
                        datalistId={datalistId}
                        onMove={(to) => move(i, to)}
                        onDuplicate={() => duplicate(i)}
                        onRemove={() => remove(i)}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
            {!readOnly && fields.length > 0 && (
              <div className="mt-4">
                <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => append(newItem(items?.[items.length - 1]?.section))}>
                  Agregar actividad
                </Button>
              </div>
            )}
          </Panel>

          {!readOnly && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => navigate('/checklists')}>
                Cancelar
              </Button>
              <Button type="submit" loading={save.isPending}>
                {editing ? 'Guardar cambios' : 'Crear plantilla'}
              </Button>
            </div>
          )}
        </fieldset>

        <TechnicianPreview items={items ?? []} />
      </form>
    </>
  );
}

interface ItemEditorProps {
  index: number;
  total: number;
  control: Control<FormValues, unknown, FormData>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  readOnly: boolean;
  datalistId: string;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function ItemEditor({ index: i, total, control, register, errors, readOnly, datalistId, onMove, onDuplicate, onRemove }: ItemEditorProps) {
  const responseType = useWatch({ control, name: `items.${i}.responseType` });
  const evidenceRequired = useWatch({ control, name: `items.${i}.evidenceRequired` });
  const label = useWatch({ control, name: `items.${i}.label` });
  const e = errors.items?.[i];
  const n = num(i);
  const name = label?.trim() ? `${n} ${label.trim()}` : n;

  return (
    <div className="rounded border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-subtle px-3 py-1.5">
        <span className="text-sm font-semibold text-graphite">{n}</span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <IconButton size="sm" label={`Subir actividad ${name}`} disabled={i === 0} onClick={() => onMove(i - 1)}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton size="sm" label={`Bajar actividad ${name}`} disabled={i === total - 1} onClick={() => onMove(i + 1)}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton size="sm" label={`Duplicar actividad ${name}`} onClick={onDuplicate}>
              <Copy className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton size="sm" label={`Eliminar actividad ${name}`} className="text-danger" onClick={onRemove}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
        )}
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <FormField label="Sección" error={e?.section?.message}>
          <Input list={datalistId} autoComplete="off" placeholder="Ej.: Inspección visual" {...register(`items.${i}.section`)} />
        </FormField>
        <FormField label="Actividad" required error={e?.label?.message}>
          <Input placeholder="Ej.: Verificar torque de conexiones" {...register(`items.${i}.label`)} />
        </FormField>
        <FormField label="Instrucción para el técnico" error={e?.description?.message} className="md:col-span-2">
          <Input placeholder="Opcional. Criterio de aceptación o indicación breve." {...register(`items.${i}.description`)} />
        </FormField>
        <FormField label="Tipo de respuesta" error={e?.responseType?.message}>
          <Select {...register(`items.${i}.responseType`)}>
            {RESPONSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESPONSE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Checkbox label="Obligatoria" {...register(`items.${i}.required`)} />
          <Checkbox label="Requiere evidencia" {...register(`items.${i}.evidenceRequired`)} />
          <Checkbox label="Requiere observación" {...register(`items.${i}.observationRequired`)} />
        </div>

        {evidenceRequired && (
          <FormField label="Fotos mínimas" error={e?.minPhotos?.message} hint={`Entre 1 y ${MAX_PHOTOS_PER_ITEM}.`}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PHOTOS_PER_ITEM}
              className=""
              {...register(`items.${i}.minPhotos`, { setValueAs: toInt })}
            />
          </FormField>
        )}

        {responseType === ResponseType.NUMBER && (
          <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3', evidenceRequired ? '' : 'md:col-span-2')}>
            <FormField label="Unidad" error={e?.unit?.message}>
              <Input placeholder="Ej.: V, A, °C" {...register(`items.${i}.unit`)} />
            </FormField>
            <FormField label="Valor mínimo" error={e?.minValue?.message}>
              <Input type="number" step="any" inputMode="decimal" className="" {...register(`items.${i}.minValue`, { setValueAs: toNumberOrNull })} />
            </FormField>
            <FormField label="Valor máximo" error={e?.maxValue?.message}>
              <Input type="number" step="any" inputMode="decimal" className="" {...register(`items.${i}.maxValue`, { setValueAs: toNumberOrNull })} />
            </FormField>
          </div>
        )}

        {OPTION_TYPES.includes(responseType) && (
          <div className="md:col-span-2">
            <Controller
              control={control}
              name={`items.${i}.options`}
              render={({ field, fieldState }) => (
                <OptionsEditor
                  itemNumber={n}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  readOnly={readOnly}
                  error={fieldState.error?.message ?? (Array.isArray(e?.options) ? 'Las opciones no pueden estar vacías.' : undefined)}
                />
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({
  itemNumber,
  value,
  onChange,
  readOnly,
  error,
}: {
  itemNumber: string;
  value: string[];
  onChange: (v: string[]) => void;
  readOnly: boolean;
  error?: string;
}) {
  const errorId = useId();
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-text">
        Opciones de respuesta<span className="ml-0.5 text-danger" aria-hidden>*</span>
      </legend>
      {value.map((opt, j) => (
        <div key={j} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-xs text-text-muted">{String(j + 1).padStart(2, '0')}</span>
          <Input
            aria-label={`Opción ${j + 1} de la actividad ${itemNumber}`}
            value={opt}
            maxLength={80}
            onChange={(ev) => onChange(value.map((o, k) => (k === j ? ev.target.value : o)))}
          />
          {!readOnly && (
            <IconButton label={`Quitar opción ${j + 1}`} onClick={() => onChange(value.filter((_, k) => k !== j))}>
              <X className="h-4 w-4" aria-hidden />
            </IconButton>
          )}
        </div>
      ))}
      {!readOnly && (
        <div>
          <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...value, ''])}>
            Agregar opción
          </Button>
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function TechnicianPreview({ items }: { items: Partial<ItemValues>[] }) {
  const groups: { section: string; entries: { n: string; item: Partial<ItemValues> }[] }[] = [];
  items.forEach((item, i) => {
    const section = sectionOf(item?.section);
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.entries.push({ n: num(i), item });
    else groups.push({ section, entries: [{ n: num(i), item }] });
  });

  return (
    <aside aria-label="Vista del técnico" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
      <Panel title="Vista del técnico" as="div" flush>
        {items.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">Sin actividades.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {groups.map((g, gi) => (
              <section key={gi} className="border-b border-border last:border-b-0">
                <h3 className="bg-subtle px-4 py-1.5 text-2xs font-semibold uppercase tracking-[0.05em] text-graphite">{g.section || 'Sin sección'}</h3>
                <ul>
                  {g.entries.map(({ n, item }) => {
                    const type = item?.responseType;
                    const photos = Math.max(1, Number(item?.minPhotos) || 0);
                    return (
                      <li key={n} className="flex gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
                        <span className="pt-0.5 text-xs text-text-muted">{n}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('break-words text-sm', item?.label?.trim() ? 'text-text' : 'italic text-text-muted')}>
                            {item?.label?.trim() || 'Actividad sin nombre'}
                          </p>
                          {item?.description?.trim() && <p className="mt-0.5 break-words text-xs text-text-muted">{item.description}</p>}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {type && (
                              <Tag>
                                {RESPONSE_TYPE_LABELS[type]}
                                {type === ResponseType.NUMBER && item?.unit?.trim() ? ` · ${item.unit.trim()}` : ''}
                              </Tag>
                            )}
                            {item?.required && <Tag tone="warning">Obligatorio</Tag>}
                            {item?.evidenceRequired && <Tag tone="info">Evidencia ({photos} {photos === 1 ? 'foto' : 'fotos'})</Tag>}
                            {item?.observationRequired && <Tag tone="info">Observación</Tag>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </aside>
  );
}
