'use client';

/**
 * Client-side route guard that redirects unauthenticated users away from protected
 * pages, centralizing the auth-state-to-redirect logic so individual pages need not
 * each reimplement it.
 */
import { useEffect } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/state/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && !user) {
      const currentPath =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : '');
      router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
    }
  }, [user, isLoading, router, pathname, searchParams]);

  if (isLoading || !user) {
    return null;
  }

  return <>{children}</>;
}
