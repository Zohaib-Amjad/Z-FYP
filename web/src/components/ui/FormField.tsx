import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/** Label, hint and error wrapper. It hands the control the ids and ARIA wiring it needs. */
export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  const control: ControlProps = {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-required': required ? true : undefined,
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-status-rejected">
            *
          </span>
        ) : null}
      </label>
      {children(control)}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-status-rejected">
          {error}
        </p>
      ) : null}
    </div>
  );
}
