/**
 * app/(app)/profile/page.tsx
 * ─────────────────────────────────────────────────────────────
 * User profile page. Fetches the full profile server-side
 * and passes it to two client forms:
 *   - ProfileDetailsForm   — display name + contact email
 *   - ChangePasswordForm   — self-service password change
 * ─────────────────────────────────────────────────────────────
 */

import { requireSessionProfile } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProfileDetailsForm } from './ProfileDetailsForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import styles from './profile.module.css';

export default async function ProfilePage() {
  const sessionProfile = await requireSessionProfile();

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, first_name, last_name, contact_email, department')
    .eq('id', sessionProfile.id)
    .single();

  const displayName = profile?.display_name ?? sessionProfile.displayName;
  const contactEmail = profile?.contact_email ?? null;
  const department = profile?.department ?? null;

  return (
    <PageShell title="My profile">
      <div className={styles.layout}>

        <Card title="Personal details">
          <div className={styles.roleRow}>
            <span className={styles.detailLabel}>Role</span>
            <Badge
              variant={
                sessionProfile.role === 'super_admin' ? 'brand'
                : sessionProfile.role === 'admin' ? 'info'
                : sessionProfile.role === 'editor' ? 'warning'
                : 'muted'
              }
            >
              {ROLE_LABELS[sessionProfile.role]}
            </Badge>
            {department && (
              <>
                <span className={styles.detailSep}>·</span>
                <span className={styles.detailLabel}>{department}</span>
              </>
            )}
          </div>

          <ProfileDetailsForm
            initialDisplayName={displayName}
            initialContactEmail={contactEmail}
            username={sessionProfile.username}
          />
        </Card>

        <Card title="Change password">
          <ChangePasswordForm />
        </Card>

      </div>
    </PageShell>
  );
}
