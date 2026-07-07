/**
 * app/api/auth/set-password/route.ts
 * ─────────────────────────────────────────────────────────────
 * Consumes an invite/reset token and sets the user's password.
 * Used for both the first-time "accept invite" flow and the
 * admin-triggered "reset password" flow — both produce the same
 * kind of token, so the same endpoint handles both.
 * ─────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import {
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  parseBody,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
} from '@/lib/api/response';
import { z } from 'zod';
import { rateLimitRequest } from '@/lib/auth/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  verifyInviteToken,
  markInviteTokenUsed,
  InviteTokenError,
} from '@/lib/auth/invite';
import { buildSetPasswordSchema, formatZodError } from '@/lib/validation/schemas';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function POST(request: Request) {
  const { ipAddress, userAgent } = extractRequestContext(request);

  // 5 attempts per IP per 15 minutes — token enumeration protection.
  const limit = rateLimitRequest(request, 'set-password', { max: 5, windowMs: 15 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  // The request's required password strength depends on the
  // target user's org-level setting (enforce_password_complexity),
  // but we don't know which org until we've resolved the token.
  // Do a lightweight, schema-free shape check first just to pull
  // the token out, verify it, THEN validate the password properly
  // against the right policy below.
  const tokenOnly = z.object({ token: z.string().min(1) }).safeParse(body);
  if (!tokenOnly.success) {
    return badRequest('Invalid request body.');
  }

  let verified;
  try {
    verified = await verifyInviteToken(tokenOnly.data.token);
  } catch (err) {
    if (err instanceof InviteTokenError) {
      return badRequest(err.message);
    }
    throw err;
  }

  const admin = createSupabaseAdminClient();

  const { data: targetProfile, error: targetError } = await admin
    .from('profiles')
    .select('id, org_id, username, role')
    .eq('id', verified.profileId)
    .single();

  if (targetError || !targetProfile) {
    return notFound('Could not find the account for this setup link.');
  }

  const { data: config } = await admin
    .from('app_config')
    .select('enforce_password_complexity')
    .eq('org_id', targetProfile.org_id)
    .single();

  const enforceComplexity = config?.enforce_password_complexity ?? true; // fail safe: strict by default

  const parsed = buildSetPasswordSchema(enforceComplexity).safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { password } = parsed.data;

  const { error: updateError } = await admin.auth.admin.updateUserById(
    verified.profileId,
    { password }
  );

  if (updateError) {
    return serverError('Could not set password. Please try again or contact your administrator.');
  }

  await markInviteTokenUsed(verified.tokenId);

  await admin
    .from('profiles')
    .update({
      must_change_password: false,
      status: 'active',
      activated_at: new Date().toISOString(),
    })
    .eq('id', verified.profileId);

  await writeAuditEvent({
    orgId: targetProfile.org_id,
    actorId: targetProfile.id,
    actorUsername: targetProfile.username,
    actorRole: targetProfile.role,
    action: AUDIT_ACTIONS.USER_PASSWORD_SET,
    targetType: 'profile',
    targetId: targetProfile.id,
    ipAddress,
    userAgent,
  });

  return ok({ ok: true });
}
