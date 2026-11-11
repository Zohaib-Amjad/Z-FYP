import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata = { title: 'Create your account' };

export default function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AuthCard
      eyebrow="Join Prestige"
      title="Create your account"
      description="Reserve private test drives and follow every appointment in one place."
    >
      <RegisterForm next={searchParams.next} />
    </AuthCard>
  );
}
