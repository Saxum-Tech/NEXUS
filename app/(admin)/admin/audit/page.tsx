/**
 * app/(admin)/admin/audit/page.tsx
 */

import { Fragment } from 'react';
import { redirect } from 'next/navigation';
import { requireSessionProfile } from '@/lib/auth/session';
import { can, PERMISSIONS } from '@/lib/auth/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import styles from './audit.module.css';

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await requireSessionProfile();
  if (!can(profile.role, PERMISSIONS.AUDIT_VIEW)) redirect('/dashboard');

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const admin = createSupabaseAdminClient();
  const { data: events, count } = await admin
    .from('audit_log')
    .select(
      'id, actor_username, actor_role, action, target_type, target_id, ip_address, created_at',
      { count: 'exact' }
    )
    .eq('org_id', profile.orgId)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <PageShell
      title="Audit log"
      description="Append-only record of every privileged action in this organisation."
    >
      <Card>
        <table className={styles.table}>
          <thead>
            <tr>
              {['Timestamp', 'Actor', 'Action', 'Target', 'IP address'].map((h) => (
                <th key={h} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(events ?? []).length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>No audit events recorded yet.</td></tr>
            ) : (
              (events ?? []).map((event) => (
                <Fragment key={event.id}>
                  <tr>
                    <td className={`${styles.td} ${styles.tdMuted}`}>
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.tdMono}>{event.actor_username ?? 'unknown'}</span>
                      {event.actor_role && (
                        <span className={styles.actorBadge}>{event.actor_role}</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <span className={styles.actionBadge}>{event.action}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdSecondary}`}>
                      {event.target_type
                        ? `${event.target_type}${event.target_id ? ` · ${event.target_id.slice(0, 8)}` : ''}`
                        : '—'}
                    </td>
                    <td className={`${styles.td} ${styles.tdMuted}`}>
                      {event.ip_address ?? '—'}
                    </td>
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span>Showing {(events ?? []).length} of {count ?? 0} events</span>
          <div className={styles.paginationLinks}>
            {page > 1 && <a href={`/admin/audit?page=${page - 1}`}>← Prev</a>}
            <span>Page {page} of {Math.max(1, totalPages)}</span>
            {page < totalPages && <a href={`/admin/audit?page=${page + 1}`}>Next →</a>}
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
