import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlClasses } from './controls';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...rest }, ref) {
    return (
      <input ref={ref} type={type} className={controlClasses(cn('h-11', className))} {...rest} />
    );
  },
);
