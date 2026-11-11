import type { ReactNode } from 'react';
import { Card, CardBody } from '@/components/ui/Card';

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <main id="main-content" className="container-page flex justify-center py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">{title}</h1>
          <p className="mt-2 text-ink-600">{description}</p>
        </div>
        <Card>
          <CardBody className="p-6 sm:p-8">{children}</CardBody>
        </Card>
      </div>
    </main>
  );
}
