/**
 * app/api/admin/users/[id]/reset-password/route.ts
 * ─────────────────────────────────────────────────────────────
 * Admin-triggered password reset. Deliberately does NOT let the
 * admin set a password directly — instead it generates a fresh
 * one-time setup link, exactly like the initial invite flow.
 * This means no admin, even a super_admin, ever knows another
 * user's live password — an explicit enterprise security
 * property worth preserving.
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
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/guard';
import { canActOnUser, PERMISSIONS } from '@/lib/auth/roles';
import { createInviteToken } from '@/lib/auth/invite';
import { env } from '@/lib/env';
import { sendInviteEmail } from '@/lib/email/send-invite-email';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const { ipAddress, userAgent } = extractRequestContext(request);

  const guard = await requirePermission(PERMISSIONS.USER_RESET_PASSWORD);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  const admin = createSupabaseAdminClient();

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, org_id, username, role, contact_email')
    .eq('id', targetId)
    .eq('org_id', actor.orgId)
    .single();

  if (targetError || !target) {
    return notFound('User not found.');
  }

  if (!canActOnUser(actor.role, target.role)) {
    return forbidden('You cannot reset the password of a user with an equal or higher role than your own.');
  }

  // Force must_change_password so the next login is routed
  // straight to /set-password once they use the link.
  await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', target.id);

  const { rawToken, expiresAt } = await createInviteToken(target.id);
  const setupUrl = `${env.appUrl}/set-password?token=${rawToken}`;

  if (target.contact_email) {
    await sendInviteEmail({
      toEmail: target.contact_email,
      recipientDisplayName: target.username,
      appName: env.appName,
      setupUrl,
      expiresAt,
      isReset: true,
    });
  }

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET_BY_ADMIN,
    targetType: 'profile',
    targetId: target.id,
    metadata: { reset_username: target.username },
    ipAddress,
    userAgent,
  });

  return ok({ setupUrl, setupLinkExpiresAt: expiresAt });
}
