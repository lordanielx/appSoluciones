import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded border border-border-strong bg-surface px-3 text-base text-text placeholder:text-text-muted/70 ' +
  'transition-colors hover:border-steel focus:border-electric aria-[invalid=true]:border-danger ' +
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-text-muted';

type Touch = { touch?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Touch>(function Input(
  { className, touch, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, touch ? 'h-12 text-md' : 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'min-h-[88px] py-2 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Touch>(function Select(
  { className, touch, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'appearance-none pr-9', touch ? 'h-12 text-md' : 'h-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
    </div>
  );
});

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

/** Checkbox con área táctil de 44px. */
export const Checkbox = forwardRef<HTMLInputElement, CheckProps>(function Checkbox({ label, description, className, ...props }, ref) {
  return (
    <label className={cn('flex min-h-[44px] cursor-pointer items-start gap-3 py-2', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-sm border-border-strong accent-[rgb(var(--color-primary))]"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-base text-text">{label}</span>
        {description && <span className="text-xs text-text-muted">{description}</span>}
      </span>
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, CheckProps>(function Radio({ label, description, className, ...props }, ref) {
  return (
    <label className={cn('flex min-h-[44px] cursor-pointer items-start gap-3 py-2', className)}>
      <input
        ref={ref}
        type="radio"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[rgb(var(--color-primary))]"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-base text-text">{label}</span>
        {description && <span className="text-xs text-text-muted">{description}</span>}
      </span>
    </label>
  );
});
