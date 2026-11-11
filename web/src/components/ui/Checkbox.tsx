import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-ink-400 accent-gold-600',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
          {...rest}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm text-ink-800">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={`${inputId}-hint`} className="ml-8 mt-1 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="ml-8 mt-1 text-xs font-medium text-status-rejected"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
});
