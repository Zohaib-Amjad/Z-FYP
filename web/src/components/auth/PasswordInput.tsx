'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PASSWORD_RULES } from '@/lib/schemas';
import { cn } from '@/lib/cn';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Password field with a show/hide toggle (a real button, so it works with the keyboard). */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control text-ink-500 hover:text-ink-900"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);

/** Live checklist of the password rules; updates as the user types. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul aria-label="Password requirements" className="mt-2 space-y-1">
      {PASSWORD_RULES.map(rule => {
        const met = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2 text-xs',
              met ? 'text-status-approved' : 'text-ink-500',
            )}
          >
            {met ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {rule.label}
            <span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
