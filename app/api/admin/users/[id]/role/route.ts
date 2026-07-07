/**
 * app/api/admin/users/[id]/role/route.ts
 * ─────────────────────────────────────────────────────────────
 * Changes a user's role. Enforces canAssignRole() so an admin
 * can never promote someone (or themselves) to super_admin.
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
import { canActOnUser, canAssignRole, PERMISSIONS } from '@/lib/auth/roles';
import { updateUserRoleSchema, formatZodError } from '@/lib/validation/schemas';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const { ipAddress, userAgent } = extractRequestContext(request);

  const guard = await requirePermission(PERMISSIONS.ROLE_ASSIGN);
  if (!guard.ok) return guard.response;
  const actor = guard.profile;

  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  const parsed = updateUserRoleSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { role: newRole } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, org_id, username, role')
    .eq('id', targetId)
    .eq('org_id', actor.orgId)
    .single();

  if (targetError || !target) {
    return notFound('User not found.');
  }

  if (target.id === actor.id) {
    return badRequest('You cannot change your own role.');
  }

  if (!canActOnUser(actor.role, target.role)) {
    return forbidden('You cannot change the role of a user with an equal or higher role than your own.');
  }

  if (!canAssignRole(actor.role, newRole)) {
    return forbidden(`You do not have permission to assign the role "${newRole}".`);
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', target.id);

  if (updateError) {
    return serverError('Could not update role.');
  }

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
    targetType: 'profile',
    targetId: target.id,
    metadata: { from_role: target.role, to_role: newRole, target_username: target.username },
    ipAddress,
    userAgent,
  });

  return ok({ ok: true, role: newRole });
}
