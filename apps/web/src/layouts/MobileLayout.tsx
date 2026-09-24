import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, ClipboardList, Home, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SyncIndicator } from '@/ui';
import { BrandMark } from './Brand';

const NAV = [
  { to: '/mobile/home', label: 'Inicio', icon: Home },
  { to: '/mobile/work-orders', label: 'Órdenes', icon: ClipboardList },
  { to: '/mobile/sync', label: 'Actividad', icon: Activity },
  { to: '/mobile/more', label: 'Más', icon: MoreHorizontal },
];

/** Experiencia del técnico: barra superior con estado de sincronización + navegación inferior (4 opciones). */
export function MobileLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-primary px-4 pt-[env(safe-area-inset-top)]">
        <BrandMark inverse sub="Técnico" />
        <SyncIndicator compact />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+16px)]">
        <Outlet />
      </main>
      <nav
        aria-label="Navegación"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid h-[var(--bottom-nav-h)] max-w-2xl grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-full flex-col items-center justify-center gap-1 text-2xs font-medium text-text-muted',
                    isActive && 'text-primary before:absolute before:inset-x-5 before:top-0 before:h-[3px] before:bg-accent',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Encabezado de pantalla interna del técnico con volver. */
export function MobileScreenHeader({ title, back, right, sub }: { title: ReactNode; back?: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="sticky top-14 z-20 border-b border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        {back}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-text">{title}</h1>
          {sub && <p className="truncate text-xs text-text-muted">{sub}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
