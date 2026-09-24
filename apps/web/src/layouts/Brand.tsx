import { cn } from '@/lib/cn';

/** Marca tipográfica sobria (sin ilustraciones): monograma + nombre. */
export function BrandMark({ inverse, className, sub = 'Operaciones' }: { inverse?: boolean; className?: string; sub?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 512 512" className="h-7 w-7 shrink-0" aria-hidden>
        <rect width="512" height="512" fill={inverse ? '#FFFFFF' : '#0B1F33'} />
        <path d="M112 360V152h52l92 118 92-118h52v208h-58V250l-86 108-86-108v110z" fill={inverse ? '#0B1F33' : '#FFFFFF'} />
        <rect x="112" y="384" width="288" height="22" fill="#E85D04" />
      </svg>
      <div className="leading-none">
        <span className={cn('block text-sm font-bold tracking-[0.14em]', inverse ? 'text-white' : 'text-primary')}>MECAELECTRIC</span>
        <span className={cn('block text-2xs uppercase tracking-[0.16em]', inverse ? 'text-white/60' : 'text-text-muted')}>{sub}</span>
      </div>
    </div>
  );
}
