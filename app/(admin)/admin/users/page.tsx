/**
 * app/(admin)/admin/users/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Admin user list. Uses useApiQuery for the list and
 * useApiMutation for row actions — replacing the original
 * manual useEffect+fetch+loading+error state management.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageShell } from '@/components/layout/PageShell';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { useApiQuery, useApiMutation } from '@/lib/hooks';
import { ROLE_LABELS, type AppRole, type UserStatus } from '@/lib/auth/roles';
import styles from './users.module.css';

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  contact_email: string | null;
  role: AppRole;
  status: UserStatus;
  department: string | null;
}

interface UsersResponse {
  users: UserRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

type ConfirmAction =
  | { type: 'suspend'; user: UserRow }
  | { type: 'reinstate'; user: UserRow }
  | { type: 'reset-password'; user: UserRow };

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === 'active')  return <Badge variant="success" dot="green">Active</Badge>;
  if (status === 'invited') return <Badge variant="warning" dot="orange">Invite pending</Badge>;
  return <Badge variant="danger" dot="red">Suspended</Badge>;
}

function RoleBadge({ role }: { role: AppRole }) {
  const variant =
    role === 'super_admin' ? 'brand'
    : role === 'admin'     ? 'info'
    : role === 'editor'    ? 'warning'
    : 'muted';
  return <Badge variant={variant}>{ROLE_LABELS[role]}</Badge>;
}

export default function AdminUsersPage() {
  const [search, setSearch]               = useState('');
  const [page, setPage]                   = useState(1);
  const [toast, setToast]                 = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null);

  // ── Data fetching ─────────────────────────────────────────
  const { data, isLoading, error, refetch } = useApiQuery<UsersResponse>(
    '/api/admin/users',
    { search, page },
    { debounceMs: 300 }
  );

  // ── Row action mutation ───────────────────────────────────
  // URL is built per-action below when the dialog confirms.
  const actionUrl = pendingAction
    ? pendingAction.type === 'reset-password'
      ? `/api/admin/users/${pendingAction.user.id}/reset-password`
      : `/api/admin/users/${pendingAction.user.id}/${pendingAction.type}`
    : '/api/admin/users'; // fallback never used while pendingAction is null

  const { mutate: executeAction, isLoading: isActing } = useApiMutation(
    actionUrl,
    'POST',
    {
      onSuccess: () => {
        if (!pendingAction) return;
        const messages: Record<ConfirmAction['type'], string> = {
          suspend:          `${pendingAction.user.username} has been suspended.`,
          reinstate:        `${pendingAction.user.username} has been reinstated.`,
          'reset-password': `Password reset link generated for ${pendingAction.user.username}.`,
        };
        setToast(messages[pendingAction.type]);
        setPendingAction(null);
        refetch();
      },
      onError: () => setPendingAction(null),
    }
  );

  // ── Confirm dialog config ─────────────────────────────────
  const confirmConfig: Record<ConfirmAction['type'], { title: string; description: string; label: string }> = {
    suspend: {
      title: 'Suspend user?',
      description: `${pendingAction?.user.username} will be signed out immediately and unable to log back in until reinstated.`,
      label: 'Suspend',
    },
    reinstate: {
      title: 'Reinstate user?',
      description: `${pendingAction?.user.username} will be able to sign in again.`,
      label: 'Reinstate',
    },
    'reset-password': {
      title: 'Reset password?',
      description: `A new setup link will be sent to ${pendingAction?.user.username}. Their current password will no longer work until they use it.`,
      label: 'Send reset link',
    },
  };
  const confirm = pendingAction ? confirmConfig[pendingAction.type] : null;

  return (
    <PageShell
      title="User management"
      actions={
        <Link href="/admin/users/invite">
          <Button variant="primary">+ Invite user</Button>
        </Link>
      }
    >
      {error && <Alert variant="danger" role="alert">{error}</Alert>}

      <Card>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              placeholder="Search by username, name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {isLoading ? (
          <Spinner centered label="Loading users…" />
        ) : !data || data.users.length === 0 ? (
          <EmptyState
            icon="👤"
            title="No users found"
            description={search ? `No results for "${search}".` : 'No users have been invited yet.'}
            action={
              !search && (
                <Link href="/admin/users/invite">
                  <Button variant="primary" size="sm">Invite first user</Button>
                </Link>
              )
            }
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>User</th>
                  <th className={styles.th}>Username</th>
                  <th className={styles.th}>Contact email</th>
                  <th className={styles.th}>Department</th>
                  <th className={styles.th}>Role</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{user.display_name}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.mono}>{user.username}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdMuted}`}>
                      {user.contact_email ?? '—'}
                    </td>
                    <td className={`${styles.td} ${styles.tdMuted}`}>
                      {user.department ?? '—'}
                    </td>
                    <td className={styles.td}>
                      <RoleBadge role={user.role} />
                    </td>
                    <td className={styles.td}>
                      <StatusBadge status={user.status} />
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actionsCell}>
                        {user.status === 'suspended' ? (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                            onClick={() => setPendingAction({ type: 'reinstate', user })}
                          >
                            Reinstate
                          </button>
                        ) : (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => setPendingAction({ type: 'reset-password', user })}
                            >
                              Reset password
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => setPendingAction({ type: 'suspend', user })}
                            >
                              Suspend
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              totalItems={data.pagination.total}
              pageSize={data.pagination.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {pendingAction && confirm && (
        <ConfirmDialog
          open
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.label}
          variant={pendingAction.type === 'reinstate' ? 'info' : 'danger'}
          isLoading={isActing}
          onConfirm={() => executeAction()}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </PageShell>
  );
}
