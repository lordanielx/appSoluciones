import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-text-inverse hover:bg-primary-hover border border-primary',
  accent: 'bg-accent text-text-inverse hover:bg-accent-hover border border-accent',
  secondary: 'bg-surface text-text border border-border-strong hover:bg-subtle',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-subtle',
  danger: 'bg-surface text-danger border border-danger/60 hover:bg-danger-soft',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  // Móvil / acciones principales del técnico: 48px táctil.
  lg: 'h-12 px-5 text-md gap-2 font-semibold tracking-wide',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/** Botón cuadrado de solo icono (nunca circular). Requiere etiqueta accesible. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'icon' | 'block'> & { label: string }>(
  function IconButton({ label, className, size = 'md', variant = 'ghost', children, ...props }, ref) {
    const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
    return (
      <Button ref={ref} variant={variant} aria-label={label} title={label} className={cn(dim, '!px-0', className)} {...props}>
        {children}
      </Button>
    );
  },
);
