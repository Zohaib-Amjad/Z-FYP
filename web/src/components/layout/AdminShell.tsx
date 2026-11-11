'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  Car,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCog,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { useToast } from '@/components/ui/Toast';
import { adminCrumbs } from '@/lib/adminNav';
import { cn } from '@/lib/cn';
import { fullName, initials } from '@/lib/format';
import { Logo } from './Logo';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/admin/vehicles', label: 'Vehicles', icon: Car },
  { href: '/admin/dealerships', label: 'Dealerships', icon: Building2 },
  { href: '/admin/slots', label: 'Time slots', icon: CalendarClock },
  { href: '/admin/customers', label: 'Customers', icon: UsersRound },
  { href: '/admin/staff', label: 'Staff', icon: UserCog },
  { href: '/admin/profile', label: 'My profile', icon: UserRound },
];

const COLLAPSE_KEY = 'prestige-admin-sidebar-collapsed';

function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex-1 space-y-1 px-3 py-4">
      {NAV.map(item => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-gold-400 text-ink-950'
                : 'text-ivory-200 hover:bg-ivory-100/10 hover:text-white',
            )}
          >
            <item.icon className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden="true" />
            <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminUserMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

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

  if (!user) return null;

  const signOut = async () => {
    await logout();
    toast.success('You have been signed out.');
  };
  const item =
    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-800 hover:bg-ivory-200 focus-visible:bg-ivory-200';

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-[44px] items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-ink-100"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-gold-300"
        >
          {initials(user)}
        </span>
        <span className="hidden text-left text-sm sm:block">
          <span className="block font-semibold leading-tight text-ink-900">{fullName(user)}</span>
          <span className="block text-xs leading-tight text-ink-500">Showroom staff</span>
        </span>
        <ChevronDown className="h-4 w-4 text-ink-500" aria-hidden="true" />
        <span className="sr-only sm:hidden">Account menu for {fullName(user)}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-card border border-ivory-300 bg-white py-1 shadow-lift"
        >
          <Link
            role="menuitem"
            href="/admin/profile"
            className={item}
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4 text-ink-500" aria-hidden="true" />
            My profile
          </Link>
          <button role="menuitem" type="button" onClick={() => void signOut()} className={item}>
            <LogOut className="h-4 w-4 text-ink-500" aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const crumbs = adminCrumbs(pathname);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      setCollapsed(false);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(current => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // The preference is simply not remembered when storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-ivory-100">
      <aside
        className={cn(
          'on-dark sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-800 bg-ink-950 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-ink-800',
            collapsed ? 'justify-center' : 'px-5',
          )}
        >
          {collapsed ? (
            <Link
              href="/admin"
              aria-label="Prestige administration, dashboard"
              className="font-display text-xl font-bold text-gold-400"
            >
              P
            </Link>
          ) : (
            <Logo tone="light" href="/admin" />
          )}
        </div>
        <SidebarNav collapsed={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className="m-3 flex items-center justify-center gap-2 rounded-control px-3 py-2 text-sm text-ink-300 hover:bg-ivory-100/10 hover:text-white"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
              Collapse
            </>
          )}
        </button>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="on-dark relative flex h-full w-72 max-w-[85%] flex-col bg-ink-950">
            <div className="flex h-16 items-center justify-between border-b border-ink-800 px-5">
              <Logo tone="light" href="/admin" />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-control text-ivory-100 hover:bg-ivory-100/10"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-ivory-300 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink-800 hover:bg-ink-100 lg:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <p className="hidden text-sm text-ink-500 lg:block">Dealership administration</p>
          <div className="ml-auto">
            <AdminUserMenu />
          </div>
        </div>
        <main id="main-content" className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {crumbs.length > 1 ? <Breadcrumbs items={crumbs} className="mb-5" /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
