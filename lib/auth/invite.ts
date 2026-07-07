/**
 * lib/auth/invite.ts
 * ─────────────────────────────────────────────────────────────
 * Handles the "set your password" first-login flow for invited
 * users.
 *
 * Flow:
 *   1. Admin invites a user → createInvitedUser() runs (see
 *      app/api/admin/users/invite/route.ts), which creates the
 *      auth.users + profiles rows, then calls createInviteToken()
 *      to generate a one-time setup link.
 *   2. The raw token is emailed to contact_email (or shown to the
 *      admin to hand-deliver, in the temp-password-free flow).
 *      Only the SHA-256 hash of the token is ever stored in the
 *      database — the raw token is never persisted, so a DB leak
 *      cannot be used to forge setup links.
 *   3. User visits /set-password?token=... → verifyInviteToken()
 *      checks the hash, expiry, and single-use state, then lets
 *      them set a password via the Supabase Admin API.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { randomBytes, createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const TOKEN_BYTES = 32; // 256 bits
const TOKEN_TTL_HOURS = 24;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a new invite token for a profile, invalidating any
 * previous unused tokens for that profile (so "resend invite"
 * can't leave multiple live links floating around).
 *
 * Returns the RAW token — this is the only time it ever exists
 * in plaintext. Caller is responsible for delivering it (email
 * link, or displaying to the inviting admin) and must not log it.
 */
export async function createInviteToken(profileId: string): Promise<{
  rawToken: string;
  expiresAt: string;
}> {
  const admin = createSupabaseAdminClient();

  // Invalidate prior unused tokens for this profile.
  await admin
    .from('invite_tokens')
    .delete()
    .eq('profile_id', profileId)
    .is('used_at', null);

  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from('invite_tokens').insert({
    profile_id: profileId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`createInviteToken: failed to persist token — ${error.message}`);
  }

  return { rawToken, expiresAt };
}

export interface VerifiedInvite {
  tokenId: string;
  profileId: string;
}

export class InviteTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InviteTokenError';
  }
}

/**
 * Verifies a raw token from the /set-password page. Throws
 * InviteTokenError with a user-safe message if the token is
 * missing, expired, or already used. Does NOT mark it as used —
 * call markInviteTokenUsed() only after the password has
 * actually been set successfully, so a failed password-set
 * request doesn't burn the user's only link.
 */
export async function verifyInviteToken(rawToken: string): Promise<VerifiedInvite> {
  const admin = createSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);

  const { data, error } = await admin
    .from('invite_tokens')
    .select('id, profile_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    throw new InviteTokenError('This setup link is invalid. Please contact your administrator for a new one.');
  }

  if (data.used_at) {
    throw new InviteTokenError('This setup link has already been used. Please contact your administrator for a new one.');
  }

  if (new Date(data.expires_at) < new Date()) {
    throw new InviteTokenError('This setup link has expired. Please contact your administrator for a new one.');
  }

  return { tokenId: data.id, profileId: data.profile_id };
}

export async function markInviteTokenUsed(tokenId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId);
}
