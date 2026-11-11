import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { ProfileForm } from '@/components/account/ProfileForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSession } from '@/lib/session';

export const metadata = { title: 'My profile' };

export default async function AdminProfilePage() {
  const user = await getSession();
  if (!user) return null;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="My profile"
        description="Your details and sign-in password."
      />
      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <ProfileForm user={user} />
        <ChangePasswordForm />
      </div>
    </>
  );
}
