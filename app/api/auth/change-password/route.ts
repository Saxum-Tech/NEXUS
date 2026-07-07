/**
 * app/api/auth/change-password/route.ts
 * ─────────────────────────────────────────────────────────────
 * Self-service password change for the CURRENTLY authenticated
 * user (as opposed to admin-triggered resets on someone else's
 * account, which go through app/api/admin/users/[id]/reset-password).
 *
 * Exists specifically so password-strength validation goes
 * through buildPasswordSchema() / the org's enforce_password_complexity
 * setting in exactly one place, rather than the client calling
 * Supabase's auth.updateUser() directly and bypassing our policy
 * entirely.
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
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireSessionProfile, UnauthenticatedError, SuspendedAccountError } from '@/lib/auth/session';
import { buildPasswordSchema, formatZodError } from '@/lib/validation/schemas';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function POST(request: Request) {
  const { ipAddress, userAgent } = extractRequestContext(request);

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

  const bodyResult = await parseBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { body } = bodyResult;

  const admin = createSupabaseAdminClient();
  const { data: config } = await admin
    .from('app_config')
    .select('enforce_password_complexity')
    .eq('org_id', actor.orgId)
    .single();

  const enforceComplexity = config?.enforce_password_complexity ?? true;

  const schema = z
    .object({
      newPassword: buildPasswordSchema(enforceComplexity),
      confirmPassword: z.string(),
    })
    .refine((data: { newPassword: string; confirmPassword: string }) => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match.",
      path: ['confirmPassword'],
    });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  // Uses the RLS-respecting, session-bound client (not the admin
  // client) so this can only ever change the CALLER's own password
  // — there is no id parameter here for a reason. Acting on someone
  // else's password is exclusively the admin reset-password route.
  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return serverError(updateError.message);
  }

  await writeAuditEvent({
    orgId: actor.orgId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: AUDIT_ACTIONS.USER_PASSWORD_SET,
    targetType: 'profile',
    targetId: actor.id,
    metadata: { self_service: true },
    ipAddress,
    userAgent,
  });

  return ok({ ok: true });
}
