import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { ProfileForm } from '@/components/account/ProfileForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSession } from '@/lib/session';

export const metadata = { title: 'My profile' };

export default async function AccountPage() {
  const user = await getSession();
  if (!user) return null;

  return (
    <main id="main-content" className="container-page py-12">
      <PageHeader
        eyebrow="My account"
        title="My profile"
        description="Keep your details current so your appointments run smoothly."
      />
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <ProfileForm user={user} />
        <ChangePasswordForm />
      </div>
    </main>
  );
}
