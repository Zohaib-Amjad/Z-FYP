'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix?: string;
  className?: string;
}

export const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string): string => `${prefix}-panel-${id}`;

/** Tab list with roving focus and arrow-key navigation. Render the matching tabpanel yourself. */
export function Tabs({ items, value, onChange, label, idPrefix = 'tabs', className }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const target = items[(keys[event.key] + items.length) % items.length];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex gap-1 overflow-x-auto border-b border-ink-200', className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={element => {
              refs.current[item.id] = element;
            }}
            role="tab"
            type="button"
            id={tabId(idPrefix, item.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={event => move(event, index)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
              selected
                ? 'border-gold-600 text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
