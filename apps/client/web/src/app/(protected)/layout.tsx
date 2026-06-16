/**
 * Layout for the protected route group. Wraps its pages in AuthGuard so only
 * authenticated users reach account, trips, and itinerary routes, with a Suspense
 * boundary for the streamed client children.
 */
import { Suspense } from 'react';

import { AuthGuard } from '@/components/AuthGuard/AuthGuard';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
