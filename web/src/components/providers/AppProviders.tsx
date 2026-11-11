'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import type { User } from '@/types';
import { AuthProvider } from './AuthProvider';
import { QueryProvider } from './QueryProvider';

export function AppProviders({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: User | null;
}) {
  return (
    <QueryProvider>
      <ToastProvider>
        <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
