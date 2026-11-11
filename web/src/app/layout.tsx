import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers/AppProviders';
import { getSession } from '@/lib/session';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Prestige Test Drive | Luxury Automotive Appointments',
    template: '%s | Prestige Test Drive',
  },
  description:
    'Reserve a private test drive in the world’s most coveted automobiles. Choose your vehicle, showroom and time; our specialists take care of the rest.',
};

export const viewport: Viewport = {
  themeColor: '#0b0b0d',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-control focus:bg-gold-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-ink-950"
        >
          Skip to main content
        </a>
        <AppProviders initialUser={user}>{children}</AppProviders>
      </body>
    </html>
  );
}
