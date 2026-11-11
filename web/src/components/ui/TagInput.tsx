'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses } from './controls';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** Add short labels with Enter or a comma; remove with the chip's button or Backspace on an empty field. */
export function TagInput({
  id,
  value,
  onChange,
  max = 20,
  maxLength = 60,
  placeholder = 'Type a feature and press Enter',
  ...aria
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, maxLength);
    if (!tag || value.length >= max) return;
    if (value.some(existing => existing.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      {value.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Added features">
          {value.map(tag => (
            <li
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 py-0.5 pl-3 pr-0.5 text-xs font-medium text-ivory-100"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter(item => item !== tag))}
                aria-label={`Remove ${tag}`}
                className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-ivory-100/20 after:absolute after:-inset-1.5 after:content-['']"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        disabled={value.length >= max}
        placeholder={value.length >= max ? `Limit of ${max} features reached` : placeholder}
        maxLength={maxLength}
        className={cn(controlClasses('h-11'))}
        {...aria}
      />
    </div>
  );
}
