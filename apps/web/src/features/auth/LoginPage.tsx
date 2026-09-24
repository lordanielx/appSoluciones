import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Role, loginSchema, type LoginInput } from '@meca/shared';
import { useAuth } from '@/lib/auth/AuthProvider';
import { errorMessage } from '@/lib/api/errors';
import { useDocumentTitle, useOnline } from '@/lib/hooks';
import { Alert, Button, FormField, Input } from '@/ui';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  useDocumentTitle('Iniciar sesión');
  const { login, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  if (status === 'authenticated' && user) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      const u = await login(data.email, data.password);
      const from = (location.state as { from?: string } | null)?.from;
      const home = u.role === Role.TECHNICIAN ? '/mobile/home' : '/dashboard';
      navigate(from && from.startsWith(u.role === Role.TECHNICIAN ? '/mobile' : '/') && from !== '/login' ? from : home, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingrese con su correo corporativo.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {!online && <Alert tone="warning" title="Sin conexión">Se requiere conexión para iniciar sesión por primera vez en este dispositivo.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="Correo electrónico" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="username" inputMode="email" touch {...register('email')} />
        </FormField>
        <FormField label="Contraseña" error={formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" touch {...register('password')} />
        </FormField>
        <Button type="submit" variant="accent" size="lg" block loading={formState.isSubmitting}>
          INGRESAR
        </Button>
        <Link to="/forgot-password" className="text-sm text-electric hover:underline">
          ¿Olvidó su contraseña?
        </Link>
      </form>
    </AuthShell>
  );
}
