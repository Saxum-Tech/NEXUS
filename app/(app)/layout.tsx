/**
 * app/(app)/layout.tsx
 * ─────────────────────────────────────────────────────────────
 * Wraps every regular (non-admin) authenticated page, e.g.
 * /dashboard, /profile. Just requires a valid, non-suspended
 * session — no specific permission needed, unlike the admin
 * layout.
 * ─────────────────────────────────────────────────────────────
 */

import { redirect } from 'next/navigation';
import {
  requireSessionProfile,
  UnauthenticatedError,
  SuspendedAccountError,
} from '@/lib/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSessionProfile();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/login');
    if (err instanceof SuspendedAccountError) redirect('/login?suspended=1');
    throw err;
  }

  return <>{children}</>;
}
