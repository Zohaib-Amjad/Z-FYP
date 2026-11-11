'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { ApiError, api, onUnauthenticated } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { isProtectedPath } from '@/lib/routeAccess';
import type { Role, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-reads the session from /api/auth/me. */
  refresh: () => Promise<User | null>;
  /** Replaces the cached user, e.g. after registering or editing the profile. */
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<User | null> {
  try {
    return await api.get<User>('/api/auth/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

interface AuthProviderProps {
  children: ReactNode;
  /** Session resolved on the server, so the first paint already knows who is signed in. */
  initialUser: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const query = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchSession,
    initialData: initialUser,
    staleTime: Infinity,
  });
  const user = query.data ?? null;

  const userRef = useRef(user);
  const pathRef = useRef(pathname);
  useEffect(() => {
    userRef.current = user;
    pathRef.current = pathname;
  }, [user, pathname]);

  const setUser = useCallback(
    (next: User | null) => {
      queryClient.setQueryData(queryKeys.auth.me(), next);
    },
    [queryClient],
  );

  useEffect(
    () =>
      onUnauthenticated(() => {
        if (!userRef.current) return;
        setUser(null);
        queryClient.removeQueries({
          predicate: candidate => candidate.queryKey[0] !== queryKeys.auth.all[0],
        });
        const path = pathRef.current;
        if (isProtectedPath(path)) {
          const login = path.startsWith('/admin') ? '/admin/login' : '/login';
          router.replace(`${login}?next=${encodeURIComponent(path)}&session=expired`);
        }
      }),
    [queryClient, router, setUser],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const signedIn = await api.post<User>('/api/auth/login', { email, password });
      setUser(signedIn);
      return signedIn;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post<null>('/api/auth/logout');
    } finally {
      setUser(null);
      queryClient.removeQueries({
        predicate: candidate => candidate.queryKey[0] !== queryKeys.auth.all[0],
      });
      router.push('/');
      router.refresh();
    }
  }, [queryClient, router, setUser]);

  const refresh = useCallback(async () => {
    const fresh = await fetchSession();
    setUser(fresh);
    return fresh;
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: user !== null,
      isLoading: query.isFetching && user === null,
      login,
      logout,
      refresh,
      setUser,
    }),
    [user, query.isFetching, login, logout, refresh, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
