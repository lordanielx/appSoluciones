import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { clientSchema, type ClientInput } from '@meca/shared';
import type { z } from 'zod';
import { clientsApi } from '@/lib/api/endpoints';
import { applyServerErrors } from '@/lib/forms/useApiForm';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, FormField, Input, PageHeader, Panel, Spinner, Textarea, useToast } from '@/ui';

type FormValues = z.input<typeof clientSchema>;

export function ClientFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Editar cliente' : 'Nuevo cliente');
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ['client', id], queryFn: () => clientsApi.get(id as string), enabled: editing });
  const form = useForm<FormValues, unknown, ClientInput>({ resolver: zodResolver(clientSchema) });
  const { register, handleSubmit, formState, reset, setError } = form;

  useEffect(() => {
    if (existing.data) reset(existing.data);
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (data: ClientInput) => (editing ? clientsApi.update(id as string, data) : clientsApi.create(data)),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['client', c.id] });
      toast.success(editing ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.');
      navigate(`/clients/${c.id}`);
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });

  if (editing && existing.isLoading) return <Spinner />;
  const err = formState.errors;

  return (
    <>
      <PageHeader
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        breadcrumb={[{ label: 'Clientes', to: '/clients' }, { label: editing ? existing.data?.legalName ?? 'Cliente' : 'Nuevo' }]}
      />
      <form onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel title="Identificación">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Razón social" required error={err.legalName?.message} className="md:col-span-2">
                <Input {...register('legalName')} autoFocus={!editing} />
              </FormField>
              <FormField label="Nombre comercial" error={err.tradeName?.message}>
                <Input {...register('tradeName')} />
              </FormField>
              <div className="grid grid-cols-[1fr_72px] gap-2">
                <FormField label="NIT" required error={err.nit?.message} hint="Sin dígito de verificación">
                  <Input inputMode="numeric" className="" {...register('nit')} />
                </FormField>
                <FormField label="DV" error={err.dv?.message}>
                  <Input inputMode="numeric" maxLength={1} className="" {...register('dv')} />
                </FormField>
              </div>
            </div>
          </Panel>
          <Panel title="Contacto y ubicación">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Contacto principal" error={err.contactName?.message}>
                <Input {...register('contactName')} />
              </FormField>
              <FormField label="Teléfono" error={err.phone?.message}>
                <Input type="tel" {...register('phone')} />
              </FormField>
              <FormField label="Correo" error={err.email?.message} className="md:col-span-2">
                <Input type="email" {...register('email')} />
              </FormField>
              <FormField label="Dirección" error={err.address?.message} className="md:col-span-2">
                <Input {...register('address')} />
              </FormField>
              <FormField label="Ciudad" error={err.city?.message}>
                <Input {...register('city')} />
              </FormField>
              <FormField label="Departamento" error={err.department?.message}>
                <Input {...register('department')} />
              </FormField>
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Observaciones">
            <FormField label="Observaciones internas" hideLabel error={err.notes?.message}>
              <Textarea rows={6} {...register('notes')} placeholder="Horarios de acceso, requisitos de seguridad, etc." />
            </FormField>
          </Panel>
          <div className="flex gap-2 lg:flex-col">
            <Button type="submit" loading={save.isPending} block>
              {editing ? 'Guardar cambios' : 'Registrar cliente'}
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
