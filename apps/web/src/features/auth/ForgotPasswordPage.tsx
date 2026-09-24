import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@meca/shared';
import { authApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useDocumentTitle } from '@/lib/hooks';
import { Alert, Button, FormField, Input } from '@/ui';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      const res = await authApi.forgotPassword(data.email);
      setSent(res.message);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Le enviaremos un enlace para definir una nueva contraseña.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success" title="Solicitud registrada">{sent}</Alert>
          <Link to="/login" className="text-sm text-electric hover:underline">Volver a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <FormField label="Correo electrónico" error={formState.errors.email?.message}>
            <Input type="email" autoComplete="username" touch {...register('email')} />
          </FormField>
          <Button type="submit" size="lg" block loading={formState.isSubmitting}>Enviar enlace</Button>
          <Link to="/login" className="text-sm text-electric hover:underline">Volver a iniciar sesión</Link>
        </form>
      )}
    </AuthShell>
  );
}
