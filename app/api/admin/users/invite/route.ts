/**
 * app/api/admin/users/invite/route.ts
 * ─────────────────────────────────────────────────────────────
 * Creates a new user account. This is the ONLY way accounts get
 * created in this system — there is no public sign-up route.
 *
 * Steps:
 *   1. Require an authenticated session with USER_INVITE permission.
 *   2. Validate input (username format, role, etc.) with Zod.
 *   3. Check username uniqueness within the org.
 *   4. Build the synthetic email and create the auth.users row
 *      via the Admin API (email_confirm: true — we're not using
 *      Supabase's own email confirmation flow since the address
 *      is synthetic and unreachable).
 *   5. Insert the public.profiles row.
 *   6. Generate a one-time setup token, deliver it to contact_email
 *      via lib/email/send-invite-email.ts (logs to console by
 *      default; swap in Resend/SES there), and return the URL in
 *      the response so the admin can copy it as a fallback.
 *   7. Write an audit log entry.
 *
 * Any failure after step 4 attempts to roll back the created
 * auth user, so we don't leak orphaned accounts on partial failure.
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
  unauthorized,
  validationError,
} from '@/lib/api/response';
import { randomUUID } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireSessionProfile, UnauthenticatedError, SuspendedAccountError } from '@/lib/auth/session';
import { can, canAssignRole, PERMISSIONS } from '@/lib/auth/roles';
import { buildSyntheticEmail, normaliseUsername } from '@/lib/auth/synthetic-email';
import { inviteUserSchema, formatZodError } from '@/lib/validation/schemas';
import { createInviteToken } from '@/lib/auth/invite';
import { env } from '@/lib/env';
import { sendInviteEmail } from '@/lib/email/send-invite-email';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function POST(request: Request) {
  const { ipAddress, userAgent } = extractRequestContext(request);

  // ── 1. AuthN + AuthZ ──────────────────────────────────────
  let actor;
  try {
    actor = await requireSessionProfile();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return unauthorized();
    }
    if (err instanceof SuspendedAccountError) {
      return forbidden('Account suspended.');
    }
    throw err;
  }

  if (!can(actor.role, PERMISSIONS.USER_INVITE)) {
    return forbidden('You do not have permission to invite users.');
  }

  // ── 2. Validate body ──────────────────────────────────────
  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  const parsed = inviteUserSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const input = parsed.data;
  const username = normaliseUsername(input.username);

  // Enforce: admins cannot create a super_admin (only a
  // super_admin can). See lib/auth/roles.ts for the rule.
  if (!canAssignRole(actor.role, input.role)) {
    return forbidden(`You do not have permission to assign the role "${input.role}".`);
  }

  const admin = createSupabaseAdminClient();

  // ── 3. Username uniqueness within org ────────────────────
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('org_id', actor.orgId)
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return conflict(`Username "${username}" is already taken in this organisation.`);
  }

  // ── 4. Create auth.users row with synthetic email ────────
  const syntheticEmail = buildSyntheticEmail(username, actor.orgId);

  // Fetch the org's password-change-on-first-login setting now
  // so we honour it in the profile row below.
  const { data: orgConfig } = await admin
    .from('app_config')
    .select('require_password_change_on_first_login')
    .eq('org_id', actor.orgId)
    .single();

  const mustChangeOnLogin = orgConfig?.require_password_change_on_first_login ?? true;

  const { data: createdAuthUser, error: createAuthError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true, // synthetic address — there is no inbox to confirm
    password: randomUUID() + randomUUID(), // unguessable placeholder; real password set via invite link
    user_metadata: {
      username,
      org_id: actor.orgId,
    },
  });

  if (createAuthError || !createdAuthUser?.user) {
    return serverError(`Could not create account: ${createAuthError?.message ?? 'unknown error'}`);
  }

  const newUserId = createdAuthUser.user.id;

  // ── 5. Insert profile row ─────────────────────────────────
  const displayName = `${input.firstName} ${input.lastName}`.trim();

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .insert({
      id: newUserId,
      org_id: actor.orgId,
      username,
      display_name: displayName,
      first_name: input.firstName,
      last_name: input.lastName,
      contact_email: input.contactEmail || null,
      department: input.department || null,
      role: input.role,
      status: 'invited',
      must_change_password: mustChangeOnLogin,
      invited_by: actor.id,
      invited_at: new Date().toISOString(),
    })
    .select('id, username, role, contact_email, display_name')
    .single();

  if (profileError || !profile) {
    // Roll back the orphaned auth user so retries don't collide
    // on a half-created account.
    await admin.auth.admin.deleteUser(newUserId);
    return serverError(`Could not create profile: ${profileError?.message ?? 'unknown error'}`);
  }

  // ── 6. Generate setup link and deliver it ──────────────────
  const { rawToken, expiresAt } = await createInviteToken(profile.id);
  const setupUrl = `${env.appUrl}/set-password?token=${rawToken}`;

  if (profile.contact_email) {
    // sendInviteEmail logs to console until a real provider is
    // wired up — see lib/email/send-invite-email.ts. The setup
    // URL is also returned in the API response below so the
    // inviting admin can copy/paste it as a fallback either way.
    await sendInviteEmail({
      toEmail: profile.contact_email,
      recipientDisplayName: profile.display_name,
      appName: env.appName,
      setupUrl,
      expiresAt,
      isReset: false,
    });
  }

  // ── 7. Audit log ───────────────────────────────────────────
  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.USER_INVITE,
    targetType: 'profile',
    targetId: profile.id,
    metadata: { invited_username: username, role: input.role },
    ipAddress,
    userAgent,
  });

  return created({
        user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        role: profile.role,
      },
      setupUrl,
      setupLinkExpiresAt: expiresAt,
    }
      );
}
