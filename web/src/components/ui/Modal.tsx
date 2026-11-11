'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, type ButtonVariant } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Built on the native dialog element, which provides the focus trap, Escape and inert background. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
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
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      onClose={onClose}
      onClick={event => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'w-[calc(100%-2rem)] max-w-lg rounded-card border border-ivory-300 bg-white p-0 text-ink-900 shadow-lift',
        'backdrop:bg-ink-950/60 backdrop:backdrop-blur-sm',
        className,
      )}
    >
      {open ? (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="modal-title" className="font-display text-2xl font-semibold">
                {title}
              </h2>
              {description ? (
                <p id="modal-description" className="mt-1.5 text-sm text-ink-600">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-control p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  confirmVariant = 'primary',
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
