/**
 * lib/auth/__tests__/roles.test.ts
 * ─────────────────────────────────────────────────────────────
 * Covers the permission matrix and, critically, the privilege
 * escalation guards (canAssignRole, canActOnUser). These two
 * functions are the only thing standing between "admin" and
 * "admin who just promoted themselves to super_admin" — they
 * need explicit, named tests, not just incidental coverage.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  can,
  canAll,
  canAssignRole,
  canActOnUser,
  roleRank,
  PERMISSIONS,
  APP_ROLES,
  type AppRole,
} from '../roles';

describe('can', () => {
  it('super_admin has every permission in the system', () => {
    const allPermissions = Object.values(PERMISSIONS);
    for (const permission of allPermissions) {
      expect(can('super_admin', permission)).toBe(true);
    }
  });

  it('admin cannot manage API keys (super_admin-only permission)', () => {
    expect(can('admin', PERMISSIONS.API_KEYS_MANAGE)).toBe(false);
  });

  it('viewer can view records but not create, edit, delete, or export them', () => {
    expect(can('viewer', PERMISSIONS.RECORD_VIEW)).toBe(true);
    expect(can('viewer', PERMISSIONS.RECORD_CREATE)).toBe(false);
    expect(can('viewer', PERMISSIONS.RECORD_EDIT)).toBe(false);
    expect(can('viewer', PERMISSIONS.RECORD_DELETE)).toBe(false);
    expect(can('viewer', PERMISSIONS.RECORD_EXPORT)).toBe(false);
  });

  it('editor can create/edit/export records but cannot delete them or manage users', () => {
    expect(can('editor', PERMISSIONS.RECORD_CREATE)).toBe(true);
    expect(can('editor', PERMISSIONS.RECORD_EDIT)).toBe(true);
    expect(can('editor', PERMISSIONS.RECORD_EXPORT)).toBe(true);
    expect(can('editor', PERMISSIONS.RECORD_DELETE)).toBe(false);
    expect(can('editor', PERMISSIONS.USER_INVITE)).toBe(false);
  });

  it('admin cannot delete user accounts (super_admin-only — see ROLE_PERMISSIONS table)', () => {
    expect(can('admin', PERMISSIONS.USER_DELETE)).toBe(false);
  });
});

describe('canAll', () => {
  it('returns true only when every listed permission is granted', () => {
    expect(canAll('admin', [PERMISSIONS.USER_INVITE, PERMISSIONS.USER_SUSPEND])).toBe(true);
  });

  it('returns false if even one permission in the list is missing', () => {
    expect(canAll('admin', [PERMISSIONS.USER_INVITE, PERMISSIONS.API_KEYS_MANAGE])).toBe(false);
  });

  it('returns true for an empty permission list (vacuous truth)', () => {
    expect(canAll('viewer', [])).toBe(true);
  });
});

describe('canAssignRole — privilege escalation prevention', () => {
  it('admin can assign editor and viewer (lower or equal-tier roles)', () => {
    expect(canAssignRole('admin', 'editor')).toBe(true);
    expect(canAssignRole('admin', 'viewer')).toBe(true);
  });

  it('admin can assign admin (peer role)', () => {
    expect(canAssignRole('admin', 'admin')).toBe(true);
  });

  it('CRITICAL: admin can never assign super_admin, even to themselves', () => {
    expect(canAssignRole('admin', 'super_admin')).toBe(false);
  });

  it('super_admin can assign any role including super_admin', () => {
    for (const role of APP_ROLES) {
      expect(canAssignRole('super_admin', role)).toBe(true);
    }
  });

  it('editor and viewer cannot assign any role (they lack ROLE_ASSIGN entirely)', () => {
    for (const targetRole of APP_ROLES) {
      expect(canAssignRole('editor', targetRole)).toBe(false);
      expect(canAssignRole('viewer', targetRole)).toBe(false);
    }
  });
});

describe('roleRank', () => {
  it('ranks roles in ascending order of privilege', () => {
    expect(roleRank('viewer')).toBeLessThan(roleRank('editor'));
    expect(roleRank('editor')).toBeLessThan(roleRank('admin'));
    expect(roleRank('admin')).toBeLessThan(roleRank('super_admin'));
  });
});

describe('canActOnUser — protects against acting on equal/higher-ranked users', () => {
  it('admin can act on editor and viewer (strictly lower rank)', () => {
    expect(canActOnUser('admin', 'editor')).toBe(true);
    expect(canActOnUser('admin', 'viewer')).toBe(true);
  });

  it('CRITICAL: admin cannot act on another admin (equal rank)', () => {
    expect(canActOnUser('admin', 'admin')).toBe(false);
  });

  it('CRITICAL: a lower-ranked role can never act on a higher-ranked one', () => {
    expect(canActOnUser('editor', 'admin')).toBe(false);
    expect(canActOnUser('viewer', 'editor')).toBe(false);
  });

  it('super_admin can act on anyone, including other super_admins (explicit override for offboarding)', () => {
    const allRoles: AppRole[] = [...APP_ROLES];
    for (const role of allRoles) {
      expect(canActOnUser('super_admin', role)).toBe(true);
    }
  });
});
