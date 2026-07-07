/**
 * lib/auth/session.ts
 * ─────────────────────────────────────────────────────────────
 * Resolves "who is making this request" for Server Components
 * and Route Handlers: the Supabase auth user plus their
 * application profile (username, role, org, status).
 *
 * This is the function nearly every protected page and API
 * route should call first.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppRole, UserStatus } from '@/lib/auth/roles';

export interface SessionProfile {
  id: string;
  orgId: string;
  username: string;
  displayName: string;
  role: AppRole;
  status: UserStatus;
  mustChangePassword: boolean;
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('No authenticated session found.');
    this.name = 'UnauthenticatedError';
  }
}

export class SuspendedAccountError extends Error {
  constructor() {
    super('This account has been suspended.');
    this.name = 'SuspendedAccountError';
  }
}

/**
 * Returns the current session's profile, or null if there is no
 * authenticated user. Does NOT throw — use this in places where
 * "not logged in" is a normal, expected state (e.g. the root
 * layout deciding whether to show a logged-out nav).
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, org_id, username, display_name, role, status, must_change_password')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    id: profile.id,
    orgId: profile.org_id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role as AppRole,
    status: profile.status as UserStatus,
    mustChangePassword: profile.must_change_password,
  };
}

/**
 * Like getSessionProfile, but throws when there is no session
 * or the account is suspended. Use this at the top of Route
 * Handlers and protected Server Components where you want a
 * single line that guarantees a valid, active profile or bails.
 */
export async function requireSessionProfile(): Promise<SessionProfile> {
  const profile = await getSessionProfile();

  if (!profile) {
    throw new UnauthenticatedError();
  }

  if (profile.status === 'suspended') {
    throw new SuspendedAccountError();
  }

  return profile;
}
