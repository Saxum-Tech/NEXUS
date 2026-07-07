/**
 * app/(admin)/admin/page.tsx
 */

import { requireSessionProfile } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageShell } from '@/components/layout/PageShell';
import { MetricCard } from '@/components/ui/MetricCard';
import styles from './overview.module.css';

export default async function AdminOverviewPage() {
  const profile = await requireSessionProfile();
  const admin = createSupabaseAdminClient();

  const [{ count: totalUsers }, { count: pendingInvites }] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', profile.orgId),
    admin.from('profiles').select('id', { count: 'exact', head: true })
      .eq('org_id', profile.orgId).eq('status', 'invited'),
  ]);

  return (
    <PageShell
      title="Admin overview"
      description={`Signed in as ${profile.username} (${profile.role})`}
    >
      <div className={styles.metricGrid}>
        <MetricCard label="Total users" value={totalUsers ?? 0} />
        <MetricCard label="Pending invites" value={pendingInvites ?? 0} />
      </div>
    </PageShell>
  );
}
