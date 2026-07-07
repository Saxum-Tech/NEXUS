/**
 * app/api/admin/users/[id]/reinstate/route.ts
 * ─────────────────────────────────────────────────────────────
 * Reverses a suspension. Does not auto-generate a new password
 * or setup link — the user's existing password (if they'd
 * already activated before being suspended) remains valid.
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
    .select('id, org_id, username, role, status, activated_at')
    .eq('id', targetId)
    .eq('org_id', actor.orgId)
    .single();

  if (targetError || !target) {
    return notFound('User not found.');
  }

  if (!canActOnUser(actor.role, target.role)) {
    return forbidden('You cannot reinstate a user with an equal or higher role than your own.');
  }

  if (target.status !== 'suspended') {
    return badRequest('This user is not currently suspended.');
  }

  // If the user never finished activating before being suspended,
  // restore them to "invited" so they still go through set-password;
  // otherwise restore to "active".
  const newStatus = target.activated_at ? 'active' : 'invited';

  const { error: updateError } = await admin
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', target.id);

  if (updateError) {
    return serverError('Could not reinstate user.');
  }

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.USER_REINSTATE,
    targetType: 'profile',
    targetId: target.id,
    metadata: { reinstated_username: target.username, new_status: newStatus },
    ipAddress,
    userAgent,
  });

  return ok({ ok: true, status: newStatus });
}
