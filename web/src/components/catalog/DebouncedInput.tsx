'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/Input';

const DEBOUNCE_MS = 400;

interface DebouncedInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  /** Value currently applied (from the URL). */
  value: string;
  /** Called once typing has paused. */
  onCommit: (value: string) => void;
}

/** Keeps what the user types locally and only reports it after a pause, so the URL is not rewritten per keystroke. */
export function DebouncedInput({ value, onCommit, ...rest }: DebouncedInputProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === committed.current) return undefined;
    const timer = window.setTimeout(() => {
      committed.current = draft;
      onCommit(draft);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit]);

  return <Input value={draft} onChange={event => setDraft(event.target.value)} {...rest} />;
}
