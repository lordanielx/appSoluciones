import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  createUserSchema,
  PASSWORD_MIN_LENGTH,
  Permission,
  Role,
  ROLE_LABELS,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserDto,
} from '@meca/shared';
import type { z } from 'zod';
import { usersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { applyServerErrors } from '@/lib/forms/useApiForm';
import { fmtDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  Select,
  Tag,
  useToast,
  type Column,
} from '@/ui';

const PAGE_SIZE = 20;
const ROLES = Object.values(Role);
const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, combinando letras y números.`;
/** Campo vacío = no cambiar la contraseña. */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

type CreateValues = z.input<typeof createUserSchema>;
type UpdateValues = z.input<typeof updateUserSchema>;

function RoleSelectOptions() {
  return (
    <>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const form = useForm<CreateValues, unknown, CreateUserInput>({ resolver: zodResolver(createUserSchema) });
  const { register, handleSubmit, formState, reset, setError } = form;

  useEffect(() => {
    if (open) reset({ fullName: '', email: '', role: Role.TECHNICIAN, phone: '', jobTitle: '', password: '' });
  }, [open, reset]);

  const save = useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado correctamente.');
      onClose();
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });
  const err = formState.errors;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Nuevo usuario"
      description="El usuario ingresa con su correo y la contraseña inicial asignada."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="create-user-form" loading={save.isPending}>
            Crear usuario
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="grid gap-4 md:grid-cols-2">
        <FormField label="Nombre completo" required error={err.fullName?.message} className="md:col-span-2">
          <Input autoComplete="off" autoFocus {...register('fullName')} />
        </FormField>
        <FormField label="Correo" required error={err.email?.message} className="md:col-span-2">
          <Input type="email" autoComplete="off" {...register('email')} />
        </FormField>
        <FormField label="Rol" required error={err.role?.message}>
          <Select {...register('role')}>
            <RoleSelectOptions />
          </Select>
        </FormField>
        <FormField label="Cargo" error={err.jobTitle?.message}>
          <Input {...register('jobTitle')} placeholder="Ej.: Técnico electricista" />
        </FormField>
        <FormField label="Teléfono" error={err.phone?.message}>
          <Input type="tel" {...register('phone')} />
        </FormField>
        <FormField label="Contraseña inicial" required error={err.password?.message} hint={PASSWORD_HINT}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, isSelf }: { user: UserDto | null; onClose: () => void; isSelf: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const form = useForm<UpdateValues, unknown, UpdateUserInput>({ resolver: zodResolver(updateUserSchema) });
  const { register, handleSubmit, formState, reset, setError } = form;

  useEffect(() => {
    if (user) reset({ fullName: user.fullName, role: user.role, phone: user.phone ?? '', jobTitle: user.jobTitle ?? '', password: undefined });
  }, [user, reset]);

  const save = useMutation({
    mutationFn: (data: UpdateUserInput) => usersApi.update(user?.id as string, data),
    onSuccess: (_u, data) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(data.password ? 'Usuario actualizado. La nueva contraseña ya está vigente.' : 'Usuario actualizado correctamente.');
      onClose();
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });
  const err = formState.errors;

  return (
    <Modal
      open={Boolean(user)}
      onOpenChange={(o) => !o && onClose()}
      title="Editar usuario"
      description={user ? <span className="">{user.email}</span> : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-user-form" loading={save.isPending}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="grid gap-4 md:grid-cols-2">
        <FormField label="Nombre completo" required error={err.fullName?.message} className="md:col-span-2">
          <Input {...register('fullName')} />
        </FormField>
        <FormField label="Rol" required error={err.role?.message} hint={isSelf ? 'No puede cambiar su propio rol.' : undefined}>
          <Select {...register('role')} disabled={isSelf}>
            <RoleSelectOptions />
          </Select>
        </FormField>
        <FormField label="Cargo" error={err.jobTitle?.message}>
          <Input {...register('jobTitle')} />
        </FormField>
        <FormField label="Teléfono" error={err.phone?.message}>
          <Input type="tel" {...register('phone')} />
        </FormField>
        <FormField label="Nueva contraseña" error={err.password?.message} hint={`Déjela vacía para conservar la actual. ${PASSWORD_HINT}`}>
          <Input type="password" autoComplete="new-password" {...register('password', { setValueAs: emptyToUndefined })} />
        </FormField>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  useDocumentTitle('Usuarios');
  const { can, user: me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canManage = can(Permission.USERS_MANAGE);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [active, setActive] = useState<'true' | 'false' | ''>('true');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);

  const query = useQuery({
    queryKey: ['users', { q, role, active, page }],
    queryFn: () => usersApi.list({ q, role: role || undefined, active: active || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const status = useMutation({
    mutationFn: (u: UserDto) => usersApi.setStatus(u.id, !u.active),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(u.active ? `${u.fullName} puede ingresar nuevamente.` : `${u.fullName} fue desactivado. Sus registros se conservan.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const actions = (u: UserDto) =>
    canManage && (
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>
          Editar
        </Button>
        {u.id !== me?.id && (
          <Button size="sm" variant={u.active ? 'danger' : 'secondary'} loading={status.isPending && status.variables?.id === u.id} onClick={() => status.mutate(u)}>
            {u.active ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      </div>
    );

  const columns: Column<UserDto>[] = [
    {
      key: 'name',
      header: 'Nombre',
      cell: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">
            {u.fullName}
            {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-text-muted">(usted)</span>}
          </p>
          <p className="truncate text-xs text-text-muted">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', cell: (u) => ROLE_LABELS[u.role] },
    { key: 'job', header: 'Cargo', cell: (u) => u.jobTitle ?? '—', hideBelow: 'lg' },
    { key: 'phone', header: 'Teléfono', cell: (u) => u.phone ?? '—', hideBelow: 'xl' },
    { key: 'login', header: 'Último ingreso', cell: (u) => <span className="tabular text-text-muted">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Nunca'}</span>, hideBelow: 'lg' },
    { key: 'status', header: 'Estado', cell: (u) => (u.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>) },
    ...(canManage ? [{ key: 'actions', header: 'Acciones', cell: actions, align: 'right' as const }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas de acceso, roles y estado."
        actions={
          canManage && (
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Nuevo usuario
            </Button>
          )
        }
      />
      <Panel flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre o correo" className="flex-1" />
          <div className="grid grid-cols-2 gap-2 md:flex">
            <div className="md:w-44">
              <Select aria-label="Filtrar por rol" value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1); }}>
                <option value="">Todos los roles</option>
                <RoleSelectOptions />
              </Select>
            </div>
            <div className="md:w-36">
              <Select aria-label="Filtrar por estado" value={active} onChange={(e) => { setActive(e.target.value as typeof active); setPage(1); }}>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
                <option value="">Todos</option>
              </Select>
            </div>
          </div>
        </div>
        <DataTable
          caption="Listado de usuarios"
          columns={columns}
          rows={query.data?.items}
          loading={query.isLoading}
          rowKey={(u) => u.id}
          mobileCard={(u) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.fullName}
                    {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-text-muted">(usted)</span>}
                  </p>
                  <p className="truncate text-xs text-text-muted">{u.email}</p>
                  <p className="text-xs text-text-muted">
                    {ROLE_LABELS[u.role]}
                    {u.jobTitle ? ` · ${u.jobTitle}` : ''}
                  </p>
                  <p className="text-xs text-text-muted">Último ingreso: {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Nunca'}</p>
                </div>
                {u.active ? <Tag tone="success">Activo</Tag> : <Tag>Inactivo</Tag>}
              </div>
              {actions(u)}
            </div>
          )}
          empty={<EmptyState title="No hay usuarios con ese criterio" description="Ajuste la búsqueda o los filtros." />}
        />
        {query.data && query.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={setPage} />}
      </Panel>
      {canManage && (
        <>
          <CreateUserModal open={creating} onClose={() => setCreating(false)} />
          <EditUserModal user={editing} isSelf={editing?.id === me?.id} onClose={() => setEditing(null)} />
        </>
      )}
    </>
  );
}
