'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 5000;
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const TONES: Record<ToastTone, string> = {
  success: 'border-status-approved/40 [&_svg]:text-status-approved',
  error: 'border-status-rejected/40 [&_svg]:text-status-rejected',
  info: 'border-ink-300 [&_svg]:text-status-completed',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts(current => [...current.slice(-3), { id, tone, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: message => push('success', message),
      error: message => push('error', message),
      info: message => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-card border bg-white p-4 text-sm text-ink-900 shadow-lift',
        TONES[toast.tone],
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded p-0.5 text-ink-500 hover:text-ink-900"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
