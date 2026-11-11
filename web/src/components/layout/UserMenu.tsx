'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, ChevronDown, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { fullName, initials } from '@/lib/format';
import type { User } from '@/types';

const ITEM =
  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-800 hover:bg-ivory-200 focus-visible:bg-ivory-200';

export function UserMenu({ user }: { user: User }) {
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const isStaff = user.role === 'STAFF';

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    setSigningOut(true);
    await logout();
    toast.success('You have been signed out.');
  };

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-[44px] items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-ivory-100 hover:bg-ivory-100/10"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-ink-950"
        >
          {initials(user)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:block">
          {user.firstName}
        </span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Account menu for {fullName(user)}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border border-ivory-300 bg-white py-1 shadow-lift"
        >
          <div className="border-b border-ivory-300 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{fullName(user)}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          {isStaff ? (
            <Link role="menuitem" href="/admin" className={ITEM} onClick={() => setOpen(false)}>
              <LayoutDashboard className="h-4 w-4 text-ink-500" aria-hidden="true" />
              Admin portal
            </Link>
          ) : (
            <>
              <Link
                role="menuitem"
                href="/my-bookings"
                className={ITEM}
                onClick={() => setOpen(false)}
              >
                <CalendarCheck className="h-4 w-4 text-ink-500" aria-hidden="true" />
                My bookings
              </Link>
              <Link role="menuitem" href="/account" className={ITEM} onClick={() => setOpen(false)}>
                <UserRound className="h-4 w-4 text-ink-500" aria-hidden="true" />
                My profile
              </Link>
            </>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={ITEM}
          >
            <LogOut className="h-4 w-4 text-ink-500" aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
