import Link from 'next/link';
import { Logo } from './Logo';

const LINKS = [
  { href: '/vehicles', label: 'Our vehicles' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#showrooms', label: 'Showrooms' },
  { href: '/register', label: 'Create an account' },
] as const;

export function SiteFooter() {
  return (
    <footer className="on-dark border-t border-ink-800 bg-ink-950 text-ivory-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-300">
            Private test drives in the world’s finest automobiles, arranged around your schedule at
            showrooms in London, Manchester and Edinburgh.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="eyebrow mb-4 font-sans">Explore</h2>
          <ul className="space-y-2.5 text-sm">
            {LINKS.map(link => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-[44px] items-center text-ivory-200 hover:text-gold-300"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow mb-4 font-sans">Concierge</h2>
          <p className="text-sm leading-relaxed text-ink-300">
            Appointments are confirmed by our showroom specialists. You will be notified of every
            change to your booking.
          </p>
          <Link
            href="/admin"
            className="mt-2 inline-flex min-h-[44px] items-center text-sm text-ink-300 underline-offset-4 hover:text-gold-300 hover:underline"
          >
            Staff login
          </Link>
        </div>
      </div>
      <div className="border-t border-ink-800 py-5 text-center text-xs text-ink-400">
        © {new Date().getFullYear()} Prestige Test Drive. All rights reserved.
      </div>
    </footer>
  );
}
