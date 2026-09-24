import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { SkeletonRows } from './Feedback';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Ocultar en pantallas medianas para priorizar columnas clave. */
  hideBelow?: 'lg' | 'xl';
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Tarjeta compacta para móvil (listados §43). */
  mobileCard?: (row: T) => ReactNode;
  caption?: string;
}

/** Tabla en escritorio / tarjetas compactas en móvil. Filas navegables con teclado. */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, onRowClick, mobileCard, caption }: DataTableProps<T>) {
  if (loading && !rows) return <SkeletonRows rows={6} />;
  if (rows && rows.length === 0) return <div className="p-4">{empty}</div>;
  const hide = (c: Column<T>) => (c.hideBelow === 'lg' ? 'hidden lg:table-cell' : c.hideBelow === 'xl' ? 'hidden xl:table-cell' : '');
  return (
    <>
      {mobileCard && (
        <ul className="divide-y divide-border md:hidden">
          {rows?.map((row) => (
            <li key={rowKey(row)}>
              {onRowClick ? (
                <button type="button" onClick={() => onRowClick(row)} className="block w-full px-4 py-3 text-left hover:bg-subtle">
                  {mobileCard(row)}
                </button>
              ) : (
                <div className="px-4 py-3">{mobileCard(row)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={cn('overflow-x-auto', mobileCard && 'hidden md:block')}>
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border bg-subtle/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('h-9 px-4 text-left text-2xs font-semibold uppercase tracking-[0.07em] text-text-muted', c.align === 'right' && 'text-right', hide(c), c.className)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(row)) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn('border-b border-border last:border-b-0', onRowClick && 'cursor-pointer hover:bg-subtle/70 focus-visible:bg-subtle')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('h-12 px-4 py-2 align-middle', c.align === 'right' && 'text-right', hide(c), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm text-text-muted">
      <span className="tabular">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} icon={<ChevronLeft className="h-4 w-4" />} aria-label="Página anterior" />
        <span className="tabular px-2 text-text">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page >= pages} icon={<ChevronRight className="h-4 w-4" />} aria-label="Página siguiente" />
      </div>
    </div>
  );
}
