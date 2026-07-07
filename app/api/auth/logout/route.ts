/**
 * app/api/auth/logout/route.ts
 * ─────────────────────────────────────────────────────────────
 * Signs the current session out and logs the event. Trivial,
 * but still goes through the audit log for completeness — "who
 * was active when" matters in enterprise security reviews.
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
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/session';
import { writeAuditEvent, AUDIT_ACTIONS, extractRequestContext } from '@/lib/auth/audit';

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  if (profile) {
    const { ipAddress, userAgent } = extractRequestContext(request);
    await writeAuditEvent({
      orgId: profile.orgId,
      actorId: profile.id,
      actorUsername: profile.username,
      actorRole: profile.role,
      action: AUDIT_ACTIONS.AUTH_LOGOUT,
      ipAddress,
      userAgent,
    });
  }

  return ok({ ok: true });
}
