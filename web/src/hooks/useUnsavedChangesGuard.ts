'use client';

import { useEffect } from 'react';

const MESSAGE = 'You have unsaved changes. Leave this page and discard them?';

/**
 * Warns before losing edits: browser close/reload/back-to-another-site through beforeunload,
 * and in-app navigation by confirming clicks on same-origin links.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return undefined;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, window.location.href);
      const leaving =
        url.origin === window.location.origin && url.pathname !== window.location.pathname;
      if (leaving && !window.confirm(MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
