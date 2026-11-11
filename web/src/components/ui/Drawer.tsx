'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Slide-over panel from the left, built on the native dialog (focus trap and Escape included). */
export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={event => {
        if (event.target === ref.current) onClose();
      }}
      className="m-0 h-full max-h-full w-[22rem] max-w-[90vw] bg-ivory-100 p-0 text-ink-900 shadow-lift backdrop:bg-ink-950/60"
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-ivory-300 px-5 py-4">
            <h2 id="drawer-title" className="font-display text-2xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="rounded-control p-2 text-ink-600 hover:bg-ink-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="border-t border-ivory-300 px-5 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
