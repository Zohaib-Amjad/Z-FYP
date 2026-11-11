import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { Logo } from '@/components/layout/Logo';

export const metadata = { title: 'Staff sign in', robots: { index: false, follow: false } };

interface PageProps {
  searchParams: { next?: string; session?: string };
}

export default function AdminLoginPage({ searchParams }: PageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 py-12">
      <main id="main-content" className="w-full max-w-md">
        <div className="on-dark mb-8 flex flex-col items-center text-center">
          <Logo tone="light" />
          <p className="eyebrow mt-8">Dealership administration</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-ivory-100">Staff sign in</h1>
          <p className="mt-2 text-sm text-ink-300">For authorised showroom staff only.</p>
        </div>
        <div className="rounded-card border border-ink-700 bg-ivory-100 p-6 text-ink-900 shadow-lift sm:p-8">
          <LoginForm
            variant="staff"
            next={searchParams.next}
            expired={searchParams.session === 'expired'}
          />
        </div>
        <p className="on-dark mt-6 text-center text-sm text-ink-300">
          Not a member of staff?{' '}
          <Link
            href="/login"
            className="font-semibold text-gold-300 underline-offset-4 hover:underline"
          >
            Customer sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
