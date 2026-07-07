/**
 * app/(admin)/layout.tsx
 * ─────────────────────────────────────────────────────────────
 * Wraps every /admin/* page. Redirects to /dashboard if the
 * current user lacks ADMIN_PANEL_ACCESS — this is a UX
 * convenience (don't show the admin shell to someone who can't
 * use it), not the real security boundary. The actual
 * enforcement is RLS plus the requirePermission() guard inside
 * each Route Handler the admin pages call.
 * ─────────────────────────────────────────────────────────────
 */

import { redirect } from 'next/navigation';
import { requireSessionProfile, UnauthenticatedError, SuspendedAccountError } from '@/lib/auth/session';
import { can, PERMISSIONS } from '@/lib/auth/roles';
import { AdminSidebarClient } from '@/components/layout/AdminSidebarClient';
import { getAppConfig } from '@/lib/config/get-app-config';
import { env } from '@/lib/env';
import styles from './layout.module.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let profile;
  try {
    profile = await requireSessionProfile();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/login');
    if (err instanceof SuspendedAccountError) redirect('/login?suspended=1');
    throw err;
  }

  if (!can(profile.role, PERMISSIONS.ADMIN_PANEL_ACCESS)) {
    redirect('/dashboard');
  }

  const config = await getAppConfig(env.defaultOrgId);

  return (
    <div className={styles.shell}>
      <AdminSidebarClient
        username={profile.username}
        role={profile.role}
        appName={config.app_name}
        iconLetter={config.icon_letter}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
