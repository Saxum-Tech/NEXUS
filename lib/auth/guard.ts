/**
 * lib/auth/guard.ts
 * ─────────────────────────────────────────────────────────────
 * Thin wrapper used at the top of every privileged Route
 * Handler. Resolves the session, checks a permission, and
 * returns either the verified profile or a ready-to-return
 * NextResponse — collapsing the same six lines of error
 * handling that would otherwise be duplicated in every route.
 *
 * Usage:
 *
 *   const guard = await requirePermission(PERMISSIONS.USER_INVITE);
 *   if (!guard.ok) return guard.response;
 *   const actor = guard.profile; // typed as SessionProfile, no null check needed
 *
 * Note: the discriminant is the literal `ok` field, not the
 * truthiness of `profile`/`response`. Narrowing on a dedicated
 * boolean tag (rather than on two separate nullable fields)
 * is what lets TypeScript carry the narrowing through `guard.profile`
 * at every call site, including after intermediate `await`s.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { NextResponse } from 'next/server';
import {
  getSessionProfile,
  type SessionProfile,
} from '@/lib/auth/session';
import { can, type Permission } from '@/lib/auth/roles';

type GuardResult =
  | { ok: true; profile: SessionProfile; response: null }
  | { ok: false; profile: null; response: NextResponse };

export async function requirePermission(permission: Permission): Promise<GuardResult> {
  const profile = await getSessionProfile();

  if (!profile) {
    return {
      ok: false,
      profile: null,
      response: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }),
    };
  }

  if (profile.status === 'suspended') {
    return {
      ok: false,
      profile: null,
      response: NextResponse.json({ error: 'Account suspended.' }, { status: 403 }),
    };
  }

  if (!can(profile.role, permission)) {
    return {
      ok: false,
      profile: null,
      response: NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, profile, response: null };
}
