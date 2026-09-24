import { useEffect, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Upload } from 'lucide-react';
import { brandProfileSchema, Permission, type BrandProfileDto, type BrandProfileInput } from '@meca/shared';
import type { z } from 'zod';
import { brandsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { applyServerErrors } from '@/lib/forms/useApiForm';
import { fmtDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, EmptyState, FormField, Input, KeyValue, Modal, PageHeader, Panel, Spinner, Tag, Textarea, useToast } from '@/ui';

type FormValues = z.input<typeof brandProfileSchema>;

const QUERY_KEY = ['brand-profiles'] as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_PRIMARY = '#0B1F33';
const DEFAULT_SECONDARY = '#E85D04';
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const safeColor = (v: string | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);

interface PreviewProps {
  name?: string;
  legalName?: string;
  nit?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  contact?: string;
}

/** Réplica simplificada del encabezado del informe PDF: la marca define logo, datos y colores. */
function ReportHeaderPreview({ name, legalName, nit, logoUrl, primaryColor, secondaryColor, contact }: PreviewProps) {
  const primary = safeColor(primaryColor, DEFAULT_PRIMARY);
  const secondary = safeColor(secondaryColor, DEFAULT_SECONDARY);
  return (
    <figure className="m-0">
      <figcaption className="label-caps mb-1.5">Vista previa del encabezado del informe</figcaption>
      <div className="rounded-sm border border-border bg-white">
        <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: `3px solid ${primary}` }}>
          <div className="flex h-10 w-20 shrink-0 items-center justify-center overflow-hidden border border-dashed border-border sm:w-24">
            {logoUrl ? (
              <img src={logoUrl} alt={`Logo de ${name ?? 'la marca'}`} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-2xs uppercase tracking-[0.05em] text-text-muted">Sin logo</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: primary }}>
              {name || 'Nombre de la marca'}
            </p>
            <p className="truncate text-2xs text-[#44505C]">
              {legalName || 'Razón social'}
              {nit ? ` · NIT ${nit}` : ''}
            </p>
            {contact && <p className="truncate text-2xs text-[#44505C]">{contact}</p>}
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-2xs font-semibold uppercase tracking-[0.06em]" style={{ color: primary }}>
              Informe de servicio
            </p>
            <p className="text-2xs text-[#44505C]">OT-0000</p>
          </div>
        </div>
        <div className="h-1 w-16" style={{ backgroundColor: secondary }} aria-hidden />
      </div>
    </figure>
  );
}

function ColorField({
  label,
  value,
  error,
  onChange,
  inputProps,
}: {
  label: string;
  value: string | undefined;
  error?: string;
  onChange: (v: string) => void;
  inputProps: UseFormRegisterReturn;
}) {
  return (
    <div className="flex items-end gap-2">
      <input
        type="color"
        aria-label={`${label}: selector`}
        value={safeColor(value, '#000000').toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-10 w-12 shrink-0 cursor-pointer rounded border border-border-strong bg-surface p-1"
      />
      <FormField label={label} required error={error} hint="Formato #RRGGBB" className="min-w-0 flex-1">
        <Input className="uppercase" maxLength={7} {...inputProps} />
      </FormField>
    </div>
  );
}

function BrandFormModal({
  open,
  brand,
  onClose,
}: {
  open: boolean;
  brand: BrandProfileDto | null;
  onClose: () => void;
}) {
  const editing = Boolean(brand);
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(brand?.logoUrl ?? null);
  const form = useForm<FormValues, unknown, BrandProfileInput>({ resolver: zodResolver(brandProfileSchema) });
  const { register, handleSubmit, formState, reset, setError, setValue, watch } = form;

  useEffect(() => {
    if (!open) return;
    setLogoUrl(brand?.logoUrl ?? null);
    reset(
      brand ?? {
        name: '',
        legalName: '',
        nit: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        primaryColor: DEFAULT_PRIMARY,
        secondaryColor: DEFAULT_SECONDARY,
        footerText: '',
      },
    );
  }, [open, brand, reset]);

  const save = useMutation({
    mutationFn: (data: BrandProfileInput) => (brand ? brandsApi.update(brand.id, data) : brandsApi.create(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(editing ? 'Marca actualizada correctamente.' : 'Marca registrada correctamente. Ya puede cargar su logo.');
      onClose();
    },
    onError: (e) => toast.error(applyServerErrors(e, setError)),
  });

  const upload = useMutation({
    mutationFn: (file: File) => brandsApi.uploadLogo(brand?.id as string, file),
    onSuccess: (b) => {
      setLogoUrl(b.logoUrl);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Logo actualizado correctamente.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error('Formato no admitido. Use un logo PNG, JPG o WebP.');
      return;
    }
    upload.mutate(file);
  };

  const v = watch();
  const err = formState.errors;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={editing ? 'Editar marca' : 'Nueva marca'}
      description="Los datos y colores de la marca se usan en el encabezado y pie de los informes PDF."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="brand-form" loading={save.isPending}>
            {editing ? 'Guardar cambios' : 'Registrar marca'}
          </Button>
        </>
      }
    >
      <form id="brand-form" onSubmit={handleSubmit((d) => save.mutate(d))} noValidate className="flex flex-col gap-5">
        <ReportHeaderPreview
          name={v.name}
          legalName={v.legalName}
          nit={v.nit}
          logoUrl={logoUrl}
          primaryColor={v.primaryColor}
          secondaryColor={v.secondaryColor}
          contact={[v.phone, v.email].filter(Boolean).join(' · ')}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nombre de la marca" required error={err.name?.message}>
            <Input {...register('name')} autoFocus={!editing} />
          </FormField>
          <FormField label="NIT" required error={err.nit?.message} hint="Solo números, sin dígito de verificación">
            <Input inputMode="numeric" className="" {...register('nit')} />
          </FormField>
          <FormField label="Razón social" required error={err.legalName?.message} className="md:col-span-2">
            <Input {...register('legalName')} />
          </FormField>
          <FormField label="Dirección" error={err.address?.message} className="md:col-span-2">
            <Input {...register('address')} />
          </FormField>
          <FormField label="Teléfono" error={err.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </FormField>
          <FormField label="Correo" error={err.email?.message}>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Sitio web" error={err.website?.message} className="md:col-span-2">
            <Input type="url" placeholder="https://" {...register('website')} />
          </FormField>
          <ColorField
            label="Color principal"
            value={v.primaryColor}
            error={err.primaryColor?.message}
            onChange={(c) => setValue('primaryColor', c, { shouldDirty: true, shouldValidate: true })}
            inputProps={register('primaryColor')}
          />
          <ColorField
            label="Color secundario"
            value={v.secondaryColor}
            error={err.secondaryColor?.message}
            onChange={(c) => setValue('secondaryColor', c, { shouldDirty: true, shouldValidate: true })}
            inputProps={register('secondaryColor')}
          />
          <FormField label="Texto de pie de página" error={err.footerText?.message} className="md:col-span-2" hint="Aparece al final de cada página del informe.">
            <Textarea rows={2} {...register('footerText')} />
          </FormField>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-text">Logo</p>
            <p className="text-xs text-text-muted">
              {editing ? 'PNG con fondo transparente recomendado. Se normaliza a PNG.' : 'Podrá cargar el logo después de registrar la marca.'}
            </p>
          </div>
          {editing && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES.join(',')}
                className="sr-only"
                tabIndex={-1}
                aria-label="Seleccionar logo"
                onChange={(e) => onFile(e.target.files)}
              />
              <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                {logoUrl ? 'Reemplazar logo' : 'Cargar logo'}
              </Button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function BrandsPage() {
  useDocumentTitle('Marcas');
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canManage = can(Permission.BRANDS_MANAGE);
  const [modal, setModal] = useState<{ open: boolean; brand: BrandProfileDto | null }>({ open: false, brand: null });
  const brands = useQuery({ queryKey: QUERY_KEY, queryFn: () => brandsApi.list() });

  const toggle = useMutation({
    mutationFn: (b: BrandProfileDto) => brandsApi.update(b.id, { active: !b.active }),
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(b.active ? 'Marca activada.' : 'Marca desactivada. Los informes emitidos se conservan.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Marcas"
        subtitle="Empresas representadas: definen logo, datos legales y colores de los informes."
        actions={
          canManage && (
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ open: true, brand: null })}>
              Nueva marca
            </Button>
          )
        }
      />
      {brands.isLoading ? (
        <Spinner />
      ) : brands.error ? (
        <Alert tone="danger">{errorMessage(brands.error)}</Alert>
      ) : !brands.data?.length ? (
        <EmptyState title="No hay marcas registradas" description="Registre al menos una marca para emitir informes." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {brands.data.map((b) => (
            <Panel
              key={b.id}
              title={
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-md font-semibold text-text">{b.name}</h2>
                  {b.isDefault && <Tag tone="info">Principal</Tag>}
                  {b.active ? <Tag tone="success">Activa</Tag> : <Tag>Inactiva</Tag>}
                </div>
              }
              actions={
                canManage && (
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setModal({ open: true, brand: b })} aria-label={`Editar ${b.name}`}>
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                )
              }
            >
              <div className="flex flex-col gap-4">
                <ReportHeaderPreview
                  name={b.name}
                  legalName={b.legalName}
                  nit={b.nit}
                  logoUrl={b.logoUrl}
                  primaryColor={b.primaryColor}
                  secondaryColor={b.secondaryColor}
                  contact={[b.phone, b.email].filter(Boolean).join(' · ')}
                />
                <KeyValue
                  items={[
                    { label: 'Razón social', value: b.legalName },
                    { label: 'NIT', value: <span className="code">{b.nit}</span> },
                    {
                      label: 'Colores',
                      value: (
                        <span className="flex flex-wrap items-center gap-3">
                          {[b.primaryColor, b.secondaryColor].map((c, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5">
                              <span className="h-4 w-4 rounded-sm border border-border-strong" style={{ backgroundColor: c }} aria-hidden />
                              <span className="code">{c.toUpperCase()}</span>
                            </span>
                          ))}
                        </span>
                      ),
                    },
                    { label: 'Actualizada', value: fmtDateTime(b.updatedAt) },
                  ]}
                />
                {canManage && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                    {b.isDefault && b.active ? (
                      <p className="mr-auto text-xs text-text-muted">La marca principal no se puede desactivar.</p>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={b.isDefault && b.active}
                      loading={toggle.isPending && toggle.variables?.id === b.id}
                      onClick={() => toggle.mutate(b)}
                    >
                      {b.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {canManage && <BrandFormModal open={modal.open} brand={modal.brand} onClose={() => setModal((m) => ({ ...m, open: false }))} />}
    </>
  );
}
