import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {c.to ? (
              <Link to={c.to} className="hover:text-text hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: Crumb[];
  meta?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, breadcrumb, meta }: PageHeaderProps) {
  return (
    <header className="mb-6 border-b border-border pb-4">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-text lg:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-3">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Sin padding interno (tablas a borde). */
  flush?: boolean;
  as?: 'section' | 'div' | 'aside';
}

/** Contenedor base: borde de 1px, radio 5px, sin sombras decorativas. */
export function Panel({ title, actions, children, className, bodyClassName, flush, as: Tag = 'section' }: PanelProps) {
  return (
    <Tag className={cn('rounded border border-border bg-surface', className)}>
      {(title || actions) && (
        <header className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border px-4 py-2">
          {typeof title === 'string' ? <h2 className="label-caps !text-graphite">{title}</h2> : title}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4', bodyClassName)}>{children}</div>
    </Tag>
  );
}

export const Card = Panel;

/** Lista de pares etiqueta/valor (fichas técnicas). */
export function KeyValue({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5 border-b border-dashed border-border py-2 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
          <dt className="text-xs text-text-muted">{it.label}</dt>
          <dd className="min-w-0 break-words text-base font-medium text-text">{it.value ?? <span className="text-text-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
