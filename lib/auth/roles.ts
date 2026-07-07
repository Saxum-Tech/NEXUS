/**
 * lib/auth/roles.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for roles and what they're allowed to
 * do. Keep this in sync with the `app_role` enum in
 * supabase/migrations/0001_init_schema.sql.
 *
 * Route Handlers import `can()` to enforce permissions server
 * side. UI components import it to decide what to render.
 * Neither of those is the real security boundary — RLS is —
 * but checking here gives fast, correct 403s and a UI that
 * doesn't dangle buttons the user can't actually use.
 * ─────────────────────────────────────────────────────────────
 */

export const APP_ROLES = ['super_admin', 'admin', 'editor', 'viewer'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const USER_STATUSES = ['active', 'invited', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Permission keys. Add new ones here, then wire them into
 * ROLE_PERMISSIONS below. Route Handlers should reference these
 * constants rather than raw strings to get autocomplete + typo
 * safety.
 */
export const PERMISSIONS = {
  USER_INVITE: 'user:invite',
  USER_EDIT: 'user:edit',
  USER_SUSPEND: 'user:suspend',
  USER_DELETE: 'user:delete',
  USER_RESET_PASSWORD: 'user:reset_password',
  ROLE_ASSIGN: 'role:assign',
  ROLE_MANAGE: 'role:manage', // create/edit custom roles & the permission matrix itself
  RECORD_VIEW: 'record:view',
  RECORD_CREATE: 'record:create',
  RECORD_EDIT: 'record:edit',
  RECORD_DELETE: 'record:delete',
  RECORD_EXPORT: 'record:export',
  CONFIG_EDIT: 'config:edit',
  AUDIT_VIEW: 'audit:view',
  ADMIN_PANEL_ACCESS: 'admin:access',
  API_KEYS_MANAGE: 'api_keys:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * The permission matrix. This is intentionally a flat,
 * readable object — resist the urge to make this "clever"
 * with inheritance chains. Enterprise customers will ask to
 * see exactly this table, so it should read like documentation.
 */
const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),

  admin: [
    PERMISSIONS.USER_INVITE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_RESET_PASSWORD,
    PERMISSIONS.ROLE_ASSIGN, // admins can assign roles up to (not including) super_admin — enforced in code, see canAssignRole()
    PERMISSIONS.RECORD_VIEW,
    PERMISSIONS.RECORD_CREATE,
    PERMISSIONS.RECORD_EDIT,
    PERMISSIONS.RECORD_DELETE,
    PERMISSIONS.RECORD_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.ADMIN_PANEL_ACCESS,
  ],

  editor: [
    PERMISSIONS.RECORD_VIEW,
    PERMISSIONS.RECORD_CREATE,
    PERMISSIONS.RECORD_EDIT,
    PERMISSIONS.RECORD_EXPORT,
  ],

  viewer: [
    PERMISSIONS.RECORD_VIEW,
  ],
};

/** Returns true if `role` has been granted `permission`. */
export function can(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Returns true if `role` has ALL of the given permissions. */
export function canAll(role: AppRole, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/**
 * Role hierarchy for comparisons (e.g. "can X manage a user
 * with role Y"). Higher number = more privileged.
 */
const ROLE_RANK: Record<AppRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  super_admin: 3,
};

export function roleRank(role: AppRole): number {
  return ROLE_RANK[role];
}

/**
 * Business rule: an admin can invite/assign any role EXCEPT
 * super_admin. Only an existing super_admin can create another
 * super_admin. This prevents privilege escalation by a
 * compromised admin account.
 */
export function canAssignRole(actorRole: AppRole, targetRole: AppRole): boolean {
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'admin') return targetRole !== 'super_admin';
  return false;
}

/**
 * Business rule: nobody can suspend or delete a user with an
 * equal or higher rank than themselves, except super_admin who
 * can act on anyone (including other super_admins, intentionally
 * — e.g. offboarding a departing co-founder).
 */
export function canActOnUser(actorRole: AppRole, targetRole: AppRole): boolean {
  if (actorRole === 'super_admin') return true;
  return roleRank(actorRole) > roleRank(targetRole);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full system access, including managing other admins and destructive actions.',
  admin: 'Can manage users and app configuration but cannot create other super admins.',
  editor: 'Can create, edit and export records but cannot manage users or settings.',
  viewer: 'Read-only access to records.',
};
