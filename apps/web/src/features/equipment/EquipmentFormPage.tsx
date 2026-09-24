import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { equipmentSchema, type EquipmentInput, type UpdateEquipmentInput } from '@meca/shared';
import type { z } from 'zod';
import { clientsApi, equipmentApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { applyServerErrors } from '@/lib/forms/useApiForm';
import { nitWithDv } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, FormField, Input, KeyValue, PageHeader, Panel, Select, Spinner, Textarea, useToast } from '@/ui';

type FormValues = z.input<typeof equipmentSchema>;

/** En edición el cliente no cambia: se envía todo menos clientId. */
function toUpdate(data: EquipmentInput): UpdateEquipmentInput {
  const { code, name, category, brand, model, serial, location, description, specifications, notes } = data;
  return { code, name, category, brand, model, serial, location, description, specifications, notes };
}

export function EquipmentFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get('clientId') ?? '';
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Editar equipo' : 'Nuevo equipo');
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const existing = useQuery({ queryKey: ['equipment-item', id], queryFn: () => equipmentApi.get(id as string), enabled: editing });
  const clients = useQuery({
    queryKey: ['clients', { active: 'true', pageSize: 100 }],
    queryFn: () => clientsApi.list({ active: 'true', pageSize: 100 }),
    enabled: !editing,
  });

  const form = useForm<FormValues, unknown, EquipmentInput>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { clientId: presetClientId },
  });
  const { register, handleSubmit, formState, reset, setError, setValue } = form;

  useEffect(() => {
    if (existing.data) reset(existing.data);
  }, [existing.data, reset]);

  // Las opciones del selector llegan después del primer render: se reaplica la preselección.
  useEffect(() => {
    if (!editing && clients.data && presetClientId) setValue('clientId', presetClientId);
  }, [editing, clients.data, presetClientId, setValue]);

  const save = useMutation({
    mutationFn: (data: EquipmentInput) => (editing ? equipmentApi.update(id as string, toUpdate(data)) : equipmentApi.create(data)),
    onSuccess: (e) => {
      void qc.invalidateQueries({ queryKey: ['equipment'] });
      void qc.invalidateQueries({ queryKey: ['equipment-item', e.id] });
      void qc.invalidateQueries({ queryKey: ['client', e.clientId] });
      toast.success(editing ? 'Equipo actualizado correctamente.' : 'Equipo registrado correctamente.');
      navigate(`/equipment/${e.id}`);
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });

  if (editing && existing.isLoading) return <Spinner />;
  if (editing && (existing.error || !existing.data)) return <Alert tone="danger">{errorMessage(existing.error)}</Alert>;
  const err = formState.errors;
  const current = existing.data;

  return (
    <>
      <PageHeader
        title={editing ? 'Editar equipo' : 'Nuevo equipo'}
        breadcrumb={[
          { label: 'Equipos', to: '/equipment' },
          ...(current ? [{ label: current.code, to: `/equipment/${current.id}` }] : []),
          { label: editing ? 'Editar' : 'Nuevo' },
        ]}
      />
      <form onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Identificación">
            <div className="grid gap-4 md:grid-cols-2">
              {editing ? (
                <div className="md:col-span-2">
                  <KeyValue
                    columns={1}
                    items={[
                      {
                        label: 'Cliente (no editable)',
                        value: current?.client ? `${current.client.legalName} · NIT ${nitWithDv(current.client.nit, current.client.dv)}` : null,
                      },
                    ]}
                  />
                </div>
              ) : (
                <FormField
                  label="Cliente"
                  required
                  error={err.clientId?.message}
                  className="md:col-span-2"
                  hint={clients.isError ? 'No fue posible cargar los clientes.' : 'Solo se listan clientes activos.'}
                >
                  <Select {...register('clientId')} disabled={clients.isLoading}>
                    <option value="">{clients.isLoading ? 'Cargando clientes…' : 'Seleccione el cliente'}</option>
                    {clients.data?.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legalName} · NIT {nitWithDv(c.nit, c.dv)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormField label="Código interno" required error={err.code?.message} hint="Se guarda en mayúsculas. Ej.: TAB-001">
                <Input className="uppercase" autoFocus={!editing && Boolean(presetClientId)} {...register('code')} />
              </FormField>
              <FormField label="Nombre del equipo" required error={err.name?.message}>
                <Input {...register('name')} placeholder="Ej.: Tablero general de baja tensión" />
              </FormField>
              <FormField label="Categoría" error={err.category?.message}>
                <Input {...register('category')} placeholder="Ej.: Tablero eléctrico" />
              </FormField>
              <FormField label="Ubicación" error={err.location?.message}>
                <Input {...register('location')} placeholder="Planta, área o cuarto técnico" />
              </FormField>
            </div>
          </Panel>
          <Panel title="Datos técnicos">
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Marca" error={err.brand?.message}>
                <Input {...register('brand')} />
              </FormField>
              <FormField label="Modelo" error={err.model?.message}>
                <Input {...register('model')} />
              </FormField>
              <FormField label="Serial" error={err.serial?.message}>
                <Input className="" {...register('serial')} />
              </FormField>
              <FormField label="Descripción" error={err.description?.message} className="md:col-span-3">
                <Textarea rows={3} {...register('description')} />
              </FormField>
              <FormField
                label="Especificaciones técnicas"
                error={err.specifications?.message}
                hint="Tensión, corriente, potencia, capacidad u otros datos de placa."
                className="md:col-span-3"
              >
                <Textarea rows={5} className="text-sm" {...register('specifications')} />
              </FormField>
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Observaciones">
            <FormField label="Observaciones internas" hideLabel error={err.notes?.message}>
              <Textarea rows={6} {...register('notes')} placeholder="Condiciones de acceso, riesgos, restricciones de operación." />
            </FormField>
          </Panel>
          <div className="flex gap-2 lg:flex-col">
            <Button type="submit" loading={save.isPending} block>
              {editing ? 'Guardar cambios' : 'Registrar equipo'}
            </Button>
            <Button variant="secondary" block onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
