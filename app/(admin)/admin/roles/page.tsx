/**
 * app/(admin)/admin/roles/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Read-only permission matrix sourced directly from
 * lib/auth/roles.ts — never a hardcoded copy that could drift.
 * See the note at the bottom of this file before adding an
 * "edit" UI here.
 * ─────────────────────────────────────────────────────────────
 */

import { Fragment } from 'react';
import { redirect } from 'next/navigation';
import { requireSessionProfile } from '@/lib/auth/session';
import {
  can,
  PERMISSIONS,
  APP_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type Permission,
} from '@/lib/auth/roles';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import styles from './roles.module.css';

const PERMISSION_GROUPS: { heading: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    heading: 'User management',
    permissions: [
      { key: PERMISSIONS.USER_INVITE, label: 'Invite new users' },
      { key: PERMISSIONS.USER_EDIT, label: 'Edit user profiles' },
      { key: PERMISSIONS.USER_SUSPEND, label: 'Suspend / reinstate users' },
      { key: PERMISSIONS.USER_DELETE, label: 'Delete users permanently' },
      { key: PERMISSIONS.USER_RESET_PASSWORD, label: 'Reset any user password' },
      { key: PERMISSIONS.ROLE_ASSIGN, label: 'Assign / change roles' },
    ],
  },
  {
    heading: 'Records & content',
    permissions: [
      { key: PERMISSIONS.RECORD_VIEW, label: 'View all records' },
      { key: PERMISSIONS.RECORD_CREATE, label: 'Create records' },
      { key: PERMISSIONS.RECORD_EDIT, label: 'Edit records' },
      { key: PERMISSIONS.RECORD_DELETE, label: 'Delete records' },
      { key: PERMISSIONS.RECORD_EXPORT, label: 'Export data' },
    ],
  },
  {
    heading: 'System configuration',
    permissions: [
      { key: PERMISSIONS.CONFIG_EDIT, label: 'Edit app settings & branding' },
      { key: PERMISSIONS.ROLE_MANAGE, label: 'Manage roles & permissions' },
      { key: PERMISSIONS.AUDIT_VIEW, label: 'View audit log' },
      { key: PERMISSIONS.ADMIN_PANEL_ACCESS, label: 'Access admin panel' },
      { key: PERMISSIONS.API_KEYS_MANAGE, label: 'Manage API keys' },
    ],
  },
];

function PermCell({ granted }: { granted: boolean }) {
  return (
    <td className={styles.matrixTd}>
      {granted
        ? <span className={styles.check}>✓</span>
        : <span className={styles.cross}>—</span>}
    </td>
  );
}

export default async function RolesPage() {
  const profile = await requireSessionProfile();
  if (!can(profile.role, PERMISSIONS.ROLE_MANAGE)) redirect('/dashboard');

  return (
    <PageShell
      title="Roles & permissions"
      description="Defined in code (lib/auth/roles.ts) and enforced by the API layer and Postgres RLS. Read-only by design — see the source comment before adding an edit UI."
    >
      <Card>
        <div className={styles.roleGrid}>
          {APP_ROLES.map((role) => (
            <div key={role}>
              <div className={styles.roleLabel}>{ROLE_LABELS[role]}</div>
              <div className={styles.roleDesc}>{ROLE_DESCRIPTIONS[role]}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.matrixTh}>Permission</th>
              {APP_ROLES.map((role) => (
                <th key={role} className={styles.matrixTh}>{ROLE_LABELS[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.heading}>
                <tr className={styles.sectionRow}>
                  <td colSpan={APP_ROLES.length + 1}>{group.heading}</td>
                </tr>
                {group.permissions.map((perm) => (
                  <tr key={perm.key}>
                    <td className={styles.matrixTd}>{perm.label}</td>
                    {APP_ROLES.map((role) => (
                      <PermCell key={role} granted={can(role, perm.key)} />
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}

/**
 * NOTE — dynamic custom roles: see previous file comment.
 * Short version: it requires a DB schema change, RLS rewrite,
 * and a caching layer. Don't just add an edit button here.
 */
