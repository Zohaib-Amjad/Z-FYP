import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { ButtonLink } from '@/components/ui/Button';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center"
      >
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 font-display text-5xl font-semibold">This road leads nowhere</h1>
        <p className="mt-4 max-w-md text-ink-600">
          The page you are looking for has moved or never existed. Let us point you back to the
          showroom.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Return home</ButtonLink>
          <ButtonLink href="/vehicles" variant="outline">
            Browse vehicles
          </ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
