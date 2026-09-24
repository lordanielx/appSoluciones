import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Role, type Permission } from '@meca/shared';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Spinner, EmptyState } from '@/ui';

export function RequireAuth({ children, area }: { children: ReactNode; area: 'admin' | 'mobile' }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoading />;
  if (status === 'anonymous' || !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const isTech = user.role === Role.TECHNICIAN;
  if (area === 'admin' && isTech) return <Navigate to="/mobile/home" replace />;
  if (area === 'mobile' && !isTech) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Oculta secciones sin permiso. La API vuelve a validar siempre (esto es solo UX). */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return <EmptyState title="Sin acceso" description="Su rol no tiene permiso para ver esta sección. Contacte al administrador si lo necesita." />;
  }
  return <>{children}</>;
}

export function HomeRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === Role.TECHNICIAN ? '/mobile/home' : '/dashboard'} replace />;
}

export function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Spinner label="Cargando Mecaelectric Operaciones…" />
    </div>
  );
}
