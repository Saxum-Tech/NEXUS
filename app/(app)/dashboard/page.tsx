/**
 * app/(app)/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Minimal authenticated landing page. Replace the body with
 * your actual product — the auth, session, and role-checking
 * plumbing underneath it is already wired up and ready.
 * ─────────────────────────────────────────────────────────────
 */

import { requireSessionProfile } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
  const profile = await requireSessionProfile();

  return (
    <PageShell
      title={`Welcome, ${profile.displayName}`}
      description={`Signed in as ${profile.username} · ${ROLE_LABELS[profile.role]}`}
    >
      <Card>
        <p className={styles.placeholder}>
          This is the foundation dashboard. Replace this page with your actual product UI —
          the auth, roles, sessions, and admin panel underneath are production-ready.
        </p>
      </Card>
    </PageShell>
  );
}
