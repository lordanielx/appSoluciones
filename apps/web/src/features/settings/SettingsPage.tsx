import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Permission, serviceTypeSchema, type ServiceTypeDto, type ServiceTypeInput } from '@meca/shared';
import type { z } from 'zod';
import { serviceTypesApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { applyServerErrors } from '@/lib/forms/useApiForm';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, Checkbox, DataTable, EmptyState, FormField, Input, Modal, PageHeader, Panel, Tag, Textarea, useToast, type Column } from '@/ui';

type FormValues = z.input<typeof serviceTypeSchema>;
const QUERY_KEY = ['service-types'] as const;

function ServiceTypeModal({ open, serviceType, onClose }: { open: boolean; serviceType: ServiceTypeDto | null; onClose: () => void }) {
  const editing = Boolean(serviceType);
  const toast = useToast();
  const qc = useQueryClient();
  const form = useForm<FormValues, unknown, ServiceTypeInput>({ resolver: zodResolver(serviceTypeSchema) });
  const { register, handleSubmit, formState, reset, setError } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      serviceType
        ? { code: serviceType.code, name: serviceType.name, description: serviceType.description ?? '', requiresEquipment: serviceType.requiresEquipment }
        : { code: '', name: '', description: '', requiresEquipment: true },
    );
  }, [open, serviceType, reset]);

  const save = useMutation({
    mutationFn: (data: ServiceTypeInput) => (serviceType ? serviceTypesApi.update(serviceType.id, data) : serviceTypesApi.create(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(editing ? 'Tipo de servicio actualizado correctamente.' : 'Tipo de servicio registrado correctamente.');
      onClose();
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });
  const err = formState.errors;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? 'Editar tipo de servicio' : 'Nuevo tipo de servicio'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="service-type-form" loading={save.isPending}>
            {editing ? 'Guardar cambios' : 'Registrar tipo'}
          </Button>
        </>
      }
    >
      <form id="service-type-form" onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <FormField label="Código" required error={err.code?.message} hint="Ej.: MP, MC, INST">
          <Input className="font-mono uppercase" maxLength={20} autoFocus={!editing} {...register('code')} />
        </FormField>
        <FormField label="Nombre" required error={err.name?.message}>
          <Input {...register('name')} placeholder="Ej.: Mantenimiento preventivo" />
        </FormField>
        <FormField label="Descripción" error={err.description?.message} className="sm:col-span-2">
          <Textarea rows={3} {...register('description')} />
        </FormField>
        <div className="sm:col-span-2">
          <Checkbox
            label="Requiere equipo"
            description="Las órdenes de este tipo deben asociarse a un equipo del cliente."
            {...register('requiresEquipment')}
          />
        </div>
      </form>
    </Modal>
  );
}

export function SettingsPage() {
  useDocumentTitle('Tipos de servicio');
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canManage = can(Permission.SERVICE_TYPES_MANAGE);
  const [modal, setModal] = useState<{ open: boolean; serviceType: ServiceTypeDto | null }>({ open: false, serviceType: null });
  const list = useQuery({ queryKey: QUERY_KEY, queryFn: () => serviceTypesApi.list() });

  const toggle = useMutation({
    mutationFn: (s: ServiceTypeDto) => serviceTypesApi.update(s.id, { active: !s.active }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(s.active ? 'Tipo de servicio activado.' : 'Tipo de servicio desactivado. Las órdenes existentes no cambian.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const actions = (s: ServiceTypeDto) =>
    canManage && (
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, serviceType: s })}>
          Editar
        </Button>
        <Button size="sm" variant="secondary" loading={toggle.isPending && toggle.variables?.id === s.id} onClick={() => toggle.mutate(s)}>
          {s.active ? 'Desactivar' : 'Activar'}
        </Button>
      </div>
    );

  const columns: Column<ServiceTypeDto>[] = [
    { key: 'code', header: 'Código', cell: (s) => <span className="code">{s.code}</span> },
    {
      key: 'name',
      header: 'Nombre',
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-medium text-text">{s.name}</p>
          {s.description && <p className="line-clamp-1 text-xs text-text-muted">{s.description}</p>}
        </div>
      ),
    },
    { key: 'eq', header: 'Equipo', cell: (s) => (s.requiresEquipment ? 'Requerido' : 'Opcional'), hideBelow: 'lg' },
    { key: 'status', header: 'Estado', cell: (s) => (s.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>) },
    ...(canManage ? [{ key: 'actions', header: 'Acciones', cell: actions, align: 'right' as const }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Tipos de servicio"
        subtitle="Clasificación de las órdenes de trabajo y de las plantillas de checklist."
        actions={
          canManage && (
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ open: true, serviceType: null })}>
              Nuevo tipo
            </Button>
          )
        }
      />
      {list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : (
        <Panel flush>
          <DataTable
            caption="Tipos de servicio"
            columns={columns}
            rows={list.data}
            loading={list.isLoading}
            rowKey={(s) => s.id}
            mobileCard={(s) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="code">{s.code}</p>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-text-muted">Equipo {s.requiresEquipment ? 'requerido' : 'opcional'}</p>
                  </div>
                  {s.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>}
                </div>
                {actions(s)}
              </div>
            )}
            empty={<EmptyState title="No hay tipos de servicio" description="Registre los tipos de servicio que presta la empresa." />}
          />
        </Panel>
      )}
      {canManage && (
        <ServiceTypeModal open={modal.open} serviceType={modal.serviceType} onClose={() => setModal((m) => ({ ...m, open: false }))} />
      )}
    </>
  );
}
