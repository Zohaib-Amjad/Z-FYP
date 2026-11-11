import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses } from './controls';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, wrapperClassName, children, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={controlClasses(cn('h-11 appearance-none pr-10', className))}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
        aria-hidden="true"
      />
    </div>
  );
});
