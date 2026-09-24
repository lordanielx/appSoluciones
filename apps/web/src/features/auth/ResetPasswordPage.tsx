import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, passwordSchema } from '@meca/shared';
import { authApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, FormField, Input } from '@/ui';
import { AuthShell } from './AuthShell';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden.' });
type Form = z.infer<typeof schema>;

export function ResetPasswordPage() {
  useDocumentTitle('Nueva contraseña');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      await authApi.resetPassword(token, data.password);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthShell title="Definir nueva contraseña" subtitle={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, combinando letras y números.`}>
      {!token ? (
        <Alert tone="danger" title="Enlace incompleto">Abra el enlace completo que recibió por correo o solicite uno nuevo.</Alert>
      ) : done ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success" title="Contraseña actualizada">Ya puede iniciar sesión con su nueva contraseña.</Alert>
          <Link to="/login" className="text-sm text-electric hover:underline">Ir a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <Alert tone="danger">
              {error} <Link to="/forgot-password" className="underline">Solicitar nuevo enlace</Link>
            </Alert>
          )}
          <FormField label="Nueva contraseña" error={formState.errors.password?.message}>
            <Input type="password" autoComplete="new-password" touch {...register('password')} />
          </FormField>
          <FormField label="Confirmar contraseña" error={formState.errors.confirm?.message}>
            <Input type="password" autoComplete="new-password" touch {...register('confirm')} />
          </FormField>
          <Button type="submit" size="lg" block loading={formState.isSubmitting}>Guardar contraseña</Button>
        </form>
      )}
    </AuthShell>
  );
}
