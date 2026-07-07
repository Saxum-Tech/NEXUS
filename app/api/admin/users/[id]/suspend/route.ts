/**
 * app/api/admin/users/[id]/suspend/route.ts
 * ─────────────────────────────────────────────────────────────
 * Suspends a user account: blocks future logins (checked in
 * the login route and in requireSessionProfile) and revokes
 * any currently active sessions immediately via the Admin API.
 * ─────────────────────────────────────────────────────────────
 */

import { logger } from '@/lib/logger';
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
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const { ipAddress, userAgent } = extractRequestContext(request);

  const guard = await requirePermission(PERMISSIONS.USER_SUSPEND);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  const admin = createSupabaseAdminClient();

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, org_id, username, role, status')
    .eq('id', targetId)
    .eq('org_id', actor.orgId) // never allow cross-org targeting
    .single();

  if (targetError || !target) {
    return notFound('User not found.');
  }

  if (!canActOnUser(actor.role, target.role)) {
    return forbidden('You cannot suspend a user with an equal or higher role than your own.');
  }

  if (target.id === actor.id) {
    return badRequest('You cannot suspend your own account.');
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ status: 'suspended' })
    .eq('id', target.id);

  if (updateError) {
    return serverError('Could not suspend user.');
  }

  // Revoke all active sessions immediately rather than waiting
  // for the access token to expire naturally.
  await admin.auth.admin.signOut(target.id, 'global').catch((err: unknown) => {
    // Non-fatal: the status flag still blocks future logins even
    // if revoking live sessions fails for some reason.
    logger.warn('[suspend] failed to revoke active sessions', { err: String(err) });
  });

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.USER_SUSPEND,
    targetType: 'profile',
    targetId: target.id,
    metadata: { suspended_username: target.username },
    ipAddress,
    userAgent,
  });

  return ok({ ok: true });
}
