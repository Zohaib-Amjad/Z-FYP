'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserMenu } from './UserMenu';

const NAV = [
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#showrooms', label: 'Showrooms' },
] as const;

export function SiteHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="on-dark sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo tone="light" />

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                pathname.startsWith(item.href) && item.href === '/vehicles' ? 'page' : undefined
              }
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-ivory-200 transition-colors hover:text-gold-300 aria-[current=page]:text-gold-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === 'CUSTOMER' ? <NotificationBell /> : null}
              <UserMenu user={user} />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <ButtonLink href="/login" variant="light" size="md">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" variant="primary" size="md">
                Create account
              </ButtonLink>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(current => !current)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-control text-ivory-100 hover:bg-ivory-100/10 md:hidden"
          >
            {mobileOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Mobile"
        className={cn('border-t border-ink-800 md:hidden', mobileOpen ? 'block' : 'hidden')}
      >
        <ul className="container-page space-y-1 py-3">
          {NAV.map(item => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-control px-3 py-3 text-base font-medium text-ivory-100 hover:bg-ivory-100/10"
              >
                {item.label}
              </Link>
            </li>
          ))}
          {user ? null : (
            <li className="flex gap-3 pt-2">
              <ButtonLink
                href="/login"
                variant="light"
                className="flex-1"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                Create account
              </ButtonLink>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
