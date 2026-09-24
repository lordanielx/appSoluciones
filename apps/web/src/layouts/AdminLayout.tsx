import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardCheck, ClipboardList, Cog, Factory, LayoutGrid, LogOut, Menu, Users, Wrench } from 'lucide-react';
import { Permission, ROLE_LABELS } from '@meca/shared';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { Drawer, IconButton, OfflineIndicator } from '@/ui';
import { BrandMark } from './Brand';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: Permission;
}

const ICON = 'h-4 w-4';
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operación',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutGrid className={ICON} />, permission: Permission.DASHBOARD_READ },
      { to: '/work-orders', label: 'Órdenes de trabajo', icon: <ClipboardList className={ICON} />, permission: Permission.WORK_ORDERS_READ_ALL },
      { to: '/clients', label: 'Clientes', icon: <Factory className={ICON} />, permission: Permission.CLIENTS_READ },
      { to: '/equipment', label: 'Equipos', icon: <Wrench className={ICON} />, permission: Permission.EQUIPMENT_READ },
    ],
  },
  {
    group: 'Configuración',
    items: [
      { to: '/checklists', label: 'Checklists', icon: <ClipboardCheck className={ICON} />, permission: Permission.CHECKLISTS_READ },
      { to: '/brands', label: 'Empresas', icon: <Building2 className={ICON} />, permission: Permission.BRANDS_MANAGE },
      { to: '/users', label: 'Usuarios', icon: <Users className={ICON} />, permission: Permission.USERS_MANAGE },
      { to: '/settings', label: 'Tipos de servicio', icon: <Cog className={ICON} />, permission: Permission.SERVICE_TYPES_MANAGE },
    ],
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { can, user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-primary text-white">
      <div className="flex h-14 items-center border-b border-white/10 px-4">
        <BrandMark inverse />
      </div>
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Navegación principal">
        {NAV.map((section) => {
          const items = section.items.filter((i) => !i.permission || can(i.permission));
          if (!items.length) return null;
          return (
            <div key={section.group} className="mb-4">
              <p className="px-4 pb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-white/45">{section.group}</p>
              <ul>
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'relative flex h-10 items-center gap-3 px-4 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white',
                          isActive && 'bg-white/[0.08] font-medium text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:bg-accent',
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium">{user?.fullName}</p>
        <p className="truncate text-xs text-white/55">{user ? ROLE_LABELS[user.role] : ''}</p>
        <button type="button" onClick={() => void logout()} className="mt-2 flex h-9 items-center gap-2 text-sm text-white/70 hover:text-white">
          <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/** Escritorio: sidebar izquierda fija. Tablet/móvil: barra superior con menú lateral. */
export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[var(--sidebar-w)_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <SidebarNav />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-primary px-3 lg:hidden">
          <IconButton label="Abrir menú" onClick={() => setOpen(true)} className="text-white hover:bg-white/10">
            <Menu className="h-5 w-5" />
          </IconButton>
          <BrandMark inverse />
        </header>
        <OfflineIndicator />
        <main key={location.pathname.split('/')[1]} className="mx-auto w-full max-w-content px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <DrawerNav open={open} onOpenChange={setOpen} />
    </div>
  );
}

function DrawerNav({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Menú">
      <div className="-mx-5 -my-4 h-[calc(100vh-57px)]">
        <SidebarNav onNavigate={() => onOpenChange(false)} />
      </div>
    </Drawer>
  );
}

