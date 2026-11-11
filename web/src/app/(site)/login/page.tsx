import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = { title: 'Sign in' };

interface PageProps {
  searchParams: { next?: string; session?: string };
}

export default function LoginPage({ searchParams }: PageProps) {
  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in"
      description="Access your test-drive appointments and profile."
    >
      <LoginForm
        variant="customer"
        next={searchParams.next}
        expired={searchParams.session === 'expired'}
      />
    </AuthCard>
  );
}
